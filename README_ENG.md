# NRC ADAMS MCP Server

Nuclear Regulatory Commission (NRC) ADAMS (Agency-wide Documents Access and Management System) document search and analysis server for Claude Desktop.

---

**📖 Documentation**
- 🚀 [5-Minute Quick Start Guide](QUICK_START_KO.md) ← **First time? Start here!** (Korean)
- 🔧 [Troubleshooting Guide](TROUBLESHOOTING.md) (Korean)
- 🇰🇷 [한국어 문서](README.md)

---

## ✨ Features

- 🔍 **Site Search**: Search documents from NRC ADAMS database
- 📥 **Auto Download**: Automatically download top 10 documents (configurable)
- 💬 **Document Chat**: Chat with downloaded documents using AI-powered search
- 🧠 **RAG Support**: Optional semantic search with OpenAI or Claude API
- 📊 **Smart Cache**: LRU cache management for up to 50 documents

## 🚀 Quick Start

### 1. Prerequisites

#### 1.1 Install Node.js 18+
```bash
# macOS (using Homebrew)
brew install node

# Or download from official site
# https://nodejs.org/
```

Verify installation:
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # npm is installed automatically
```

#### 1.2 Install Claude Desktop
- **macOS**: [claude.ai/download](https://claude.ai/download)
- **Windows**: [claude.ai/download](https://claude.ai/download)

#### 1.3 OpenAI API Key (Optional, Recommended)
- Required for RAG features (95% accuracy)
- Get key: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Cost: ~$0.10-$0.50 per 100 documents

### 2. Project Installation
```bash
# 1. Clone repository
git clone https://github.com/jeromwolf/eve-mcp.git
cd eve-mcp

# 2. Install dependencies (npm required!)
npm install

# 3. Build TypeScript
npm run build
```

Verify build:
```bash
ls build/index.js  # File should exist
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
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
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
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### 4. Restart Claude Desktop

**macOS**: `Cmd + Q` then relaunch
**Windows**: Quit from taskbar then relaunch

### 5. Verify Connection

Start a new conversation in Claude Desktop:
```
"Show me available tools"
```

You should see these tools:
- search_adams
- download_adams_documents
- ask_about_documents
- list_downloaded_documents
- clear_cache
- get_system_stats

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

#### 📁 Downloaded File Locations
Downloaded PDFs are saved at:
```
project_folder/downloaded_pdfs/search_keyword_date/ML_document_number.pdf

Example:
downloaded_pdfs/
├── emergency_plan_2025-09-30/
│   ├── ML020920623.pdf
│   ├── ML021450123.pdf
│   └── ...
└── reactor_safety_2025-10-01/
    ├── ML024270A144.pdf
    └── ...
```

**Text cache for fast search:**
```
pdf-text-cache/
├── ML020920623.txt  (80KB - extracted text)
├── ML021450123.txt
└── cache-index.json (cache index)
```

💡 **Tip**: You can open PDF files directly in Finder (macOS) or Explorer (Windows)!

### 3. Chat with Downloaded Documents

⚠️ **Important**: Wait 1-2 seconds after downloading!
- Due to MCP protocol, each request runs in a separate process
- First Q&A call automatically loads documents (takes 3-9 seconds)
- Subsequent queries are instant (1-3 seconds)

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

## 📁 Project Structure

```
nrc-adams-mcp/
├── src/                    # TypeScript source code
├── build/                  # Compiled JavaScript output
├── tests/                  # Test files and scripts
│   ├── test-comprehensive.js  # Main test suite (75% success)
│   └── auto-test.sh           # Automated testing
├── docs/                   # Documentation
│   ├── API_SETUP.md           # API configuration guide
│   └── logging_privacy_protection_guidelines.md
├── assets/                 # Screenshots and resources
├── downloaded_pdfs/        # PDF cache (gitignored)
├── test-results/           # Test outputs (gitignored)
├── logs/                   # Application logs
├── temp/                   # Temporary files (gitignored)
└── debug/                  # Debug files (gitignored)
```

## 🛠 Development

```bash
# Development mode
npm run dev

# Run tests
node tests/test-comprehensive.js     # Full test suite
./tests/auto-test.sh                 # Quick automated tests

# Run specific tests
node tests/test-simple.js            # Basic functionality
node tests/test-integration.js       # Integration tests

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