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

// Import modular services
import { searchService } from './services/search-service.js';
import { downloadService } from './services/download-service.js';
import { cacheManager } from './services/cache-manager.js';
import { stateManager } from './services/state-manager.js';
import { pdfCacheService } from './services/pdf-cache-service.js';
import { configManager } from './server/config.js';

// Import existing components
import { EnhancedRAGEngine } from './rag-engine-enhanced.js';
import mcpLogger from './mcp-logger.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
  accessionNumber?: string;
  date?: string;
}

class NRCADAMSMCPServer {
  private server: Server;
  private ragEngine: EnhancedRAGEngine;
  private lastSearchResults: ADAMSDocument[] = [];
  private lastSearchQuery?: string;
  private readonly config;

  constructor() {
    this.config = configManager.getConfig();
    this.ragEngine = new EnhancedRAGEngine();

    mcpLogger.info('NRC ADAMS MCP Server initializing with modular architecture');

    // Initialize PDF cache service
    pdfCacheService.initialize().catch(err => {
      mcpLogger.error('Failed to initialize PDF cache service', { error: err.message });
    });

    this.server = new Server(
      {
        name: "nrc-adams-mcp",
        version: "3.0.0", // Updated version for refactored architecture
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
          description: "Download multiple ADAMS documents (PDFs) with improved retry strategy",
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
        {
          name: "get_system_stats",
          description: "Get system performance and cache statistics",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
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
          case "get_system_stats":
            return await this.getSystemStats();
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
      mcpLogger.info('ADAMS search initiated via search service', {
        query,
        max_results,
        document_type,
        date_from,
        date_to
      });
      
      // Store search query for folder organization
      this.lastSearchQuery = query;
      
      // Use search service for modular search
      const searchResponse = await searchService.search(query, max_results);
      
      // Convert to legacy format for compatibility
      this.lastSearchResults = searchResponse.results.map((result, index) => ({
        title: result.title,
        documentNumber: result.documentNumber,
        accessionNumber: result.accessionNumber,
        date: result.date,
        docketNumber: result.docketNumber,
        url: result.url,
        documentDate: result.date,
        documentType: document_type
      }));

      // Save search results to persistent state
      await stateManager.saveSearchResults(this.lastSearchResults, this.lastSearchQuery);
      
      mcpLogger.info('Search completed via search service', {
        resultCount: this.lastSearchResults.length,
        cached: searchResponse.cached,
        searchTime: searchResponse.searchTime
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${this.lastSearchResults.length} documents for "${query}":

${this.lastSearchResults.map((doc, index) => 
  `${index + 1}. ${doc.title}
   Document Number: ${doc.accessionNumber || doc.documentNumber || 'N/A'}
   Date: ${doc.date || 'N/A'}
   Docket: ${doc.docketNumber || 'N/A'}
`).join('\n')}

📊 Search Performance:
• Results: ${this.lastSearchResults.length}/${max_results}
• Cache Hit: ${searchResponse.cached ? 'Yes' : 'No'}
• Search Time: ${searchResponse.searchTime}ms

Use download_adams_documents to download specific documents by number or count.`
          },
        ],
      };
      
    } catch (error: any) {
      mcpLogger.error('Search failed in ADAMS tool', {
        query,
        error: error.message
      });

      return {
        content: [
          {
            type: "text",
            text: `❌ Search failed for "${query}": ${error.message}\n\nTry a different search term or check the ADAMS service status.`
          },
        ],
      };
    }
  }

  private async downloadADAMSDocuments(args: any): Promise<any> {
    const { count = this.config.download.defaultTarget, document_numbers } = args;
    
    try {
      // Try to load search results from state if not in memory
      if (!this.lastSearchResults || this.lastSearchResults.length === 0) {
        const stateData = await stateManager.loadSearchResults();
        if (stateData && stateData.results.length > 0) {
          this.lastSearchResults = stateData.results;
          this.lastSearchQuery = stateData.query;
          mcpLogger.info('Search results loaded from persistent state', {
            resultCount: this.lastSearchResults.length,
            query: this.lastSearchQuery
          });
        }
      }

      if (!this.lastSearchResults || this.lastSearchResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "❌ No search results available. Please run search_adams first."
            },
          ],
        };
      }

      const sessionId = `session_${Date.now()}`;
      mcpLogger.info('Download initiated via download service', {
        sessionId,
        targetCount: count,
        availableResults: this.lastSearchResults.length,
        specificDocuments: document_numbers
      });

      let documentsToDownload = this.lastSearchResults;

      // Filter by specific document numbers if provided
      if (document_numbers && Array.isArray(document_numbers)) {
        if (document_numbers.every(num => typeof num === 'number')) {
          // Indices provided
          documentsToDownload = document_numbers
            .map(index => this.lastSearchResults[index - 1])
            .filter(Boolean);
        } else {
          // Document numbers provided
          documentsToDownload = this.lastSearchResults.filter(doc =>
            document_numbers.includes(doc.accessionNumber) || 
            document_numbers.includes(doc.documentNumber)
          );
        }
      }

      // Use download service with retry strategy
      const downloadProgress = await downloadService.downloadDocumentsWithRetry(
        documentsToDownload,
        count,
        sessionId,
        this.lastSearchQuery || 'general'
      );

      // Add successfully downloaded documents to RAG engine
      let ragIndexedCount = 0;
      for (const result of downloadProgress.results) {
        if (result.success && result.content && result.metadata) {
          try {
            await this.ragEngine.addDocumentWithPages(
              result.metadata.documentNumber || 'unknown',
              result.content,
              result.metadata,
              result.metadata.pages
            );
            ragIndexedCount++;
            mcpLogger.info('Document indexed in RAG engine', {
              documentNumber: result.metadata.documentNumber,
              filename: result.filename
            });
          } catch (ragError: any) {
            mcpLogger.error('Failed to index document in RAG engine', {
              documentNumber: result.metadata.documentNumber,
              error: ragError.message
            });
          }
        }
      }

      const successfulDownloads = downloadProgress.results.filter(r => r.success);
      
      return {
        content: [
          {
            type: "text",
            text: `📥 Download Results (Session: ${sessionId})

✅ Success: ${downloadProgress.successCount}/${downloadProgress.totalTargets}
❌ Failed: ${downloadProgress.failureCount}
🔄 Total Attempts: ${downloadProgress.attemptCount}
📚 RAG Indexed: ${ragIndexedCount}

Downloaded Documents:
${successfulDownloads.map((result, index) => 
  `${index + 1}. ${result.filename || 'Unknown'}
   Size: ${result.size ? Math.round(result.size / 1024) : 0}KB
   Path: ${result.filePath || 'N/A'}
   ${result.metadata?.title || 'No title available'}`
).join('\n\n')}

${downloadProgress.failureCount > 0 ? 
  `\n⚠️  Failed Downloads:\n${downloadProgress.results
    .filter(r => !r.success)
    .map(r => `• ${r.error || 'Unknown error'}`)
    .join('\n')}` : ''
}

📈 Performance:
• Success Rate: ${Math.round((downloadProgress.successCount / downloadProgress.attemptCount) * 100)}%
• Documents ready for Q&A: ${ragIndexedCount}

Use ask_about_documents to query the downloaded content.`
          },
        ],
      };
      
    } catch (error: any) {
      mcpLogger.error('Download failed', {
        error: error.message,
        targetCount: count
      });

      return {
        content: [
          {
            type: "text",
            text: `❌ Download failed: ${error.message}\n\nTry with fewer documents or different search results.`
          },
        ],
      };
    }
  }

  private async askAboutDocuments(args: any): Promise<any> {
    const { question, document_number } = args;
    
    try {
      mcpLogger.info('Q&A request initiated', {
        question,
        specificDocument: document_number
      });

      if (!this.ragEngine.isEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: "❌ RAG engine not enabled. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable."
            },
          ],
        };
      }

      let ragStats = this.ragEngine.getStats();

      // If RAG engine is empty, try to load existing PDF files
      if (ragStats.documentCount === 0) {
        mcpLogger.info('RAG engine empty, attempting to load existing PDFs');

        // Inform user about loading process
        const startTime = Date.now();
        await this.loadExistingPDFs();
        const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);

        ragStats = this.ragEngine.getStats();

        if (ragStats.documentCount > 0) {
          mcpLogger.info('PDFs loaded successfully', {
            documentCount: ragStats.documentCount,
            loadTimeSeconds: loadTime
          });
        }
      }

      if (ragStats.documentCount === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ No documents available for Q&A. Please download documents first using download_adams_documents.

💡 Tip: After downloading, wait 1-2 seconds before asking questions to allow file system synchronization.`
            },
          ],
        };
      }

      // Check if documents were just loaded
      const justLoaded = ragStats.documentCount > 0 && ragStats.documentCount === this.ragEngine.getStats().documentCount;

      // Search using RAG engine
      let searchResults = await this.ragEngine.search(question, 5);

      // Filter by specific document if requested
      if (document_number) {
        const beforeFilter = searchResults.length;
        mcpLogger.info('Filtering results by document', {
          document_number,
          totalResultsBeforeFilter: beforeFilter,
          availableDocuments: [...new Set(searchResults.map(r => r.metadata.documentNumber))]
        });

        searchResults = searchResults.filter(result =>
          result.metadata.documentNumber === document_number ||
          result.metadata.accessionNumber === document_number
        );

        mcpLogger.info('Filter results', {
          document_number,
          beforeFilter,
          afterFilter: searchResults.length,
          filteredOut: beforeFilter - searchResults.length
        });

        if (searchResults.length === 0) {
          // Check if document exists in RAG engine
          const allDocs = Array.from(this.ragEngine.getAvailableDocuments());
          const docExists = allDocs.includes(document_number);

          return {
            content: [
              {
                type: "text",
                text: `❓ No relevant information found in document ${document_number} for: "${question}"\n\n💡 ${docExists ? 'Document is loaded but content doesn\'t match your query' : 'Document may not be loaded'}. Try:\n- Searching all documents (remove document_number)\n- ${!docExists ? `Downloading ${document_number} first` : 'Rephrasing your question'}\n- Checking available documents with list_downloaded_documents\n\n📋 Available documents: ${allDocs.join(', ') || 'None'}`
              },
            ],
          };
        }
      }

      if (!searchResults || searchResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❓ No relevant information found for: "${question}"\n\nTry rephrasing your question or download more documents.`
            },
          ],
        };
      }

      // Format response with citations
      const formattedResults = searchResults.map((result, index) => {
        return `${index + 1}. ${result.text.substring(0, 300)}${result.text.length > 300 ? '...' : ''}

   📄 Citation: ${result.metadata.citation || 'No citation available'}
   🎯 Relevance Score: ${(result.score * 100).toFixed(1)}%`;
      }).join('\n\n');

      const sourceDocuments = [...new Set(searchResults
        .map(r => r.metadata.documentNumber)
        .filter(Boolean)
      )];

      mcpLogger.info('Q&A completed successfully', {
        question,
        resultCount: searchResults.length,
        sourceDocuments: sourceDocuments.length
      });

      // Build loading notice if documents were just loaded
      const loadingNotice = justLoaded ?
        `\n⚡ Note: Documents were automatically loaded from cache. Subsequent queries will be faster.\n` : '';

      return {
        content: [
          {
            type: "text",
            text: `🤖 Answer for: "${question}"
${loadingNotice}
${formattedResults}

📊 Search Statistics:
• Results Found: ${searchResults.length}
• Source Documents: ${sourceDocuments.length}
• Total Documents Available: ${ragStats.documentCount}
• Documents with Page Info: ${ragStats.documentsWithPageInfo}

📚 Source Documents: ${sourceDocuments.join(', ') || 'N/A'}`
          },
        ],
      };
      
    } catch (error: any) {
      mcpLogger.error('Q&A failed', {
        question,
        error: error.message
      });

      return {
        content: [
          {
            type: "text",
            text: `❌ Q&A failed: ${error.message}\n\nPlease try again or check if documents are properly loaded.`
          },
        ],
      };
    }
  }

  private async listDownloadedDocuments(): Promise<any> {
    try {
      const cacheStats = cacheManager.getStats();
      const ragStats = this.ragEngine.getStats();
      const downloadStats = downloadService.getStats();
      
      // Get cached download results
      const downloadKeys = cacheManager.keys().filter(key => key.startsWith('download_'));
      const documents = downloadKeys
        .map(key => cacheManager.get(key))
        .filter(doc => doc && doc.success)
        .slice(0, 20); // Limit display

      mcpLogger.info('Document list requested', {
        cachedDocuments: documents.length,
        ragDocuments: ragStats.documentCount
      });

      return {
        content: [
          {
            type: "text",
            text: `📚 Downloaded Documents (${documents.length} shown, max 20)

${documents.length > 0 ? 
  documents.map((doc, index) => 
    `${index + 1}. ${doc.filename || 'Unknown'}
   Title: ${doc.metadata?.title || 'No title'}
   Document: ${doc.metadata?.documentNumber || 'N/A'}
   Size: ${doc.size ? Math.round(doc.size / 1024) : 0}KB
   Path: ${doc.filePath || 'N/A'}`
  ).join('\n\n') :
  'No documents downloaded yet.'
}

📊 System Statistics:
• Cache Entries: ${cacheStats.totalEntries}/${cacheStats.maxSize}
• Cache Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%
• Memory Usage: ${cacheStats.memoryUsage}MB
• RAG Documents: ${ragStats.documentCount}
• RAG Chunks: ${ragStats.totalChunks}
• Download Sessions: ${downloadStats.activeSessions}
• Overall Success Rate: ${(downloadStats.successRate * 100).toFixed(1)}%

Use ask_about_documents to query these documents.`
          },
        ],
      };
      
    } catch (error: any) {
      mcpLogger.error('List documents failed', {
        error: error.message
      });

      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to list documents: ${error.message}`
          },
        ],
      };
    }
  }

  private async clearCache(args: any): Promise<any> {
    const { confirm = false } = args;
    
    if (!confirm) {
      return {
        content: [
          {
            type: "text",
            text: "⚠️ This will clear ALL downloaded documents and cache data.\nRun again with confirm=true to proceed."
          },
        ],
      };
    }

    try {
      // Clear all caches
      cacheManager.clear();
      this.ragEngine.clear();
      searchService.clearCache();
      
      // Clear local state
      this.lastSearchResults = [];
      this.lastSearchQuery = undefined;

      mcpLogger.info('Cache cleared successfully');

      return {
        content: [
          {
            type: "text",
            text: "✅ All caches and downloaded documents cleared successfully.\n\nSystem reset - ready for new searches and downloads."
          },
        ],
      };
      
    } catch (error: any) {
      mcpLogger.error('Clear cache failed', {
        error: error.message
      });

      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to clear cache: ${error.message}`
          },
        ],
      };
    }
  }

  private async getSystemStats(): Promise<any> {
    try {
      const cacheStats = cacheManager.getStats();
      const ragStats = this.ragEngine.getStats();
      const downloadStats = downloadService.getStats();
      const searchStats = searchService.getStats();

      return {
        content: [
          {
            type: "text",
            text: `📊 NRC ADAMS MCP Server Statistics

🔍 Search Performance:
• Total Searches: ${searchStats.totalSearches}
• Cache Hit Rate: ${(searchStats.cacheHitRate * 100).toFixed(1)}%
• Average Results: ${searchStats.averageResults}
• Average Search Time: ${searchStats.averageSearchTime}ms
• Popular Keywords: ${searchStats.mostPopularKeywords.join(', ')}

📥 Download Performance:
• Active Sessions: ${downloadStats.activeSessions}
• Total Downloads: ${downloadStats.totalDownloads}
• Success Rate: ${(downloadStats.successRate * 100).toFixed(1)}%
• Average File Size: ${Math.round(downloadStats.averageSize / 1024)}KB

💾 Cache System:
• Entries: ${cacheStats.totalEntries}/${cacheStats.maxSize}
• Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%
• Memory Usage: ${cacheStats.memoryUsage}MB
• Most Accessed: ${cacheStats.mostAccessed || 'None'}

🧠 RAG Engine:
• Provider: ${ragStats.provider}
• Documents: ${ragStats.documentCount}
• Total Chunks: ${ragStats.totalChunks}
• With Page Info: ${ragStats.documentsWithPageInfo}
• Avg Chunks/Doc: ${ragStats.averageChunksPerDocument.toFixed(1)}

🏗️ Architecture:
• Version: 3.0.0 (Modular)
• Config Source: Environment + Defaults
• Services: Search, Download, Cache, RAG
• Status: ✅ All systems operational`
          },
        ],
      };
      
    } catch (error: any) {
      mcpLogger.error('Get stats failed', {
        error: error.message
      });

      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to get system stats: ${error.message}`
          },
        ],
      };
    }
  }

  /**
   * Load existing PDF files into RAG engine
   */
  private async loadExistingPDFs(): Promise<void> {
    try {
      const { promises: fs } = await import('fs');
      const { promises: fsPromises } = await import('fs');
      const path = await import('path');

      const pdfDir = this.config.storage.pdfPath;
      
      // Find all PDF files in subdirectories
      const entries = await fsPromises.readdir(pdfDir, { withFileTypes: true });
      const directories = entries.filter(entry => entry.isDirectory());
      
      let loadedCount = 0;
      
      for (const dir of directories) {
        const dirPath = path.join(pdfDir, dir.name);
        const files = await fsPromises.readdir(dirPath);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        
        for (const pdfFile of pdfFiles) {
          const pdfPath = path.join(dirPath, pdfFile);
          const documentNumber = path.basename(pdfFile, '.pdf');
          
          // Skip if already processed (performance optimization)
          // Check if RAG engine already has documents to avoid reprocessing
          const ragStats = await this.ragEngine.getStats();
          if (ragStats.documentCount >= pdfFiles.length && loadedCount > 0) {
            break; // Already loaded all documents
          }
          
          try {
            // Use high-speed cache with auto-extraction (Option A)
            // pdfCacheService.getCachedText() automatically extracts PDF if cache missing
            mcpLogger.debug('Attempting to load cached text with auto-extraction', {
              documentNumber,
              pdfPath
            });

            // This will auto-generate cache file if missing
            const content = await pdfCacheService.getCachedText(pdfPath, documentNumber);

            if (content) {
              await this.ragEngine.addDocumentWithPages(
                documentNumber,
                content,
                {
                  title: `Document ${documentNumber}`,
                  documentNumber: documentNumber,
                  filename: pdfFile
                }
              );
              loadedCount++;
              mcpLogger.info('PDF loaded into RAG engine', {
                documentNumber,
                contentLength: content.length,
                pdfPath,
                autoExtracted: true
              });
            } else {
              mcpLogger.warn('PDF text extraction failed', {
                documentNumber,
                pdfPath,
                reason: 'pdfCacheService returned null'
              });
            }
          } catch (error: any) {
            mcpLogger.error('Failed to load PDF into RAG engine', {
              pdfPath,
              documentNumber,
              error: error.message,
              stack: error.stack
            });
          }
        }
      }
      
      mcpLogger.info('Existing PDFs loaded into RAG engine', {
        loadedCount,
        totalDirectories: directories.length
      });
      
    } catch (error: any) {
      mcpLogger.error('Failed to load existing PDFs', {
        error: error.message
      });
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    mcpLogger.info('NRC ADAMS MCP Server (Modular v3.0) started successfully');
  }
}

const server = new NRCADAMSMCPServer();
server.run().catch((error) => {
  mcpLogger.error('Server failed to start', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});