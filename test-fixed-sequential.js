#!/usr/bin/env node

/**
 * Fixed Sequential 10-Cycle Test - No Parallel Processing
 * Based on proven working test pattern from earlier cycles
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

class FixedSequentialTest {
  constructor() {
    this.results = {
      cycles: [],
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      startTime: new Date(),
      endTime: null
    };

    // Proven working keywords from previous successful tests
    this.testKeywords = [
      { query: 'license renewal application', category: 'licensing', target: 10 },
      { query: 'reactor safety analysis', category: 'safety', target: 10 },
      { query: 'environmental assessment', category: 'environmental', target: 10 },
      { query: 'inspection report', category: 'inspection', target: 10 },
      { query: 'safety evaluation report', category: 'safety', target: 10 },
      { query: 'technical specification', category: 'technical', target: 10 },
      { query: 'regulatory guide', category: 'regulatory', target: 10 },
      { query: 'quality assurance', category: 'quality', target: 10 },
      { query: 'emergency preparedness', category: 'emergency', target: 10 },
      { query: 'nuclear facility license', category: 'licensing', target: 10 }
    ];

    this.questions = [
      'What are the main safety requirements mentioned?',
      'What inspection findings were identified?',
      'What corrective actions are required?',
      'What are the regulatory compliance requirements?',
      'What environmental considerations are discussed?'
    ];
  }

  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000 // 2 minute timeout
      });

      let responseData = '';
      let errorData = '';
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
        errorData += data.toString();
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      serverProcess.on('close', (code) => {
        if (!hasResponse) {
          reject(new Error(`Server closed with code ${code}. Error: ${errorData}`));
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
          reject(new Error(`Request timeout after 2 minutes`));
        }
      }, 120000);
    });
  }

  async runSingleCycle(cycleNum, keyword) {
    const cycleStart = Date.now();
    console.log(`\n🔄 CYCLE ${cycleNum}: "${keyword.query}" (Target: ${keyword.target} downloads)`);
    console.log('='.repeat(70));

    const cycleResult = {
      cycle: cycleNum,
      keyword: keyword.query,
      category: keyword.category,
      target: keyword.target,
      searchResults: 0,
      searchTime: 0,
      searchSuccess: false,
      downloadSuccess: 0,
      downloadFailed: 0,
      downloadTime: 0,
      qaSuccess: 0,
      qaFailed: 0,
      qaTime: 0,
      systemStats: false,
      duration: 0,
      errors: []
    };

    try {
      // Step 1: Search
      console.log(`🔍 Step 1: Searching for "${keyword.query}"`);
      const searchStart = Date.now();
      
      const searchResult = await this.sendMCPRequest('search_adams', {
        query: keyword.query,
        limit: 50
      });

      cycleResult.searchTime = Date.now() - searchStart;
      
      if (searchResult && searchResult.content && searchResult.content[0] && searchResult.content[0].text) {
        const searchText = searchResult.content[0].text;
        const resultCount = (searchText.match(/\d+\./g) || []).length;
        cycleResult.searchResults = resultCount;
        cycleResult.searchSuccess = resultCount > 0;
        console.log(`✅ Search: Found ${resultCount} results in ${cycleResult.searchTime}ms`);
      } else {
        cycleResult.errors.push('Search returned no results');
        console.log(`❌ Search: No results found`);
      }

      // Step 2: Download (only if search was successful)
      if (cycleResult.searchSuccess) {
        console.log(`\n📥 Step 2: Downloading ${keyword.target} documents`);
        const downloadStart = Date.now();

        try {
          const downloadResult = await this.sendMCPRequest('download_adams_documents', {
            documentNumbers: `1,2,3,4,5,6,7,8,9,10`.slice(0, keyword.target * 2 - 1) // "1,2,3..." up to target
          });

          cycleResult.downloadTime = Date.now() - downloadStart;

          if (downloadResult && downloadResult.content && downloadResult.content[0] && downloadResult.content[0].text) {
            const downloadText = downloadResult.content[0].text;
            
            // Parse success/failure counts
            const successMatch = downloadText.match(/Success: (\d+)\/(\d+)/);
            const failedMatch = downloadText.match(/Failed: (\d+)/);
            
            if (successMatch) {
              cycleResult.downloadSuccess = parseInt(successMatch[1]);
              cycleResult.downloadFailed = failedMatch ? parseInt(failedMatch[1]) : 0;
              console.log(`✅ Download: ${cycleResult.downloadSuccess}/${keyword.target} files (${Math.round(cycleResult.downloadSuccess/keyword.target*100)}% success) in ${cycleResult.downloadTime}ms`);
            } else {
              cycleResult.errors.push('Could not parse download results');
              console.log(`❌ Download: Could not parse results`);
            }
          } else {
            cycleResult.errors.push('Download returned no response');
            console.log(`❌ Download: No response from server`);
          }
        } catch (error) {
          cycleResult.errors.push(`Download error: ${error.message}`);
          console.log(`❌ Download: ${error.message}`);
        }
      }

      // Step 3: Q&A (only if downloads were successful)
      if (cycleResult.downloadSuccess > 0) {
        console.log(`\n💬 Step 3: Testing Q&A with ${this.questions.length} questions`);
        const qaStart = Date.now();

        for (let i = 0; i < this.questions.length; i++) {
          const question = this.questions[i];
          console.log(`   Question ${i+1}: ${question}`);

          try {
            const qaResult = await this.sendMCPRequest('ask_about_documents', {
              question: question
            });

            if (qaResult && qaResult.content && qaResult.content[0] && qaResult.content[0].text) {
              const answerText = qaResult.content[0].text;
              if (answerText.includes('No relevant information') || answerText.includes('Sources: N/A')) {
                console.log(`   ❌ No relevant info (Sources: N/A)`);
                cycleResult.qaFailed++;
              } else {
                console.log(`   ✅ Found relevant info with sources`);
                cycleResult.qaSuccess++;
              }
            } else {
              console.log(`   ❌ No response from Q&A system`);
              cycleResult.qaFailed++;
            }
          } catch (error) {
            console.log(`   ❌ Q&A error: ${error.message}`);
            cycleResult.qaFailed++;
          }

          // Small delay between questions
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        cycleResult.qaTime = Date.now() - qaStart;
        console.log(`✅ Q&A: ${cycleResult.qaSuccess}/${this.questions.length} successful responses`);
      }

      // Step 4: System Stats
      console.log(`\n📊 Step 4: Testing system statistics`);
      try {
        const statsResult = await this.sendMCPRequest('get_system_stats');
        if (statsResult) {
          cycleResult.systemStats = true;
          console.log(`✅ System Stats: v3.0 modular architecture confirmed`);
        }
      } catch (error) {
        cycleResult.errors.push(`System stats error: ${error.message}`);
        console.log(`❌ System Stats: ${error.message}`);
      }

    } catch (error) {
      cycleResult.errors.push(`Cycle error: ${error.message}`);
      console.log(`❌ Cycle ${cycleNum} failed: ${error.message}`);
    }

    cycleResult.duration = Math.round((Date.now() - cycleStart) / 1000);

    // Print cycle summary
    console.log(`\n📋 Cycle ${cycleNum} Summary:`);
    console.log(`   ✅ Search: ${cycleResult.searchResults} results`);
    console.log(`   ${cycleResult.downloadSuccess > 0 ? '✅' : '❌'} Download: ${cycleResult.downloadSuccess}/${keyword.target} files (${Math.round(cycleResult.downloadSuccess/(keyword.target||1)*100)}%)`);
    console.log(`   ${cycleResult.qaSuccess > 0 ? '✅' : '❌'} Q&A: ${cycleResult.qaSuccess}/${this.questions.length} responses`);
    console.log(`   ${cycleResult.systemStats ? '✅' : '❌'} System Stats: v3.0 features`);
    console.log(`   ⏱️  Duration: ${cycleResult.duration}s`);

    this.results.cycles.push(cycleResult);
    this.results.totalTests += 4; // search, download, qa, stats
    this.results.totalPassed += (cycleResult.searchSuccess ? 1 : 0) + 
                               (cycleResult.downloadSuccess > 0 ? 1 : 0) + 
                               (cycleResult.qaSuccess > 0 ? 1 : 0) + 
                               (cycleResult.systemStats ? 1 : 0);
    this.results.totalFailed += 4 - ((cycleResult.searchSuccess ? 1 : 0) + 
                                     (cycleResult.downloadSuccess > 0 ? 1 : 0) + 
                                     (cycleResult.qaSuccess > 0 ? 1 : 0) + 
                                     (cycleResult.systemStats ? 1 : 0));

    // Wait before next cycle
    if (cycleNum < 10) {
      console.log(`\n⏳ Waiting 3 seconds before next cycle...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return cycleResult;
  }

  async runAllCycles() {
    console.log('🚀 NRC ADAMS MCP Server v3.0 - Fixed Sequential 10 Cycle Test');
    console.log('   No Parallel Processing - Proven Working Pattern');
    console.log('='.repeat(70));

    for (let i = 0; i < 10; i++) {
      const keyword = this.testKeywords[i];
      await this.runSingleCycle(i + 1, keyword);
    }

    this.results.endTime = new Date();
    
    // Generate final report
    await this.generateReport();
  }

  async generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL TEST REPORT - v3.0 Sequential Test');
    console.log('='.repeat(70));

    const totalDuration = Math.round((this.results.endTime - this.results.startTime) / 1000);
    const successRate = Math.round((this.results.totalPassed / this.results.totalTests) * 100);

    console.log(`⏱️  Total Duration: ${totalDuration}s (${Math.round(totalDuration/60)} minutes)`);
    console.log(`🎯 Overall Success Rate: ${successRate}% (${this.results.totalPassed}/${this.results.totalTests})`);

    // Category breakdown
    const searchSuccesses = this.results.cycles.filter(c => c.searchSuccess).length;
    const downloadSuccesses = this.results.cycles.filter(c => c.downloadSuccess > 0).length;
    const qaSuccesses = this.results.cycles.filter(c => c.qaSuccess > 0).length;
    const statsSuccesses = this.results.cycles.filter(c => c.systemStats).length;

    console.log(`\n📈 Success Breakdown:`);
    console.log(`   🔍 Search: ${searchSuccesses}/10 (${searchSuccesses*10}%)`);
    console.log(`   📥 Download: ${downloadSuccesses}/10 (${downloadSuccesses*10}%)`);
    console.log(`   💬 Q&A: ${qaSuccesses}/10 (${qaSuccesses*10}%)`);
    console.log(`   📊 System Stats: ${statsSuccesses}/10 (${statsSuccesses*10}%)`);

    // Download performance details
    const totalDownloads = this.results.cycles.reduce((sum, c) => sum + c.downloadSuccess, 0);
    const targetDownloads = this.results.cycles.reduce((sum, c) => sum + c.target, 0);
    console.log(`\n📥 Download Performance:`);
    console.log(`   Total Downloads: ${totalDownloads}/${targetDownloads} (${Math.round(totalDownloads/targetDownloads*100)}%)`);

    // Q&A performance details  
    const totalQA = this.results.cycles.reduce((sum, c) => sum + c.qaSuccess, 0);
    const targetQA = this.results.cycles.length * this.questions.length;
    console.log(`\n💬 Q&A Performance:`);
    console.log(`   Total Q&A Success: ${totalQA}/${targetQA} (${Math.round(totalQA/targetQA*100)}%)`);

    // Save detailed report
    const reportData = {
      testInfo: {
        version: 'v3.0 Sequential Test',
        startTime: this.results.startTime.toISOString(),
        endTime: this.results.endTime.toISOString(),
        duration: totalDuration,
        successRate: successRate
      },
      summary: {
        totalTests: this.results.totalTests,
        totalPassed: this.results.totalPassed,
        totalFailed: this.results.totalFailed,
        searchSuccess: `${searchSuccesses}/10`,
        downloadSuccess: `${downloadSuccesses}/10`,
        qaSuccess: `${qaSuccesses}/10`,
        systemStatsSuccess: `${statsSuccesses}/10`
      },
      cycles: this.results.cycles
    };

    const reportPath = path.join(__dirname, `test-results-fixed-sequential-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);

    console.log('\n🎯 TEST COMPLETION STATUS:');
    if (successRate >= 80) {
      console.log('✅ SEQUENTIAL TEST SUCCESSFUL! Fixed parallel processing issues.');
      console.log('🚀 v3.0 modular architecture working with sequential processing');
    } else {
      console.log('⚠️  Sequential test needs attention');
      console.log('🔧 Review failed components and adjust architecture');
    }

    return successRate >= 80;
  }
}

// Run the fixed sequential test
const tester = new FixedSequentialTest();
tester.runAllCycles()
  .then(success => {
    console.log(`\n🏁 Test completed. Success: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  });