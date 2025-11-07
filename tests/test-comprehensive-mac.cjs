#!/usr/bin/env node

/**
 * Comprehensive macOS Integration Test
 * Tests all MCP tools and edge cases
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ComprehensiveTester {
  constructor() {
    this.server = null;
    this.requestId = 1;
    this.responses = new Map();
    this.testResults = [];
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
        buffer = lines.pop();

        lines.forEach(line => {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.id) {
                this.responses.set(response.id, response);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        });
      });

      setTimeout(resolve, 1000);
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
    for (let i = 0; i < 150; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (this.responses.has(id)) {
        return this.responses.get(id);
      }
    }

    throw new Error(`Timeout waiting for response to ${method}`);
  }

  recordResult(category, test, passed, details = '') {
    this.testResults.push({ category, test, passed, details });
    const emoji = passed ? '✅' : '❌';
    console.log(`   ${emoji} ${test}`);
    if (details && !passed) {
      console.log(`      ${details}`);
    }
  }

  stop() {
    if (this.server) {
      this.server.kill();
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));

    const categories = {};
    this.testResults.forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = { total: 0, passed: 0 };
      }
      categories[result.category].total++;
      if (result.passed) categories[result.category].passed++;
    });

    Object.keys(categories).forEach(cat => {
      const { passed, total } = categories[cat];
      const percentage = ((passed / total) * 100).toFixed(0);
      console.log(`${cat}: ${passed}/${total} (${percentage}%)`);
    });

    const totalPassed = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const totalPercentage = ((totalPassed / totalTests) * 100).toFixed(0);

    console.log('='.repeat(70));
    console.log(`OVERALL: ${totalPassed}/${totalTests} (${totalPercentage}%)`);
    console.log('='.repeat(70) + '\n');
  }
}

async function runTests() {
  const tester = new ComprehensiveTester();
  console.log('\n🔬 Comprehensive macOS Integration Test\n');

  try {
    // ========================================
    // 1. MCP Protocol Tests
    // ========================================
    console.log('1️⃣  MCP Protocol Tests');
    await tester.start();

    const initResponse = await tester.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'comprehensive-test', version: '1.0' }
    });

    tester.recordResult(
      'MCP Protocol',
      'Initialize connection',
      initResponse.result && initResponse.result.serverInfo
    );

    const toolsResponse = await tester.sendRequest('tools/list');
    const tools = toolsResponse.result?.tools || [];

    tester.recordResult(
      'MCP Protocol',
      'List tools (expect 6)',
      tools.length === 6,
      tools.length !== 6 ? `Found ${tools.length} tools` : ''
    );

    const expectedTools = [
      'search_adams',
      'download_adams_documents',
      'ask_about_documents',
      'list_downloaded_documents',
      'clear_cache',
      'get_system_stats'
    ];

    expectedTools.forEach(toolName => {
      const found = tools.find(t => t.name === toolName);
      tester.recordResult(
        'MCP Protocol',
        `Tool registered: ${toolName}`,
        !!found
      );
    });

    // ========================================
    // 2. Search Tests (Various Keywords)
    // ========================================
    console.log('\n2️⃣  ADAMS Search Tests');

    const searchQueries = [
      { query: 'reactor safety analysis', expected: 'ML' },
      { query: 'emergency preparedness', expected: 'ML' },
      { query: 'radiation protection', expected: 'ML' },
      { query: 'licensing review', expected: 'ML' },
      { query: 'inspection report 2024', expected: 'ML' }
    ];

    for (const { query, expected } of searchQueries) {
      const searchResp = await tester.sendRequest('tools/call', {
        name: 'search_adams',
        arguments: { query, maxResults: 5 }
      });

      const content = searchResp.result?.content?.[0]?.text || '';
      const foundDocs = content.match(/Found (\d+) documents/)?.[1];
      const hasMLDocs = content.includes(expected);

      tester.recordResult(
        'ADAMS Search',
        `Search "${query.substring(0, 20)}..." (${foundDocs} docs)`,
        foundDocs > 0 && hasMLDocs,
        !hasMLDocs ? 'No ML documents found' : ''
      );

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // ========================================
    // 3. Download Tests
    // ========================================
    console.log('\n3️⃣  Document Download Tests');

    // Small batch download
    const downloadResp1 = await tester.sendRequest('tools/call', {
      name: 'download_adams_documents',
      arguments: { count: 2 }
    });

    const downloadContent1 = downloadResp1.result?.content?.[0]?.text || '';
    const successCount1 = downloadContent1.match(/Successfully downloaded: (\d+)/)?.[1];

    tester.recordResult(
      'Download',
      'Download 2 documents',
      successCount1 >= 1,
      successCount1 === '0' ? 'No documents downloaded' : ''
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check file system
    const pdfDirs = fs.readdirSync('downloaded_pdfs').filter(d =>
      d !== '.DS_Store' && fs.statSync(path.join('downloaded_pdfs', d)).isDirectory()
    );

    tester.recordResult(
      'Download',
      'PDF directory created',
      pdfDirs.length > 0
    );

    if (pdfDirs.length > 0) {
      const latestDir = pdfDirs.sort().reverse()[0];
      const pdfFiles = fs.readdirSync(path.join('downloaded_pdfs', latestDir))
        .filter(f => f.endsWith('.pdf'));

      tester.recordResult(
        'Download',
        `PDF files saved (${pdfFiles.length} files)`,
        pdfFiles.length > 0
      );

      // Check cache files
      const cacheFiles = fs.readdirSync('pdf-text-cache')
        .filter(f => f.endsWith('.txt') && pdfFiles.some(pdf => f.includes(pdf.replace('.pdf', ''))));

      tester.recordResult(
        'Download',
        `Text cache created (${cacheFiles.length} files)`,
        cacheFiles.length === pdfFiles.length
      );
    }

    // ========================================
    // 4. Document Management Tests
    // ========================================
    console.log('\n4️⃣  Document Management Tests');

    const listResp = await tester.sendRequest('tools/call', {
      name: 'list_downloaded_documents',
      arguments: {}
    });

    const listContent = listResp.result?.content?.[0]?.text || '';
    const totalDocs = listContent.match(/Total: (\d+) documents/)?.[1];

    tester.recordResult(
      'Document Management',
      `List documents (${totalDocs} total)`,
      totalDocs > 0,
      totalDocs === '0' ? 'No documents in cache' : ''
    );

    // Get stats
    const statsResp = await tester.sendRequest('tools/call', {
      name: 'get_system_stats',
      arguments: {}
    });

    const statsContent = statsResp.result?.content?.[0]?.text || '';
    const hasStats = statsContent.includes('Cache:') && statsContent.includes('Memory:');

    tester.recordResult(
      'Document Management',
      'Get system statistics',
      hasStats
    );

    // ========================================
    // 5. RAG Q&A Tests (without API key)
    // ========================================
    console.log('\n5️⃣  RAG Q&A Tests');

    const qaResp = await tester.sendRequest('tools/call', {
      name: 'ask_about_documents',
      arguments: { question: 'What is the main topic?' }
    });

    const qaContent = qaResp.result?.content?.[0]?.text || '';
    const isApiKeyError = qaContent.includes('RAG engine not enabled') ||
                          qaContent.includes('OPENAI_API_KEY');

    tester.recordResult(
      'RAG Q&A',
      'API key requirement check',
      isApiKeyError,
      !isApiKeyError ? 'Expected API key error message' : ''
    );

    // ========================================
    // 6. Error Handling Tests
    // ========================================
    console.log('\n6️⃣  Error Handling Tests');

    // Invalid search query
    const emptySearchResp = await tester.sendRequest('tools/call', {
      name: 'search_adams',
      arguments: { query: '', maxResults: 5 }
    });

    tester.recordResult(
      'Error Handling',
      'Empty search query handling',
      emptySearchResp.result || emptySearchResp.error
    );

    // Invalid download count
    const invalidDownloadResp = await tester.sendRequest('tools/call', {
      name: 'download_adams_documents',
      arguments: { count: -1 }
    });

    tester.recordResult(
      'Error Handling',
      'Invalid download count handling',
      invalidDownloadResp.result || invalidDownloadResp.error
    );

    // Download without search
    // First clear state by restarting
    tester.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await tester.start();
    await tester.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' }
    });

    const noSearchDownloadResp = await tester.sendRequest('tools/call', {
      name: 'download_adams_documents',
      arguments: { count: 1 }
    });

    const noSearchContent = noSearchDownloadResp.result?.content?.[0]?.text || '';
    const hasNoSearchError = noSearchContent.includes('No search results') ||
                             noSearchContent.includes('search first');

    tester.recordResult(
      'Error Handling',
      'Download without prior search',
      hasNoSearchError,
      !hasNoSearchError ? 'Should warn about missing search' : ''
    );

    // ========================================
    // 7. Cache Management Tests
    // ========================================
    console.log('\n7️⃣  Cache Management Tests');

    // Get initial cache size
    const statsBeforeClear = await tester.sendRequest('tools/call', {
      name: 'get_system_stats',
      arguments: {}
    });

    const contentBefore = statsBeforeClear.result?.content?.[0]?.text || '';
    const cacheBefore = contentBefore.match(/Cache: (\d+)\/\d+/)?.[1];

    // Clear cache (without confirm - should not clear)
    const clearRespNo = await tester.sendRequest('tools/call', {
      name: 'clear_cache',
      arguments: { confirm: false }
    });

    const clearContentNo = clearRespNo.result?.content?.[0]?.text || '';
    const notCleared = clearContentNo.includes('confirm: true') ||
                       clearContentNo.includes('not cleared');

    tester.recordResult(
      'Cache Management',
      'Clear cache without confirm (should refuse)',
      notCleared
    );

    // Clear cache with confirm
    const clearRespYes = await tester.sendRequest('tools/call', {
      name: 'clear_cache',
      arguments: { confirm: true }
    });

    const clearContentYes = clearRespYes.result?.content?.[0]?.text || '';
    const wasCleared = clearContentYes.includes('cleared') ||
                       clearContentYes.includes('deleted');

    tester.recordResult(
      'Cache Management',
      'Clear cache with confirm',
      wasCleared
    );

    // Verify cache is empty
    const statsAfterClear = await tester.sendRequest('tools/call', {
      name: 'get_system_stats',
      arguments: {}
    });

    const contentAfter = statsAfterClear.result?.content?.[0]?.text || '';
    const cacheAfter = contentAfter.match(/Cache: (\d+)\/\d+/)?.[1];

    tester.recordResult(
      'Cache Management',
      `Cache cleared (${cacheBefore} → ${cacheAfter})`,
      parseInt(cacheAfter) === 0
    );

    // ========================================
    // 8. Performance Tests
    // ========================================
    console.log('\n8️⃣  Performance Tests');

    // Search speed
    const searchStart = Date.now();
    await tester.sendRequest('tools/call', {
      name: 'search_adams',
      arguments: { query: 'reactor safety', maxResults: 10 }
    });
    const searchTime = Date.now() - searchStart;

    tester.recordResult(
      'Performance',
      `Search speed (${(searchTime / 1000).toFixed(1)}s < 30s)`,
      searchTime < 30000
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Download speed (2 docs)
    const downloadStart = Date.now();
    await tester.sendRequest('tools/call', {
      name: 'download_adams_documents',
      arguments: { count: 2 }
    });
    const downloadTime = Date.now() - downloadStart;

    tester.recordResult(
      'Performance',
      `Download speed (${(downloadTime / 1000).toFixed(1)}s < 60s for 2 docs)`,
      downloadTime < 60000
    );

    // Stats response time
    const statsStart = Date.now();
    await tester.sendRequest('tools/call', {
      name: 'get_system_stats',
      arguments: {}
    });
    const statsTime = Date.now() - statsStart;

    tester.recordResult(
      'Performance',
      `Stats response (${statsTime}ms < 1000ms)`,
      statsTime < 1000
    );

    // ========================================
    // Print Summary
    // ========================================
    tester.printSummary();

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
  } finally {
    tester.stop();
  }
}

runTests().catch(console.error);
