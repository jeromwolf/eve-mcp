# NRC ADAMS MCP Server

Nuclear Regulatory Commission (NRC) ADAMS (Agency-wide Documents Access and Management System) document search and analysis server for Claude Desktop.

## ✨ Features

- 🔍 **Site Search**: Search documents from NRC ADAMS database
- 📥 **Auto Download**: Automatically download top 10 documents (configurable)
- 💬 **Document Chat**: Chat with downloaded documents using AI-powered search
- 🧠 **RAG Support**: Optional semantic search with OpenAI or Claude API
- 📊 **Smart Cache**: LRU cache management for up to 50 documents

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Claude Desktop
- (Optional) OpenAI or Claude API key for RAG features

### 2. Installation
```bash
git clone https://github.com/jeromwolf/eve-mcp.git
cd eve-mcp
npm install
npm run build
```

### 3. Claude Desktop Configuration

#### macOS
```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add the following configuration:
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["/Users/your_username/path/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",  // Optional: for OpenAI embeddings
        "ANTHROPIC_API_KEY": "sk-ant-..."  // Optional: for Claude analysis
      }
    }
  }
}
```

#### Windows
Configuration file: `%APPDATA%\Claude\claude_desktop_config.json`
```json
{
  "mcpServers": {
    "nrc-adams-mcp": {
      "command": "node",
      "args": ["C:/path/eve-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",  // Optional
        "ANTHROPIC_API_KEY": "sk-ant-..."  // Optional
      }
    }
  }
}
```

### 4. Restart Claude Desktop

## 📖 Usage Guide

### 1. Search NRC ADAMS Documents

#### Basic Search
```
"Search for emergency plan"
"Find reactor safety documents"
"Look for ML24001234"  // Document number search
```

#### Advanced Search
```
"Search for emergency plan from 2024"
"Find 20 documents about reactor"  // Custom result count (default: 50)
"Search safety analysis top 100"  // Max 100 results
```

### 2. Download Documents

#### Auto Download (Top 10)
```
"Download emergency plan documents"  // Downloads top 10 automatically
"Download reactor safety top 5"  // Custom download count
```

#### Manual Download
```
"Download document #3"  // From search results
"Download documents 1, 3, 5"  // Multiple documents
```

### 3. Chat with Downloaded Documents

#### Ask Questions
```
"What are the main safety requirements?"
"Find information about emergency procedures"
"Summarize the reactor specifications"
```

#### Search in Documents
```
"Search for cooling system in downloaded files"
"Find emergency response procedures"
```

### 4. Cache Management

#### View Downloaded Documents
```
"Show downloaded documents"
"List cached files"
```

#### Clear Cache
```
"Clear cache"
"Delete downloaded files"
```

## 🧠 RAG Configuration (Optional)

RAG enables semantic search instead of simple keyword matching. See [API_SETUP.md](API_SETUP.md) for detailed instructions.

### Quick Setup

#### Option 1: OpenAI (Recommended)
- Best accuracy with vector embeddings
- Cost: ~$0.10-$0.50 per 100 documents
- Get key: https://platform.openai.com/api-keys

#### Option 2: Claude/Anthropic
- No additional signup if you have Claude account
- Direct relevance scoring without embeddings
- Get key: https://console.anthropic.com

#### Option 3: No API Key
- Works with keyword search
- Free but less accurate
- Good for exact term matching

### Performance Comparison

| Method | Accuracy | Speed | Cost |
|--------|----------|-------|------|
| OpenAI Embeddings | 95% | Fast | $0.0001/1K tokens |
| Claude Analysis | 85% | Medium | $0.25/1M tokens |
| Keyword Search | 60% | Fastest | Free |

## 🛠 Development

```bash
# Development mode
npm run dev

# Run tests
npm test

# Lint check
npm run lint

# Build
npm run build
```

## 📋 Commands Reference

### Search Commands
- `search_adams`: Search NRC ADAMS database
- `download_adams_documents`: Download documents from search results

### Document Commands
- `ask_about_documents`: Query downloaded documents
- `list_downloaded_documents`: Show cached documents
- `clear_cache`: Remove all downloaded documents

## 🔧 Troubleshooting

### Documents not downloading?
- Check network connection
- Verify document availability on ADAMS
- Some documents may be restricted

### Search not accurate?
- Add API key for RAG features
- Use more specific keywords
- Check API_SETUP.md for configuration

### Cache full?
- Automatic LRU eviction after 50 documents
- Use "clear cache" to manually clean

## 📝 Notes

- Maximum 50 documents in cache (LRU)
- Documents are text-extracted for searching
- PDF parsing may fail for scanned/image PDFs
- Search results limited to 100 per query

## 📄 License

MIT License