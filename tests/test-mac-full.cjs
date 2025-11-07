#!/usr/bin/env node

/**
 * macOS Full Integration Test
 * Tests: Search → Download → RAG Q&A
 */

const { spawn } = require('child_process');

class MCPTester {
  constructor() {
    this.server = null;
    this.requestId = 1;
    this.responses = new Map();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = spawn('node', ['build/index.js'], {
        cwd: process.cwd()
      });

      let buffer = '';

      this.server.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        lines.forEach(line => {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.id) {
                this.responses.set(response.id, response);
              }
            } catch (e) {
              console.error('Parse error:', e.message, 'Line:', line);
            }
          }
        });
      });

      this.server.stderr.on('data', (data) => {
        console.error('STDERR:', data.toString());
      });

      setTimeout(resolve, 1000); // Wait for server to start
    });
  }

  async sendRequest(method, params = {}) {
    const id = this.requestId++;
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    this.server.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (this.responses.has(id)) {
        return this.responses.get(id);
      }
    }

    throw new Error(`Timeout waiting for response to ${method}`);
  }

  stop() {
    if (this.server) {
      this.server.kill();
    }
  }
}

async function runTests() {
  const tester = new MCPTester();
  console.log('\n🚀 Starting macOS Full Integration Test\n');

  try {
    // Start server
    console.log('1️⃣  Starting MCP server...');
    await tester.start();

    // Initialize
    console.log('2️⃣  Initializing MCP connection...');
    const initResponse = await tester.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-mac', version: '1.0' }
    });
    console.log('   ✅ Connected:', initResponse.result.serverInfo.name);

    // Test 1: Search with different queries
    console.log('\n3️⃣  Testing ADAMS Search (3 different queries)...');

    const queries = [
      'nuclear safety',
      'reactor inspection',
      'emergency preparedness'
    ];

    for (const query of queries) {
      console.log(`   🔍 Searching: "${query}"`);
      const searchResponse = await tester.sendRequest('tools/call', {
        name: 'search_adams',
        arguments: { query, maxResults: 5 }
      });

      if (searchResponse.result && searchResponse.result.content) {
        const content = searchResponse.result.content[0].text;
        const matches = content.match(/Found (\d+) documents/);
        const count = matches ? matches[1] : '?';
        console.log(`   ✅ Found ${count} documents`);

        // Show first document
        const docMatch = content.match(/\d+\.\s+\*\*(ML\w+)\*\*/);
        if (docMatch) {
          console.log(`   📄 First doc: ${docMatch[1]}`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 2: Download documents
    console.log('\n4️⃣  Testing Document Download...');
    console.log('   ⬇️  Downloading top 3 documents from last search...');
    const downloadResponse = await tester.sendRequest('tools/call', {
      name: 'download_adams_documents',
      arguments: { count: 3 }
    });

    if (downloadResponse.result && downloadResponse.result.content) {
      const content = downloadResponse.result.content[0].text;
      const successMatch = content.match(/Successfully downloaded: (\d+)/);
      const successCount = successMatch ? successMatch[1] : '0';
      console.log(`   ✅ Downloaded ${successCount} documents`);

      // Extract document numbers
      const docNumbers = [...content.matchAll(/✅\s+(ML\w+)/g)].map(m => m[1]);
      console.log('   📄 Documents:', docNumbers.join(', '));
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: List downloaded documents
    console.log('\n5️⃣  Testing Document List...');
    const listResponse = await tester.sendRequest('tools/call', {
      name: 'list_downloaded_documents',
      arguments: {}
    });

    if (listResponse.result && listResponse.result.content) {
      const content = listResponse.result.content[0].text;
      const totalMatch = content.match(/Total: (\d+) documents/);
      const total = totalMatch ? totalMatch[1] : '0';
      console.log(`   ✅ Total documents in cache: ${total}`);
    }

    // Test 4: RAG Q&A
    console.log('\n6️⃣  Testing RAG Q&A...');

    const questions = [
      'What is the main topic of these documents?',
      'Are there any safety concerns mentioned?',
      'What recommendations are provided?'
    ];

    for (const question of questions) {
      console.log(`   ❓ Question: "${question}"`);
      const qaResponse = await tester.sendRequest('tools/call', {
        name: 'ask_about_documents',
        arguments: { question }
      });

      if (qaResponse.result && qaResponse.result.content) {
        const content = qaResponse.result.content[0].text;

        // Check if answer exists
        if (content.includes('Answer:') || content.includes('답변:')) {
          console.log('   ✅ Answer received');

          // Show first 100 chars of answer
          const answerMatch = content.match(/(?:Answer:|답변:)\s*(.+)/s);
          if (answerMatch) {
            const answer = answerMatch[1].trim().substring(0, 150);
            console.log(`   💬 "${answer}..."`);
          }

          // Check for citations
          const citations = content.match(/\[ML\w+\]/g);
          if (citations) {
            console.log(`   📚 Citations: ${citations.slice(0, 3).join(', ')}`);
          }
        } else {
          console.log('   ⚠️  No answer found');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 5: System stats
    console.log('\n7️⃣  Testing System Statistics...');
    const statsResponse = await tester.sendRequest('tools/call', {
      name: 'get_system_stats',
      arguments: {}
    });

    if (statsResponse.result && statsResponse.result.content) {
      const content = statsResponse.result.content[0].text;
      console.log('   ✅ Stats retrieved');

      // Extract key metrics
      const cacheMatch = content.match(/Cache: (\d+)\/(\d+)/);
      const ragMatch = content.match(/RAG Documents: (\d+)/);

      if (cacheMatch) {
        console.log(`   📊 Cache: ${cacheMatch[1]}/${cacheMatch[2]} documents`);
      }
      if (ragMatch) {
        console.log(`   📊 RAG indexed: ${ragMatch[1]} documents`);
      }
    }

    console.log('\n✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    tester.stop();
  }
}

runTests().catch(console.error);
