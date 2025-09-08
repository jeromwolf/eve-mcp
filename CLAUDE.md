# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NRC ADAMS MCP Server - A Model Context Protocol server that enables NRC ADAMS document search, download, and Q&A functionality within Claude Desktop.

**IMPORTANT**: This project uses REAL NRC ADAMS data only. No mock data or simulated results.

## Commands

### Build and Development
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode (with auto-reload)
npm run dev

# Run production build
npm run start
```

### Testing MCP Server
```bash
# Test real ADAMS search
node test-real-adams-api.js

# Test with specific document
node -e "/* test ML24275A095 */"

# Manual test server response
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js
```

## Architecture Overview

NRC ADAMS MCP Server is a Model Context Protocol server that searches and downloads real documents from the U.S. Nuclear Regulatory Commission's ADAMS (Agency-wide Documents Access and Management System).

### Key Components

1. **MCP Server (src/index.ts)**
   - Main server class `NRCADAMSMCPServer` handles MCP protocol communication
   - Implements four core tools: search_adams, download_adams_documents, ask_about_documents, list_downloaded_documents
   - Uses in-memory LRU caching (50 document limit)
   - Stores search results for number-based download

2. **Real ADAMS Scraper (src/adams-real.ts)**
   - `RealADAMSScraper` class for actual ADAMS search
   - API fails with 500 → automatic browser fallback using Puppeteer
   - Parses real search results from HTML tables
   - Extracts document titles, dates, and accession numbers
   - Supports ML and non-ML formats (SECY, NUREG, etc.)
   - Only returns downloadable documents (with links)

3. **RAG Engine (src/rag-engine.ts)**
   - Dual-provider support: OpenAI and Claude APIs
   - Vector embeddings with text-embedding-ada-002
   - Fallback to keyword search if no API keys
   - Chunk-based document processing

4. **External Dependencies**
   - puppeteer for browser automation (ADAMS search)
   - axios for HTTP requests
   - pdf-parse for text extraction
   - cheerio for HTML/XML parsing
   - OpenAI/Anthropic SDKs (optional)

### Important Implementation Details

#### Search Flow
1. Try ADAMS API → Always returns 500 error
2. Fallback to Puppeteer browser automation
3. Navigate to `https://adams-search.nrc.gov/results/`
4. Wait 8 seconds for results to load
5. Parse HTML tables for document info
6. Extract links, titles, dates from table cells

#### Document Download
- Uses `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=`
- Direct PDF download with axios
- Saves to `downloaded_pdfs/` folder
- Verifies PDF signature (%PDF)

#### Key Patterns
```typescript
// Document number formats
ML[0-9A-Z]{8,}  // ML24270A144
SECY-\d{2}-\d{4}  // SECY-22-0001
NUREG-\d{4}  // NUREG-1234
```

### Recent Changes (2025-09-09)

1. **Complete Rewrite - No Mock Data**
   - Removed ALL mock data generation
   - Implemented RealADAMSScraper class
   - Fixed search to return actual ML numbers
   - Successfully tested with ML24275A095

2. **Fixed Search Results**
   - Changed from `innerText` to `innerHTML` parsing
   - Increased wait time to 8 seconds
   - Now correctly returns ML24270A144 etc.

3. **Table Parsing Improvements**
   - Extract from specific table columns
   - Only show documents with download links
   - Clean extraction of titles and dates
   - Support for non-ML document formats

4. **PDF Download Fix**
   - Use adamswebsearch2.nrc.gov URLs
   - Direct axios download (no browser needed)
   - Verify real PDF files (116KB+ sizes)

### Current Status

✅ **Working**
- Real ADAMS search (no mock data)
- Browser fallback when API fails
- Actual document downloads
- RAG-based Q&A on documents
- LRU cache management (50 docs)

⚠️ **Known Issues**
- ADAMS API always returns 500 (browser fallback works)
- PDF text extraction fails for scanned PDFs
- Some documents may not have download links

### Testing

```bash
# Test with real document
node -e "import('./build/adams-real.js').then(async m => {
  const s = new m.RealADAMSScraper();
  const r = await s.searchReal('safety analysis 2024', 5);
  console.log(r);
  await s.close();
});"

# Expected first result: ML24270A144
```

### GitHub Repository
https://github.com/jeromwolf/eve-mcp