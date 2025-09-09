import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import mcpLogger from './mcp-logger.js';

interface DocumentChunk {
  text: string;
  embedding?: number[];
  metadata: {
    documentNumber?: string;
    title?: string;
    filename?: string;
    docketNumber?: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
    // 📄 페이지 정보 추가
    pageNumber?: number;        // 청크가 속한 페이지 번호
    totalPages?: number;         // 전체 페이지 수
    section?: string;            // 섹션 제목 (추출 가능한 경우)
    pageContent?: string;        // 해당 페이지 전체 내용
    lineNumbers?: [number, number]; // 시작-끝 라인 번호
  };
}

interface SearchResult {
  text: string;
  score: number;
  metadata: any;
}

export class EnhancedRAGEngine {
  private documents: Map<string, DocumentChunk[]> = new Map();
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  public provider: 'openai' | 'anthropic' | 'none' = 'none';
  private readonly CHUNK_SIZE = 500;
  private readonly CHUNK_OVERLAP = 100;

  constructor() {
    // API 키 확인 및 초기화
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.provider = 'openai';
      mcpLogger.info('RAG: OpenAI provider initialized');
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      this.provider = 'anthropic';
      mcpLogger.info('RAG: Anthropic provider initialized');
    } else {
      mcpLogger.warn('RAG: No API key found, using keyword search');
    }
  }

  // 📄 페이지 정보를 포함한 텍스트 분할
  private splitIntoChunksWithPages(text: string, totalPages?: number): Array<{
    text: string;
    pageNumber: number;
    startLine: number;
    endLine: number;
  }> {
    const chunks: Array<{
      text: string;
      pageNumber: number;
      startLine: number;
      endLine: number;
    }> = [];
    
    // 페이지 구분자로 분할 시도
    const pagePattern = /(?:Page|PAGE)\s*(\d+)(?:\s*of\s*\d+)?|^\d+\s*$/gm;
    const lines = text.split('\n');
    
    let currentPage = 1;
    let currentChunk = '';
    let startLine = 0;
    let lineCount = 0;
    
    // 예상 라인 수 (페이지당 약 50-60줄)
    const estimatedLinesPerPage = totalPages ? Math.ceil(lines.length / totalPages) : 60;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 페이지 번호 감지
      const pageMatch = line.match(pagePattern);
      if (pageMatch && pageMatch[1]) {
        const detectedPage = parseInt(pageMatch[1]);
        if (detectedPage > currentPage) {
          // 현재 청크 저장
          if (currentChunk.trim()) {
            chunks.push({
              text: currentChunk,
              pageNumber: currentPage,
              startLine: startLine,
              endLine: i - 1
            });
          }
          currentPage = detectedPage;
          currentChunk = '';
          startLine = i;
        }
      }
      
      // 페이지 추정 (페이지 번호가 없는 경우)
      if (!pageMatch && lineCount > estimatedLinesPerPage) {
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk,
            pageNumber: currentPage,
            startLine: startLine,
            endLine: i - 1
          });
        }
        currentPage++;
        currentChunk = line + '\n';
        startLine = i;
        lineCount = 1;
      } else {
        currentChunk += line + '\n';
        lineCount++;
      }
      
      // 청크 크기 제한
      if (currentChunk.length > this.CHUNK_SIZE) {
        chunks.push({
          text: currentChunk,
          pageNumber: currentPage,
          startLine: startLine,
          endLine: i
        });
        currentChunk = '';
        startLine = i + 1;
        lineCount = 0;
      }
    }
    
    // 마지막 청크 저장
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk,
        pageNumber: currentPage,
        startLine: startLine,
        endLine: lines.length - 1
      });
    }
    
    return chunks;
  }

  // 📄 섹션 제목 추출 (휴리스틱)
  private extractSection(text: string): string | undefined {
    // 일반적인 섹션 패턴
    const sectionPatterns = [
      /^(?:\d+\.?\s+)?([A-Z][A-Z\s]+)$/m,           // 1. INTRODUCTION
      /^(?:Section|SECTION)\s+(.+)$/im,             // Section 2.1
      /^(?:Chapter|CHAPTER)\s+(.+)$/im,             // Chapter 3
      /^(?:Part|PART)\s+(.+)$/im,                   // Part IV
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,5}):$/m   // Executive Summary:
    ];
    
    for (const pattern of sectionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  async addDocumentWithPages(
    documentId: string, 
    text: string, 
    metadata: any = {},
    totalPages?: number
  ): Promise<void> {
    mcpLogger.info(`Adding document with page info: ${documentId}`, { 
      textLength: text.length,
      totalPages: totalPages || 'estimated'
    });

    // 페이지 정보를 포함한 청크 분할
    const chunksWithPages = this.splitIntoChunksWithPages(text, totalPages);
    const documentChunks: DocumentChunk[] = [];

    if (this.provider === 'openai' && this.openai) {
      // OpenAI 임베딩 (배치 처리)
      const batchSize = 20;
      for (let i = 0; i < chunksWithPages.length; i += batchSize) {
        const batch = chunksWithPages.slice(i, i + batchSize);
        
        try {
          const response = await this.openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: batch.map(c => c.text),
          });

          batch.forEach((chunk, idx) => {
            const section = this.extractSection(chunk.text);
            
            documentChunks.push({
              text: chunk.text,
              embedding: response.data[idx].embedding,
              metadata: {
                ...metadata,
                chunkIndex: i + idx,
                startChar: chunk.startLine * 80, // 대략적인 문자 위치
                endChar: chunk.endLine * 80,
                // 📄 페이지 정보
                pageNumber: chunk.pageNumber,
                totalPages: totalPages || Math.ceil(chunksWithPages.length / 3),
                section: section,
                lineNumbers: [chunk.startLine, chunk.endLine]
              }
            });
          });
        } catch (error) {
          mcpLogger.error('Embedding creation failed', error);
        }
      }
    } else {
      // 키워드 검색용 (임베딩 없이)
      chunksWithPages.forEach((chunk, index) => {
        const section = this.extractSection(chunk.text);
        
        documentChunks.push({
          text: chunk.text,
          embedding: undefined,
          metadata: {
            ...metadata,
            chunkIndex: index,
            startChar: chunk.startLine * 80,
            endChar: chunk.endLine * 80,
            // 📄 페이지 정보
            pageNumber: chunk.pageNumber,
            totalPages: totalPages || Math.ceil(chunksWithPages.length / 3),
            section: section,
            lineNumbers: [chunk.startLine, chunk.endLine]
          }
        });
      });
    }

    this.documents.set(documentId, documentChunks);
    mcpLogger.info(`Document added with ${documentChunks.length} chunks including page info`);
  }

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    mcpLogger.info(`RAG search: "${query}" (provider: ${this.provider})`);

    if (this.documents.size === 0) {
      mcpLogger.warn('No documents in RAG engine');
      return [];
    }

    const allChunks: DocumentChunk[] = [];
    for (const chunks of this.documents.values()) {
      allChunks.push(...chunks);
    }

    let results: SearchResult[] = [];

    if (this.provider === 'openai' && this.openai) {
      // OpenAI 임베딩 검색
      try {
        const queryEmbedding = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: query,
        });

        const scores = allChunks
          .filter(chunk => chunk.embedding)
          .map(chunk => ({
            chunk,
            score: this.cosineSimilarity(
              queryEmbedding.data[0].embedding,
              chunk.embedding!
            )
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);

        results = scores.map(({ chunk, score }) => ({
          text: chunk.text,
          score,
          metadata: {
            ...chunk.metadata,
            // 📄 인용 형식 개선
            citation: this.formatCitation(chunk.metadata)
          }
        }));
      } catch (error) {
        mcpLogger.error('Embedding search failed', error);
      }
    } else {
      // 키워드 검색 (fallback)
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/);

      const scores = allChunks.map(chunk => {
        const textLower = chunk.text.toLowerCase();
        let score = 0;

        // 단어 일치 점수
        queryWords.forEach(word => {
          const occurrences = (textLower.match(new RegExp(word, 'g')) || []).length;
          score += occurrences;
        });

        // 정확한 구문 일치 보너스
        if (textLower.includes(queryLower)) {
          score += 10;
        }

        return { chunk, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

      results = scores.map(({ chunk, score }) => ({
        text: chunk.text,
        score: score / Math.max(...scores.map(s => s.score)), // 정규화
        metadata: {
          ...chunk.metadata,
          // 📄 인용 형식 개선
          citation: this.formatCitation(chunk.metadata)
        }
      }));
    }

    mcpLogger.info(`RAG search returned ${results.length} results with page info`);
    return results;
  }

  // 📄 인용 형식 생성
  private formatCitation(metadata: any): string {
    const parts = [];
    
    if (metadata.documentNumber) {
      parts.push(`[${metadata.documentNumber}]`);
    }
    
    if (metadata.pageNumber) {
      parts.push(`Page ${metadata.pageNumber}`);
      if (metadata.totalPages) {
        parts.push(`of ${metadata.totalPages}`);
      }
    }
    
    if (metadata.section) {
      parts.push(`- ${metadata.section}`);
    }
    
    if (metadata.lineNumbers) {
      parts.push(`(Lines ${metadata.lineNumbers[0]}-${metadata.lineNumbers[1]})`);
    }
    
    return parts.join(' ') || '[No citation info]';
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  isEnabled(): boolean {
    return this.provider !== 'none';
  }

  clear() {
    this.documents.clear();
    mcpLogger.info('RAG engine cleared all documents');
  }

  getStats() {
    const totalChunks = Array.from(this.documents.values())
      .reduce((sum, chunks) => sum + chunks.length, 0);
    
    const documentsWithPageInfo = Array.from(this.documents.values())
      .filter(chunks => chunks.some(c => c.metadata.pageNumber))
      .length;
    
    return {
      documents: this.documents,
      provider: this.provider,
      documentCount: this.documents.size,
      totalChunks,
      documentsWithPageInfo,
      averageChunksPerDocument: this.documents.size > 0 
        ? totalChunks / this.documents.size 
        : 0
    };
  }
}