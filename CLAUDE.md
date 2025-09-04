# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Run linting
npm run lint

# Run tests
npm test
```

### Testing MCP Server
```bash
# Quick test
./auto-test.sh

# Integration tests
node integration-test.js

# Cache management tests
node cache-test.js

# Full feature test (includes actual PDF download)
./full-test.sh

# Manual test server response
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js
```

## Architecture Overview

EVE MCP Server is a Model Context Protocol server that enables academic paper search and Q&A functionality within Claude Desktop.

### Key Components

1. **MCP Server (src/index.ts)**
   - Main server class `EVEMCPServer` handles MCP protocol communication
   - Implements four core tools: search_papers, download_pdf, ask_about_pdf, list_downloaded_pdfs
   - Uses in-memory caching for downloaded PDFs
   - Stores search results for number-based download

2. **Tool Implementations**
   - `searchPapers`: Supports arXiv and PubMed APIs
   - `downloadPDF`: Downloads PDFs with 50MB limit, extracts text using pdf-parse
   - `askAboutPDF`: Keyword-based search with paragraph relevance scoring
   - `listDownloadedPDFs`: Shows cached PDFs with metadata

3. **External Dependencies**
   - arXiv API and PubMed E-utilities (no API key required)
   - pdf-parse for text extraction (CommonJS compatibility handled)
   - axios for HTTP requests
   - cheerio for XML parsing

### Important Implementation Details
- HTTP to HTTPS conversion for arXiv URLs
- Search results cached for number-based download (e.g., "download #2")
- PDF text extraction using pdf-parse with CommonJS workaround
- File naming based on URL last segment
- LRU cache implementation (MAX_CACHE_SIZE = 20)
- Temporary files saved to OS tmpdir() and immediately deleted after text extraction

### Recent Changes
- Implemented LRU cache to prevent memory leaks
- Added cache usage percentage display in list_downloaded_pdfs
- Created comprehensive test suites (auto-test.sh, integration-test.js, cache-test.js, full-test.sh)
- Fixed CommonJS module compatibility issue with createRequire

### Known Issues (see KNOWN_ISSUES.md)
- PDF text extraction fails for scanned/image-based PDFs
- Simple keyword matching for Q&A (no semantic search)
- Limited error messages for failed downloads

### Future Enhancements
- Add Google Scholar support (requires API key)
- Implement AI-powered Q&A using embeddings/RAG
- Add persistent storage option for downloaded PDFs
- Support for non-English papers
- Implement cache-manager.ts for advanced memory management