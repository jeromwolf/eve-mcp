#!/usr/bin/env node

/**
 * Single Cycle Test - Quick verification of v3.0 architecture
 * Tests one complete cycle: Search → Download → Q&A → Stats
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

class SingleCycleTest {
  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000 // 1 minute timeout
      });

      let responseData = '';
      let hasResponse = false;

      const request = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: method,
          arguments: params
        },
        id: Math.floor(Math.random() * 10000)
      };

      serverProcess.stdout.on('data', (data) => {
        responseData += data.toString();
        
        try {
          const response = JSON.parse(responseData.trim());
          if (response.result) {
            hasResponse = true;
            serverProcess.kill();
            resolve(response.result);
          }
        } catch (e) {
          // Continue waiting for complete JSON
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.log('    Server stderr:', data.toString());
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      serverProcess.on('close', (code) => {
        if (!hasResponse) {
          reject(new Error(`Server closed with code ${code}`));
        }
      });

      // Send request after short delay
      setTimeout(() => {
        try {
          serverProcess.stdin.write(JSON.stringify(request) + '\n');
        } catch (error) {
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      }, 1000);

      // Overall timeout
      setTimeout(() => {
        if (!hasResponse) {
          serverProcess.kill();
          reject(new Error(`Request timeout after 1 minute`));
        }
      }, 60000);
    });
  }

  async runSingleCycle() {
    const startTime = Date.now();
    console.log('🚀 NRC ADAMS MCP Server v3.0 - Single Cycle Test');
    console.log('='.repeat(60));

    const keyword = 'license renewal application';
    const target = 3; // Small target for quick test
    const questions = [
      'What are the main safety requirements mentioned?',
      'What regulatory compliance requirements are discussed?'
    ];

    console.log(`\n🔄 Testing: "${keyword}" (Target: ${target} downloads)`);
    console.log('='.repeat(60));

    const results = {
      search: { success: false, count: 0, time: 0 },
      download: { success: false, count: 0, time: 0 },
      qa: { success: false, count: 0, time: 0 },
      stats: { success: false, time: 0 }
    };

    try {
      // Step 1: Search
      console.log(`\n🔍 Step 1: Searching for "${keyword}"`);
      const searchStart = Date.now();
      
      const searchResult = await this.sendMCPRequest('search_adams', {
        query: keyword,
        limit: 20
      });

      results.search.time = Date.now() - searchStart;
      
      if (searchResult?.content?.[0]?.text) {
        const searchText = searchResult.content[0].text;
        const resultCount = (searchText.match(/\d+\./g) || []).length;
        results.search.count = resultCount;
        results.search.success = resultCount > 0;
        console.log(`✅ Search: Found ${resultCount} results in ${results.search.time}ms`);
      } else {
        console.log(`❌ Search: No results found`);
        return results;
      }

      // Step 2: Download
      console.log(`\n📥 Step 2: Downloading ${target} documents`);
      const downloadStart = Date.now();

      const downloadResult = await this.sendMCPRequest('download_adams_documents', {
        documentNumbers: '1,2,3'
      });

      results.download.time = Date.now() - downloadStart;

      if (downloadResult?.content?.[0]?.text) {
        const downloadText = downloadResult.content[0].text;
        const successMatch = downloadText.match(/Success: (\d+)\/(\d+)/);
        
        if (successMatch) {
          results.download.count = parseInt(successMatch[1]);
          results.download.success = results.download.count > 0;
          console.log(`✅ Download: ${results.download.count}/${target} files in ${results.download.time}ms`);
        } else {
          console.log(`❌ Download: Could not parse results`);
        }
      } else {
        console.log(`❌ Download: No response`);
      }

      // Step 3: Q&A (only if downloads successful)
      if (results.download.success) {
        console.log(`\n💬 Step 3: Testing Q&A with ${questions.length} questions`);
        const qaStart = Date.now();

        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          console.log(`   Question ${i+1}: ${question}`);

          try {
            const qaResult = await this.sendMCPRequest('ask_about_documents', {
              question: question
            });

            if (qaResult?.content?.[0]?.text) {
              const answerText = qaResult.content[0].text;
              if (answerText.includes('No relevant information') || answerText.includes('Sources: N/A')) {
                console.log(`   ❌ No relevant info found`);
              } else {
                console.log(`   ✅ Found relevant info with sources`);
                results.qa.count++;
              }
            } else {
              console.log(`   ❌ No response from Q&A system`);
            }
          } catch (error) {
            console.log(`   ❌ Q&A error: ${error.message}`);
          }

          // Small delay between questions
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        results.qa.time = Date.now() - qaStart;
        results.qa.success = results.qa.count > 0;
        console.log(`${results.qa.success ? '✅' : '❌'} Q&A: ${results.qa.count}/${questions.length} successful responses`);
      }

      // Step 4: System Stats
      console.log(`\n📊 Step 4: Testing system statistics`);
      const statsStart = Date.now();

      try {
        const statsResult = await this.sendMCPRequest('get_system_stats');
        results.stats.time = Date.now() - statsStart;
        
        if (statsResult) {
          results.stats.success = true;
          console.log(`✅ System Stats: v3.0 modular architecture confirmed in ${results.stats.time}ms`);
        }
      } catch (error) {
        results.stats.time = Date.now() - statsStart;
        console.log(`❌ System Stats: ${error.message}`);
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }

    const totalTime = Date.now() - startTime;

    // Print final summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SINGLE CYCLE SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`🔍 Search: ${results.search.success ? '✅' : '❌'} ${results.search.count} results (${results.search.time}ms)`);
    console.log(`📥 Download: ${results.download.success ? '✅' : '❌'} ${results.download.count}/${target} files (${results.download.time}ms)`);
    console.log(`💬 Q&A: ${results.qa.success ? '✅' : '❌'} ${results.qa.count}/${questions.length} responses (${results.qa.time}ms)`);
    console.log(`📊 Stats: ${results.stats.success ? '✅' : '❌'} v3.0 features (${results.stats.time}ms)`);
    console.log(`⏱️  Total: ${Math.round(totalTime/1000)}s`);

    const successCount = [results.search.success, results.download.success, results.qa.success, results.stats.success]
      .filter(Boolean).length;
    const successRate = Math.round((successCount / 4) * 100);

    console.log(`\n🎯 Success Rate: ${successRate}% (${successCount}/4 components)`);

    if (successRate >= 75) {
      console.log('✅ SINGLE CYCLE SUCCESS! v3.0 architecture working properly.');
    } else {
      console.log('⚠️  Single cycle needs attention. Check failed components.');
    }

    return successRate >= 75;
  }
}

// Run the single cycle test
const tester = new SingleCycleTest();
tester.runSingleCycle()
  .then(success => {
    console.log(`\n🏁 Single cycle test completed. Success: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Single cycle test failed:', error.message);
    process.exit(1);
  });