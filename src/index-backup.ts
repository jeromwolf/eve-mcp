#!/usr/bin/env node

// MCP Protocol requires clean JSON output - suppress all console/stderr output
import * as fs from 'fs';
const originalStderr = process.stderr.write;
const originalStdout = process.stdout.write;

// Suppress stderr completely for MCP protocol
process.stderr.write = () => true;

// Only allow JSON output on stdout
const stdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk: any, ...args: any[]): boolean {
  const str = chunk?.toString() || '';
  // Only allow JSON responses (starting with { and containing jsonrpc)
  if (str.trim().startsWith('{') || str.trim() === '') {
    return stdoutWrite(chunk, ...args);
  }
  // Block all non-JSON output
  return true;
};

import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import * as cheerio from 'cheerio';
import { promises as fsPromises } from 'fs';
import * as fsSync from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { EnhancedRAGEngine } from './rag-engine-enhanced.js';
import { ImprovedADAMSScraper } from './adams-real-improved.js';
import mcpLogger from './mcp-logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ADAMSDocument {
  title: string;
  documentNumber?: string;
  docketNumber?: string;
  documentDate?: string;
  documentType?: string;
  url?: string;
  pdfUrl?: string;
  abstract?: string;
}

interface StoredPDFDocument {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pages?: number;
    creationDate?: Date;
    documentNumber?: string;
    docketNumber?: string;
  };
  url: string;
  filename?: string;
  localPath?: string; // 로컬 파일 경로
}

class NRCADAMSMCPServer {
  private server: Server;
  private pdfCache: Map<string, StoredPDFDocument> = new Map();
  private filenameToUrl: Map<string, string> = new Map();
  private currentPdfUrl?: string;
  private lastSearchResults: ADAMSDocument[] = [];
  private lastSearchQuery?: string; // 마지막 검색 키워드 저장
  private readonly MAX_CACHE_SIZE = 50; // 증가: ADAMS 문서는 더 많이 캐시
  private readonly ADAMS_API_BASE = 'https://adams.nrc.gov/wba';
  private readonly ADAMS_SEARCH_BASE = 'https://adams-search.nrc.gov';
  private ragEngine: EnhancedRAGEngine;
  private pdfStoragePath: string;
  private adamsScraper: ImprovedADAMSScraper;

  constructor() {
    this.ragEngine = new EnhancedRAGEngine();
    this.adamsScraper = new ImprovedADAMSScraper();
    
    // PDF 저장 디렉토리 설정
    this.pdfStoragePath = join(__dirname, '..', 'downloaded_pdfs');
    if (!fsSync.existsSync(this.pdfStoragePath)) {
      fsSync.mkdirSync(this.pdfStoragePath, { recursive: true });
      mcpLogger.info(`Created PDF storage directory: ${this.pdfStoragePath}`);
    }
    
    this.server = new Server(
      {
        name: "nrc-adams-mcp",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_adams",
          description: "Search NRC ADAMS website/database for NEW documents (사이트에서 새로 검색)",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for ADAMS documents",
              },
              max_results: {
                type: "number",
                description: "Maximum number of results to return (default: 50)",
                default: 50,
              },
              document_type: {
                type: "string",
                description: "Filter by document type (optional)",
              },
              date_from: {
                type: "string",
                description: "Start date for search (YYYY-MM-DD format)",
              },
              date_to: {
                type: "string",
                description: "End date for search (YYYY-MM-DD format)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "download_adams_documents",
          description: "Download multiple ADAMS documents (PDFs) at once",
          inputSchema: {
            type: "object",
            properties: {
              count: {
                type: "number",
                description: "Number of documents to download from search results (default: 10)",
                default: 10,
              },
              document_numbers: {
                type: "array",
                description: "Specific document numbers or indices to download",
                items: {
                  type: "string"
                }
              },
            },
          },
        },
        {
          name: "ask_about_documents",
          description: "Search/Ask questions within DOWNLOADED documents only (다운로드한 문서 내에서만 검색)",
          inputSchema: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "Question to ask about the documents",
              },
              document_number: {
                type: "string",
                description: "Specific document number to query. If omitted, searches all downloaded documents.",
              },
            },
            required: ["question"],
          },
        },
        {
          name: "list_downloaded_documents",
          description: "List all downloaded ADAMS documents",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "clear_cache",
          description: "Clear/Delete all downloaded documents from cache (캐시 비우기, 다운로드 파일 삭제)",
          inputSchema: {
            type: "object",
            properties: {
              confirm: {
                type: "boolean",
                description: "Confirm to clear all cached documents (default: false)",
                default: false,
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        switch (request.params.name) {
          case "search_adams":
            return await this.searchADAMS(request.params.arguments);
          case "download_adams_documents":
            return await this.downloadADAMSDocuments(request.params.arguments);
          case "ask_about_documents":
            return await this.askAboutDocuments(request.params.arguments);
          case "list_downloaded_documents":
            return await this.listDownloadedDocuments();
          case "clear_cache":
            return await this.clearCache(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      }
    );
  }

  private async searchADAMS(args: any): Promise<any> {
    const { query, max_results = 50, document_type, date_from, date_to } = args;
    
    try {
      mcpLogger.info(`Searching ADAMS for: ${query}`);
      
      // 검색 키워드 저장
      this.lastSearchQuery = query;
      
      // 실제 ADAMS 검색 - 모의 데이터 없음
      const searchResults = await this.adamsScraper.searchReal(query, max_results);
      
      // RealADAMSDocument를 ADAMSDocument로 변환
      const results: ADAMSDocument[] = searchResults.map(doc => ({
        title: doc.title,
        documentNumber: doc.accessionNumber,
        documentDate: doc.docDate || doc.dateAdded,
        documentType: 'Document',
        pdfUrl: doc.pdfUrl,
        abstract: ''
      }));

      // 검색 결과 저장
      this.lastSearchResults = results;
      
      return {
        content: [
          {
            type: "text",
            text: `🔍 새로운 검색 결과 (이전 검색 결과는 대체됨)\n` +
                  `Found ${results.length} documents in NRC ADAMS matching "${query}":\n\n${results
              .map((r, i) => `${i + 1}. ${r.title}\n   Document #: ${r.documentNumber || 'N/A'}\n   Docket: ${r.docketNumber || 'N/A'}\n   Date: ${r.documentDate || 'N/A'}\n   Type: ${r.documentType || 'N/A'}`)
              .join('\n\n')}\n\n` +
                  `📌 현재 상태:\n` +
                  `- 검색 결과: ${results.length}개 (새로운)\n` +
                  `- 캐시된 문서: ${this.pdfCache.size}개 (유지됨)\n\n` +
                  `Use "download_adams_documents" to download from THESE results`,
          },
        ],
        data: results,
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to search ADAMS: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Mock data function removed - using real ADAMS data only

  // Removed unused web scraping function - using RealADAMSScraper instead

  private async downloadADAMSDocuments(args: any): Promise<any> {
    const { count = 10, document_numbers } = args;
    
    if (this.lastSearchResults.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "No search results available. Please search first using 'search_adams'."
      );
    }

    let documentsToDownload: ADAMSDocument[] = [];
    
    if (document_numbers && document_numbers.length > 0) {
      // 특정 문서 번호들 다운로드
      for (const num of document_numbers) {
        const index = parseInt(num) - 1;
        if (!isNaN(index) && index >= 0 && index < this.lastSearchResults.length) {
          documentsToDownload.push(this.lastSearchResults[index]);
        } else {
          // 문서 번호로 직접 검색
          const doc = this.lastSearchResults.find(d => d.documentNumber === num);
          if (doc) documentsToDownload.push(doc);
        }
      }
    } else {
      // 상위 N개 다운로드
      documentsToDownload = this.lastSearchResults.slice(0, count);
    }

    const downloadResults = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < documentsToDownload.length; i++) {
      const doc = documentsToDownload[i];
      mcpLogger.info(`Downloading ${i + 1}/${documentsToDownload.length}: ${doc.title}`);
      
      try {
        const result = await this.downloadSingleDocument(doc);
        downloadResults.push(`✅ ${doc.title}`);
        successCount++;
      } catch (error) {
        downloadResults.push(`❌ ${doc.title}: ${error instanceof Error ? error.message : 'Failed'}`);
        failCount++;
        mcpLogger.error(`Failed to download ${doc.title}:`, error);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `✅ 다운로드 완료!\n\n` +
                `Downloaded ${successCount}/${documentsToDownload.length} documents:\n${downloadResults.join('\n')}\n\n` +
                `📊 캐시 상태:\n` +
                `- 방금 추가: ${successCount}개\n` +
                `- 전체 캐시: ${this.pdfCache.size}/${this.MAX_CACHE_SIZE}개\n` +
                `- 사용률: ${Math.round((this.pdfCache.size / this.MAX_CACHE_SIZE) * 100)}%\n\n` +
                `💡 다음 단계:\n` +
                `- "다운로드한 문서에서 XXX 찾아줘" → 캐시된 ${this.pdfCache.size}개 문서에서 검색\n` +
                `- "YYY 새로 검색" → ADAMS 사이트에서 새 검색 (캐시는 유지됨)`,
        },
      ],
    };
  }

  private async downloadSingleDocument(doc: ADAMSDocument): Promise<void> {
    if (!doc.documentNumber) {
      throw new Error('No document number available');
    }

    // PDF URL 구성
    let pdfUrl = doc.pdfUrl || `https://www.nrc.gov/docs/${doc.documentNumber.substring(0, 6)}/${doc.documentNumber}.pdf`;

    // 이미 캐시에 있는지 확인
    if (this.pdfCache.has(pdfUrl)) {
      mcpLogger.info(`Document already cached: ${doc.title}`);
      return;
    }

    mcpLogger.info(`Downloading real PDF for: ${doc.title} (${doc.documentNumber})`);
    
    try {
      // PDF 파일명 및 경로 생성
      const filename = `${doc.documentNumber}.pdf`;
      const filePath = join(this.pdfStoragePath, filename);
      
      let pdfDocument: StoredPDFDocument;
      let pdfBuffer: Buffer | null = null;
      
      // RealADAMSScraper를 사용하여 실제 PDF 다운로드
      // 마지막 검색어를 키워드로 사용하여 하나의 폴더에 모두 저장
      const keyword = this.lastSearchQuery || 'general';
      const downloadSuccess = await this.adamsScraper.downloadRealPDF(doc.documentNumber, '', keyword);
      
      if (downloadSuccess) {
        // 키워드 기반 실제 경로 계산
        const { sanitizeKeywordForFolder } = await import('./utils.js');
        const keywordFolder = sanitizeKeywordForFolder(keyword);
        const actualPath = join(this.pdfStoragePath, keywordFolder, `${doc.documentNumber}.pdf`);
        
        // 다운로드된 PDF 읽기
        pdfBuffer = await fsPromises.readFile(actualPath);
        mcpLogger.info(`Real PDF downloaded successfully: ${actualPath}`);
        
        // PDF 텍스트 추출 (Warning 메시지 억제)
        let pdfData;
        try {
          // stdout을 임시로 억제
          const originalWrite = process.stdout.write;
          process.stdout.write = () => true;
          
          pdfData = await pdfParse(pdfBuffer);
          
          // stdout 복원
          process.stdout.write = originalWrite;
        } catch (parseError) {
          mcpLogger.error(`PDF parse error: ${parseError}`);
          throw parseError;
        }
        
        pdfDocument = {
          content: pdfData.text,
          metadata: {
            title: doc.title,
            pages: pdfData.numpages,
            documentNumber: doc.documentNumber,
            docketNumber: doc.docketNumber,
          },
          url: pdfUrl,
          filename,
          localPath: actualPath,
        };
      } else {
        throw new Error('Failed to download real PDF');
      }

      // LRU 캐시 관리
      if (this.pdfCache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.pdfCache.keys().next().value;
        if (firstKey) {
          const oldDoc = this.pdfCache.get(firstKey);
          if (oldDoc?.filename) {
            this.filenameToUrl.delete(oldDoc.filename);
          }
          this.pdfCache.delete(firstKey);
        }
      }

      this.pdfCache.set(pdfUrl, pdfDocument);
      this.filenameToUrl.set(filename, pdfUrl);
      this.currentPdfUrl = pdfUrl;
      
      // RAG 엔진에 문서 추가 (페이지 정보 포함)
      try {
        await this.ragEngine.addDocumentWithPages(
          pdfUrl, 
          pdfDocument.content, 
          {
            title: pdfDocument.metadata.title,
            documentNumber: pdfDocument.metadata.documentNumber,
            docketNumber: pdfDocument.metadata.docketNumber,
            filename: pdfDocument.filename
          },
          pdfDocument.metadata.pages // 전체 페이지 수 전달
        );
        mcpLogger.info(`✅ Document added to RAG engine: ${pdfDocument.metadata.title} (${pdfDocument.content.length} chars)`);
      } catch (ragError) {
        mcpLogger.error(`❌ Failed to add document to RAG engine: ${ragError}`);
        // Continue execution even if RAG addition fails
      }
      
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async askAboutDocuments(args: any): Promise<any> {
    const { question, document_number } = args;
    
    if (this.pdfCache.size === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "No documents have been downloaded yet. Please download documents first."
      );
    }

    try {
      // RAG 엔진 사용 가능 여부 확인
      const ragStats = this.ragEngine.getStats();
      const isRAGEnabled = this.ragEngine.isEnabled();
      
      mcpLogger.info(`Q&A: Using ${isRAGEnabled ? 'RAG with embeddings' : 'keyword search'}`);
      
      // RAG 검색 실행
      const searchResults = await this.ragEngine.search(question, 5);
      
      if (searchResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `I couldn't find specific information about "${question}" in the searched documents.`,
            },
          ],
        };
      }
      
      // 결과 포맷팅 (향상된 인용 정보 포함)
      const formattedResults = searchResults.map((result, idx) => {
        const metadata = result.metadata;
        const source = metadata.documentNumber 
          ? `[${metadata.documentNumber}] ${metadata.title || 'Document'}`
          : metadata.title || 'Unknown Document';
        
        // 텍스트 일부만 표시 (앞뒤 100자)
        const excerpt = result.text.length > 200 
          ? result.text.substring(0, 100) + '...' + result.text.substring(result.text.length - 100)
          : result.text;
        
        // 향상된 인용 정보 생성 - 페이지/섹션/라인 정보 포함
        let citation = '';
        if (metadata.citation) {
          // EnhancedRAGEngine에서 제공하는 포맷된 인용
          citation = `📍 ${metadata.citation}`;
        } else if (metadata.pageNumber) {
          // 페이지 정보가 있는 경우
          citation = `📍 Page ${metadata.pageNumber}`;
          if (metadata.totalPages) citation += ` of ${metadata.totalPages}`;
          if (metadata.section) citation += ` - ${metadata.section}`;
          if (metadata.lineNumbers) citation += ` (Lines ${metadata.lineNumbers[0]}-${metadata.lineNumbers[1]})`;
        } else if (metadata.chunkIndex !== undefined) {
          // 기본 청크 정보만 있는 경우 (fallback)
          citation = `📍 Section #${metadata.chunkIndex + 1}` + 
            (metadata.startChar ? ` (position ${metadata.startChar}-${metadata.endChar})` : '');
        }
        
        // ADAMS URL 생성 (Markdown 링크 형식)
        const adamsUrl = metadata.documentNumber 
          ? `🔗 [View in ADAMS](https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${metadata.documentNumber})`
          : '';
        
        // 파일 경로 가져오기
        const docNumber = metadata.documentNumber;
        let fileLink = '';
        if (docNumber) {
          // lastSearchQuery를 사용하여 실제 저장 경로 찾기
          const keywordFolder = this.lastSearchQuery 
            ? `${this.lastSearchQuery.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${new Date().toISOString().split('T')[0]}`
            : '';
          const possiblePaths = [
            join(this.pdfStoragePath, keywordFolder, `${docNumber}.pdf`),
            join(this.pdfStoragePath, `${docNumber}.pdf`)
          ];
          
          for (const path of possiblePaths) {
            if (fsSync.existsSync(path)) {
              // 터미널에서 열 수 있는 명령어 포함
              fileLink = `📂 Local: ${path}\n    💡 Open: \`open "${path}"\` (copy & paste to terminal)\n`;
              break;
            }
          }
        }
        
        return `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
               `📄 **Source**: ${source}\n` +
               `${isRAGEnabled ? `📊 **Relevance Score**: ${(result.score * 100).toFixed(1)}%\n` : ''}` +
               `${citation}\n` +
               `${adamsUrl}\n` +
               `${fileLink}` +
               `📝 "${excerpt}"`;
      });
      
      // 답변 생성 - 검색 결과를 기반으로 통합된 답변 생성
      mcpLogger.info(`Generating synthesized answer with ${searchResults.length} search results`);
      let synthesizedAnswer = `Based on the downloaded documents, here's what I found regarding "${question}":\n\n`;
      
      // 가장 관련성 높은 결과들로 답변 구성
      searchResults.slice(0, 3).forEach((result, idx) => {
        const metadata = result.metadata;
        const docRef = metadata.documentNumber || 'Document';
        const section = metadata.chunkIndex !== undefined ? `, Section ${metadata.chunkIndex + 1}` : '';
        
        // 답변에 인용 포함
        const content = result.text.length > 300 
          ? result.text.substring(0, 300) + '...'
          : result.text;
        
        synthesizedAnswer += `• ${content} [Source: ${docRef}${section}]\n\n`;
      });
      
      // 인용 섹션 추가
      synthesizedAnswer += `\n📚 **Citations and Sources:**\n`;
      searchResults.forEach((result, idx) => {
        const metadata = result.metadata;
        const docNumber = metadata.documentNumber || 'N/A';
        const title = metadata.title || 'Untitled';
        const section = metadata.chunkIndex !== undefined ? `Section ${metadata.chunkIndex + 1}` : '';
        const adamsUrl = docNumber !== 'N/A' 
          ? `[Open in ADAMS](https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${docNumber})`
          : '';
        
        synthesizedAnswer += `\n[${idx + 1}] **${title}**\n`;
        synthesizedAnswer += `    Document: ${docNumber}${section ? ` | ${section}` : ''}\n`;
        if (adamsUrl) {
          synthesizedAnswer += `    Link: ${adamsUrl}\n`;
        }
        if (isRAGEnabled) {
          synthesizedAnswer += `    Relevance: ${(result.score * 100).toFixed(1)}%\n`;
        }
      });
      
      // 검색 메타데이터 추가
      synthesizedAnswer += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      synthesizedAnswer += `📊 **Search Metadata:**\n`;
      synthesizedAnswer += `• Method: ${isRAGEnabled ? 'AI Semantic Search (OpenAI Embeddings)' : 'Keyword Search'}\n`;
      synthesizedAnswer += `• Documents searched: ${ragStats.documents}\n`;
      synthesizedAnswer += `• Total chunks analyzed: ${ragStats.totalChunks}\n`;
      synthesizedAnswer += `• Top results shown: ${searchResults.length}\n`;
      
      return {
        content: [
          {
            type: "text",
            text: synthesizedAnswer,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to process question: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async listDownloadedDocuments(): Promise<any> {
    if (this.pdfCache.size === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Downloaded ADAMS Documents (0/${this.MAX_CACHE_SIZE}):\n\nNo documents have been downloaded yet.\n\nUse 'search_adams' to search and then 'download_adams_documents' to download.`,
          },
        ],
      };
    }
    
    const docList: string[] = [];
    for (const [url, pdfDoc] of this.pdfCache.entries()) {
      // 로컬 파일 경로 확인
      let fileLink = '';
      if (pdfDoc.localPath && fsSync.existsSync(pdfDoc.localPath)) {
        fileLink = `\n   📂 Local File: file://${pdfDoc.localPath}`;
      }
      
      docList.push(
        `📄 ${pdfDoc.metadata.title || 'Untitled'}\n` +
        `   Document #: ${pdfDoc.metadata.documentNumber || 'N/A'}\n` +
        `   Docket: ${pdfDoc.metadata.docketNumber || 'N/A'}\n` +
        `   Filename: ${pdfDoc.filename}\n` +
        `   Pages: ${pdfDoc.metadata.pages || 'Unknown'}${fileLink}`
      );
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Downloaded ADAMS Documents (${this.pdfCache.size}/${this.MAX_CACHE_SIZE}):\n\n${docList.join('\n\n')}\n\nCache Usage: ${Math.round((this.pdfCache.size / this.MAX_CACHE_SIZE) * 100)}%\n\n💡 Tip: "다운로드 파일 지워줘" or "캐시 비우기" to remove all`,
        },
      ],
    };
  }

  private async clearCache(args: any): Promise<any> {
    const { confirm = false } = args || {};
    
    if (!confirm) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ 다운로드 파일 삭제 확인\n\n` +
                  `현재 ${this.pdfCache.size}개의 문서가 다운로드되어 있습니다.\n` +
                  `정말 모든 다운로드한 문서를 삭제하시겠습니까?\n\n` +
                  `확인하려면:\n` +
                  `- "삭제 확인"\n` +
                  `- "캐시 삭제 확인"\n` +
                  `- "다운로드 파일 삭제 확인"`,
          },
        ],
      };
    }
    
    const previousSize = this.pdfCache.size;
    
    // 로컬 파일들도 삭제
    for (const [url, pdfDoc] of this.pdfCache.entries()) {
      if (pdfDoc.localPath && fsSync.existsSync(pdfDoc.localPath)) {
        try {
          await fsPromises.unlink(pdfDoc.localPath);
          mcpLogger.info(`Deleted local file: ${pdfDoc.localPath}`);
        } catch (err) {
          mcpLogger.warn(`Failed to delete file: ${err}`);
        }
      }
    }
    
    this.pdfCache.clear();
    this.filenameToUrl.clear();
    this.currentPdfUrl = undefined;
    this.ragEngine.clear(); // RAG 엔진도 초기화
    
    return {
      content: [
        {
          type: "text",
          text: `🗑️ 다운로드 파일 삭제 완료!\n\n` +
                `- 삭제된 문서: ${previousSize}개\n` +
                `- 남은 문서: 0개\n\n` +
                `✨ 깨끗하게 비워졌습니다!\n\n` +
                `새로 시작하려면:\n` +
                `1. "XXX 검색" → ADAMS에서 새 검색\n` +
                `2. "N개 다운로드" → 문서 다운로드`,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    mcpLogger.info("NRC ADAMS MCP server running on stdio");
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new NRCADAMSMCPServer();
  server.run().catch(err => mcpLogger.error('Server error:', err));
}