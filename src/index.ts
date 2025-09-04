#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { PDFDocument as PDFLib } from 'pdf-lib';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';

interface SearchResult {
  title: string;
  url: string;
  authors?: string[];
  abstract?: string;
  published?: string;
}

interface StoredPDFDocument {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pages?: number;
    creationDate?: Date;
  };
  url: string;
  filename?: string;
}

class EVEMCPServer {
  private server: Server;
  private pdfCache: Map<string, StoredPDFDocument> = new Map();
  private filenameToUrl: Map<string, string> = new Map();
  private currentPdfUrl?: string;
  private lastSearchResults: SearchResult[] = [];
  private readonly MAX_CACHE_SIZE = 20; // 최대 20개 PDF까지만 캐시

  constructor() {
    this.server = new Server(
      {
        name: "eve-mcp",
        version: "1.0.0",
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
          name: "search_papers",
          description: "Search for academic papers on various sites",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for papers",
              },
              site: {
                type: "string",
                description: "Target site to search (default: arxiv). Options: arxiv, scholar, pubmed",
                enum: ["arxiv", "scholar", "pubmed"],
                default: "arxiv",
              },
              max_results: {
                type: "number",
                description: "Maximum number of results to return (default: 10)",
                default: 10,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "download_pdf",
          description: "Download and extract text from a PDF document",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "URL of the PDF to download, or search result number (e.g., '1', '2')",
              },
            },
            required: ["url"],
          },
        },
        {
          name: "ask_about_pdf",
          description: "Ask questions about a downloaded PDF document",
          inputSchema: {
            type: "object",
            properties: {
              pdf_identifier: {
                type: "string",
                description: "URL or filename of the PDF to query. If omitted, uses the most recently downloaded PDF.",
              },
              question: {
                type: "string",
                description: "Question to ask about the PDF content",
              },
            },
            required: ["question"],
          },
        },
        {
          name: "list_downloaded_pdfs",
          description: "List all downloaded PDFs with their titles and filenames",
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
          case "search_papers":
            return await this.searchPapers(request.params.arguments);
          case "download_pdf":
            return await this.downloadPDF(request.params.arguments);
          case "ask_about_pdf":
            return await this.askAboutPDF(request.params.arguments);
          case "list_downloaded_pdfs":
            return await this.listDownloadedPDFs();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      }
    );
  }

  private async searchPapers(args: any): Promise<any> {
    const { query, site = "arxiv", max_results = 10 } = args;
    
    try {
      let results: SearchResult[] = [];
      
      switch (site) {
        case "arxiv":
          results = await this.searchArxiv(query, max_results);
          break;
        case "scholar":
          results = await this.searchGoogleScholar(query, max_results);
          break;
        case "pubmed":
          results = await this.searchPubMed(query, max_results);
          break;
        default:
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unsupported site: ${site}. Supported sites: arxiv, scholar, pubmed`
          );
      }
      
      // Save search results for download by number
      this.lastSearchResults = results;
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} papers on ${site} matching "${query}":\n\n${results
              .map((r, i) => `${i + 1}. ${r.title}\n   Authors: ${r.authors?.join(', ') || 'N/A'}\n   URL: ${r.url}\n   Published: ${r.published || 'N/A'}`)
              .join('\n\n')}\n\nTo download, use: "download_pdf" with the URL or number (1-${results.length})`,
          },
        ],
        data: results,
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to search papers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  private async searchArxiv(query: string, maxResults: number): Promise<SearchResult[]> {
    const searchUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}`;
    
    const response = await axios.get(searchUrl);
    const $ = cheerio.load(response.data, { xmlMode: true });
    
    const results: SearchResult[] = [];
    
    $('entry').each((index, element) => {
      const $entry = $(element);
      const title = $entry.find('title').text().trim();
      const id = $entry.find('id').text().trim();
      const summary = $entry.find('summary').text().trim();
      const published = $entry.find('published').text().trim();
      
      // Extract authors
      const authors: string[] = [];
      $entry.find('author name').each((i, el) => {
        authors.push($(el).text().trim());
      });
      
      // Get PDF URL - handle different arXiv URL formats
      let pdfUrl = id;
      if (id.includes('/abs/')) {
        pdfUrl = id.replace('/abs/', '/pdf/') + '.pdf';
      } else if (id.startsWith('http://arxiv.org/abs/')) {
        pdfUrl = id.replace('http://arxiv.org/abs/', 'http://arxiv.org/pdf/') + '.pdf';
      } else if (id.startsWith('https://arxiv.org/abs/')) {
        pdfUrl = id.replace('https://arxiv.org/abs/', 'https://arxiv.org/pdf/') + '.pdf';
      }
      
      results.push({
        title,
        url: pdfUrl,
        authors,
        abstract: summary,
        published,
      });
    });
    
    return results;
  }
  
  private async searchGoogleScholar(query: string, maxResults: number): Promise<SearchResult[]> {
    // Note: Google Scholar doesn't have an official API
    // This is a placeholder - in production, you'd need to use a service like SerpAPI
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Google Scholar search requires API key setup. For now, please use 'arxiv' or 'pubmed'."
    );
  }
  
  private async searchPubMed(query: string, maxResults: number): Promise<SearchResult[]> {
    // PubMed E-utilities API
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${maxResults}`;
    
    try {
      const searchResponse = await axios.get(searchUrl);
      const idList = searchResponse.data.esearchresult.idlist;
      
      if (idList.length === 0) {
        return [];
      }
      
      // Fetch details for each ID
      const detailsUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
      const detailsResponse = await axios.get(detailsUrl);
      
      const results: SearchResult[] = [];
      const uids = detailsResponse.data.result.uids;
      
      for (const uid of uids) {
        const article = detailsResponse.data.result[uid];
        
        results.push({
          title: article.title,
          url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
          authors: article.authors?.map((a: any) => a.name) || [],
          abstract: article.sorttitle || '',
          published: article.pubdate || '',
        });
      }
      
      return results;
    } catch (error) {
      throw new Error(`PubMed search failed: ${error}`);
    }
  }

  private async downloadPDF(args: any): Promise<any> {
    let { url } = args;
    
    // Check if url is a number (search result index)
    const resultNumber = parseInt(url);
    if (!isNaN(resultNumber) && resultNumber > 0 && resultNumber <= this.lastSearchResults.length) {
      url = this.lastSearchResults[resultNumber - 1].url;
      console.error(`Using search result #${resultNumber}: ${url}`);
    }
    
    try {
      // Check cache first
      if (this.pdfCache.has(url)) {
        const cached = this.pdfCache.get(url)!;
        return {
          content: [
            {
              type: "text",
              text: `PDF already downloaded and cached.\n\nFilename: ${cached.filename}\nTitle: ${cached.metadata.title || 'Unknown'}\nPages: ${cached.metadata.pages || 'Unknown'}`,
            },
          ],
        };
      }
      
      // Handle http vs https for arXiv
      let downloadUrl = url;
      if (url.startsWith('http://arxiv.org/')) {
        downloadUrl = url.replace('http://', 'https://');
        console.error(`Converting HTTP to HTTPS: ${downloadUrl}`);
      }
      
      // Download PDF
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        maxContentLength: 50 * 1024 * 1024, // 50MB limit
        headers: {
          'User-Agent': 'EVE-MCP/1.0 (Academic PDF Reader)'
        }
      });
      
      const buffer = Buffer.from(response.data);
      
      // Save to temporary file for processing
      const hash = createHash('md5').update(url).digest('hex');
      const tempPath = join(tmpdir(), `eve-pdf-${hash}.pdf`);
      await fs.writeFile(tempPath, buffer);
      
      // Parse PDF for text extraction
      const parsedPdf = await pdfParse(buffer);
      
      // Extract filename from URL or use title
      let filename = url.split('/').pop() || 'unknown.pdf';
      if (!filename.endsWith('.pdf')) {
        filename += '.pdf';
      }
      
      const pdfDocument: StoredPDFDocument = {
        content: parsedPdf.text,
        metadata: {
          title: parsedPdf.info?.Title || undefined,
          author: parsedPdf.info?.Author || undefined,
          pages: parsedPdf.numpages || 0,
          creationDate: parsedPdf.info?.CreationDate || undefined,
        },
        url,
        filename,
      };
      
      // Cache the document with size limit (LRU)
      if (this.pdfCache.size >= this.MAX_CACHE_SIZE) {
        // Remove oldest entry (first item in Map)
        const firstKey = this.pdfCache.keys().next().value;
        if (firstKey) {
          const oldDoc = this.pdfCache.get(firstKey);
          if (oldDoc?.filename) {
            this.filenameToUrl.delete(oldDoc.filename);
          }
          this.pdfCache.delete(firstKey);
          console.error(`Cache full, removing oldest PDF: ${firstKey}`);
        }
      }
      
      this.pdfCache.set(url, pdfDocument);
      this.filenameToUrl.set(filename, url);
      this.currentPdfUrl = url;
      
      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {}); // Ignore errors
      
      return {
        content: [
          {
            type: "text",
            text: `PDF downloaded successfully!\n\nFilename: ${pdfDocument.filename}\nTitle: ${pdfDocument.metadata.title || 'Unknown'}\nAuthor: ${pdfDocument.metadata.author || 'Unknown'}\nPages: ${pdfDocument.metadata.pages || 'Unknown'}\n\nYou can now ask questions about this PDF using its filename "${pdfDocument.filename}" or just ask directly (I'll use the most recent PDF).\n\nFirst 500 characters:\n${pdfDocument.content.substring(0, 500)}...`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async askAboutPDF(args: any): Promise<any> {
    const { pdf_identifier, question } = args;
    
    let pdf_url: string | undefined;
    
    // Determine which PDF to use
    if (!pdf_identifier) {
      // Use most recent PDF
      pdf_url = this.currentPdfUrl;
      if (!pdf_url) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "No PDF has been downloaded yet. Please download a PDF first."
        );
      }
    } else if (pdf_identifier.startsWith('http')) {
      // It's a URL
      pdf_url = pdf_identifier;
    } else {
      // It's a filename
      pdf_url = this.filenameToUrl.get(pdf_identifier);
      if (!pdf_url) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `PDF with filename "${pdf_identifier}" not found. Use 'list_downloaded_pdfs' to see available PDFs.`
        );
      }
    }
    
    try {
      // Check if PDF is downloaded
      if (!pdf_url || !this.pdfCache.has(pdf_url)) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "PDF not found in cache. Please download it first using 'download_pdf'."
        );
      }
      
      const pdfDoc = this.pdfCache.get(pdf_url)!;
      const content = pdfDoc.content.toLowerCase();
      const questionLower = question.toLowerCase();
      
      // Simple keyword-based search (in production, this would use AI/embeddings)
      const keywords = questionLower.split(/\s+/).filter((word: string) => word.length > 3);
      
      // Find relevant paragraphs
      const paragraphs = pdfDoc.content.split(/\n\n+/);
      const relevantParagraphs: Array<{ text: string; score: number }> = [];
      
      for (const paragraph of paragraphs) {
        if (paragraph.length < 50) continue; // Skip short paragraphs
        
        const paragraphLower = paragraph.toLowerCase();
        let score = 0;
        
        for (const keyword of keywords) {
          if (paragraphLower.includes(keyword)) {
            score += paragraphLower.split(keyword).length - 1;
          }
        }
        
        if (score > 0) {
          relevantParagraphs.push({ text: paragraph, score });
        }
      }
      
      // Sort by relevance and take top 3
      relevantParagraphs.sort((a, b) => b.score - a.score);
      const topParagraphs = relevantParagraphs.slice(0, 3).map(p => p.text);
      
      if (topParagraphs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `I couldn't find specific information about "${question}" in the PDF. The document might not contain relevant information about this topic.`,
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Based on the PDF content, here's what I found related to "${question}":\n\n${topParagraphs.join('\n\n...\n\n')}\n\n[Note: This is a simple keyword-based search. For more accurate results, an AI-powered analysis would be needed.]`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to process question: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async listDownloadedPDFs(): Promise<any> {
    if (this.pdfCache.size === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No PDFs have been downloaded yet. Use 'download_pdf' to download a PDF first.",
          },
        ],
      };
    }
    
    const pdfList: string[] = [];
    for (const [url, pdfDoc] of this.pdfCache.entries()) {
      pdfList.push(
        `Filename: ${pdfDoc.filename}\n` +
        `Title: ${pdfDoc.metadata.title || 'Unknown'}\n` +
        `URL: ${url}\n` +
        `Pages: ${pdfDoc.metadata.pages || 'Unknown'}`
      );
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Downloaded PDFs (${this.pdfCache.size}/${this.MAX_CACHE_SIZE}):\n\n${pdfList.join('\n\n---\n\n')}\n\nCurrent PDF: ${this.currentPdfUrl ? this.pdfCache.get(this.currentPdfUrl)?.filename : 'None'}\n\nCache Usage: ${Math.round((this.pdfCache.size / this.MAX_CACHE_SIZE) * 100)}%`,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("EVE MCP server running on stdio");
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EVEMCPServer();
  server.run().catch(console.error);
}