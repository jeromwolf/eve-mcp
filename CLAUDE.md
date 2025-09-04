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
# Test server response
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

### Future Enhancements
- Add Google Scholar support (requires API key)
- Implement AI-powered Q&A using embeddings/RAG
- Add persistent storage for downloaded PDFs
- Support for non-English papers