#!/usr/bin/env node

/**
 * MCP Protocol Timing Test
 * Measures exact timing for each MCP operation
 */

import { spawn } from 'child_process';

class MCPTimingTest {
  async measureMCPCall(method, params) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timings = {
        spawn: 0,
        firstByte: 0,
        complete: 0,
        total: 0
      };

      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      timings.spawn = Date.now() - startTime;

      let responseData = '';
      let firstByteReceived = false;

      const request = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: method,
          arguments: params
        },
        id: 1
      };

      serverProcess.stdout.on('data', (data) => {
        if (!firstByteReceived) {
          timings.firstByte = Date.now() - startTime;
          firstByteReceived = true;
        }
        responseData += data.toString();
        
        try {
          const response = JSON.parse(responseData.trim());
          if (response.result) {
            timings.complete = Date.now() - startTime;
            timings.total = timings.complete;
            serverProcess.kill();
            resolve({ success: true, timings, response });
          }
        } catch (e) {
          // Continue waiting
        }
      });

      serverProcess.on('error', (error) => {
        timings.total = Date.now() - startTime;
        resolve({ success: false, timings, error: error.message });
      });

      // Send request after 1 second
      setTimeout(() => {
        serverProcess.stdin.write(JSON.stringify(request) + '\n');
      }, 1000);

      // Timeout after 60 seconds
      setTimeout(() => {
        timings.total = Date.now() - startTime;
        serverProcess.kill();
        resolve({ success: false, timings, error: 'Timeout' });
      }, 60000);
    });
  }

  async runTests() {
    console.log('🔬 MCP Protocol Timing Analysis');
    console.log('='.repeat(50));

    // Test 1: List tools (should be fast)
    console.log('\n📋 Test 1: List Tools');
    const listResult = await this.measureMCPCall('list_downloaded_documents', {});
    console.log(`   Spawn: ${listResult.timings.spawn}ms`);
    console.log(`   First byte: ${listResult.timings.firstByte}ms`);
    console.log(`   Complete: ${listResult.timings.complete}ms`);

    // Test 2: Q&A (should be slow)
    console.log('\n🤖 Test 2: Q&A Service');
    const qaResult = await this.measureMCPCall('ask_about_documents', {
      question: 'What are the key findings?'
    });
    console.log(`   Spawn: ${qaResult.timings.spawn}ms`);
    console.log(`   First byte: ${qaResult.timings.firstByte}ms`);
    console.log(`   Complete: ${qaResult.timings.complete}ms`);

    // Analysis
    console.log('\n📊 Analysis:');
    if (qaResult.success) {
      const processingTime = qaResult.timings.firstByte - qaResult.timings.spawn - 1000;
      console.log(`   Q&A Processing: ~${Math.round(processingTime/1000)}s`);
      
      if (processingTime > 20000) {
        console.log('   ⚠️  OpenAI API is the bottleneck');
        console.log('   💡 Solutions:');
        console.log('      1. Increase chunk size (500 → 2000)');
        console.log('      2. Cache embeddings');
        console.log('      3. Use batch embedding API');
      }
    }

    return qaResult.success;
  }
}

const tester = new MCPTimingTest();
tester.runTests()
  .then(success => {
    console.log(`\n✅ Test completed. MCP working: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });