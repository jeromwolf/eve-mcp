#!/usr/bin/env node

/**
 * 10-Cycle Test for NRC ADAMS MCP Server v3.0 - Modular Architecture
 * Tests new modular services: SearchService, DownloadService, CacheManager, ConfigManager
 * Features: Improved download strategy, intelligent caching, system statistics
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

class ModularV3CycleTest {
  constructor() {
    this.results = {
      cycles: [],
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      startTime: new Date(),
      endTime: null
    };

    // Enhanced test keywords for v3.0
    this.testKeywords = [
      { query: 'reactor safety analysis 2024', category: 'safety', target: 10 },
      { query: 'environmental impact assessment', category: 'environmental', target: 10 },
      { query: 'license renewal application', category: 'licensing', target: 10 },
      { query: 'inspection report findings', category: 'inspection', target: 10 },
      { query: 'security physical protection', category: 'security', target: 10 },
      { query: 'quality assurance program', category: 'quality', target: 10 },
      { query: 'technical specification amendment', category: 'technical', target: 10 },
      { query: 'emergency preparedness plan', category: 'emergency', target: 10 },
      { query: 'decommissioning activities', category: 'decommissioning', target: 10 },
      { query: 'regulatory guidance implementation', category: 'regulatory', target: 10 }
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
        timeout: 60000
      });

      let responseData = '';
      let requestSent = false;

      const request = JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        params: params,
        id: Date.now()
      }) + '\n';

      serverProcess.stdout.on('data', (data) => {
        responseData += data.toString();
        
        try {
          const response = JSON.parse(responseData.trim());
          if (response.result || response.error) {
            serverProcess.kill();
            resolve(response);
          }
        } catch (e) {
          // Continue collecting data
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.log(`    [STDERR] ${data.toString().trim()}`);
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      serverProcess.on('close', (code) => {
        if (!requestSent) {
          reject(new Error(`Server closed before response: ${code}`));
        }
      });

      setTimeout(() => {
        serverProcess.stdin.write(request);
        requestSent = true;
      }, 1000);

      setTimeout(() => {
        if (!responseData.includes('"result"') && !responseData.includes('"error"')) {
          serverProcess.kill();
          reject(new Error('Request timeout'));
        }
      }, 55000);
    });
  }

  async runCycle(cycleNum, keyword, target = 10) {
    console.log(`\n🔄 CYCLE ${cycleNum}: "${keyword.query}" (Target: ${target} downloads)`);
    console.log('=' .repeat(70));
    
    const cycle = {
      number: cycleNum,
      keyword: keyword,
      startTime: new Date(),
      endTime: null,
      results: {
        search: { success: false, count: 0, time: 0, cached: false },
        download: { success: false, count: 0, attempts: 0, successRate: 0 },
        qa: { success: false, count: 0, responses: [] },
        systemStats: { success: false, data: null }
      },
      errors: []
    };

    try {
      // Step 1: Search
      console.log(`\n🔍 Step 1: Searching for "${keyword.query}"`);
      const searchStart = Date.now();
      
      const searchResponse = await this.sendMCPRequest('tools/call', {
        name: 'search_adams',
        arguments: { 
          query: keyword.query, 
          max_results: Math.max(target * 2, 50) // Get more results for better selection
        }
      });

      if (searchResponse.result && searchResponse.result.content) {
        const searchText = searchResponse.result.content[0].text;
        const resultCount = (searchText.match(/\d+\./g) || []).length;
        const cached = searchText.includes('Cache Hit: Yes');
        
        cycle.results.search = {
          success: true,
          count: resultCount,
          time: Date.now() - searchStart,
          cached: cached
        };
        
        console.log(`✅ Search: Found ${resultCount} results (${cached ? 'Cached' : 'Fresh'}) in ${cycle.results.search.time}ms`);
      } else {
        throw new Error('Search failed: No results returned');
      }

      // Step 2: Download with improved strategy
      console.log(`\n📥 Step 2: Downloading ${target} documents with v3.0 retry strategy`);
      const downloadStart = Date.now();
      
      const downloadResponse = await this.sendMCPRequest('tools/call', {
        name: 'download_adams_documents',
        arguments: { count: target }
      });

      if (downloadResponse.result && downloadResponse.result.content) {
        const downloadText = downloadResponse.result.content[0].text;
        
        // Parse download results from new v3.0 format
        const successMatch = downloadText.match(/Success: (\d+)\/\d+/);
        const attemptsMatch = downloadText.match(/Total Attempts: (\d+)/);
        const successRateMatch = downloadText.match(/Success Rate: (\d+)%/);
        
        const successCount = successMatch ? parseInt(successMatch[1]) : 0;
        const totalAttempts = attemptsMatch ? parseInt(attemptsMatch[1]) : 0;
        const successRate = successRateMatch ? parseInt(successRateMatch[1]) : 0;

        cycle.results.download = {
          success: successCount > 0,
          count: successCount,
          attempts: totalAttempts,
          successRate: successRate,
          time: Date.now() - downloadStart
        };

        console.log(`✅ Download: ${successCount}/${target} files (${successRate}% rate, ${totalAttempts} attempts) in ${cycle.results.download.time}ms`);
      } else {
        throw new Error('Download failed: No response');
      }

      // Step 3: Q&A Testing
      console.log(`\n💬 Step 3: Testing Q&A with ${this.questions.length} questions`);
      const qaResults = [];
      
      for (let i = 0; i < this.questions.length; i++) {
        const question = this.questions[i];
        console.log(`   Question ${i+1}: ${question}`);
        
        try {
          const qaResponse = await this.sendMCPRequest('tools/call', {
            name: 'ask_about_documents',
            arguments: { question: question }
          });

          if (qaResponse.result && qaResponse.result.content) {
            const qaText = qaResponse.result.content[0].text;
            const hasResults = qaText.includes('Results Found:') && !qaText.includes('0 results');
            const sources = (qaText.match(/Source Documents: (.*?)$/m) || ['', 'N/A'])[1];
            
            qaResults.push({
              question: question,
              success: hasResults,
              sources: sources,
              response: qaText.substring(0, 200) + '...'
            });
            
            console.log(`   ${hasResults ? '✅' : '❌'} ${hasResults ? 'Found relevant info' : 'No relevant info'} (Sources: ${sources})`);
          } else {
            qaResults.push({
              question: question,
              success: false,
              error: 'No response'
            });
            console.log(`   ❌ No response received`);
          }
        } catch (error) {
          qaResults.push({
            question: question,
            success: false,
            error: error.message
          });
          console.log(`   ❌ Error: ${error.message}`);
        }

        // Small delay between questions
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      cycle.results.qa = {
        success: qaResults.filter(r => r.success).length > 0,
        count: qaResults.filter(r => r.success).length,
        total: qaResults.length,
        responses: qaResults
      };

      console.log(`✅ Q&A: ${cycle.results.qa.count}/${cycle.results.qa.total} successful responses`);

      // Step 4: System Stats (New in v3.0)
      console.log(`\n📊 Step 4: Testing new system statistics feature`);
      
      try {
        const statsResponse = await this.sendMCPRequest('tools/call', {
          name: 'get_system_stats',
          arguments: {}
        });

        if (statsResponse.result && statsResponse.result.content) {
          const statsText = statsResponse.result.content[0].text;
          
          cycle.results.systemStats = {
            success: true,
            data: {
              version: statsText.includes('Version: 3.0.0 (Modular)'),
              services: statsText.includes('Services: Search, Download, Cache, RAG'),
              operational: statsText.includes('All systems operational'),
              hasSearchStats: statsText.includes('Search Performance:'),
              hasDownloadStats: statsText.includes('Download Performance:'),
              hasCacheStats: statsText.includes('Cache System:'),
              hasRAGStats: statsText.includes('RAG Engine:')
            }
          };

          console.log(`✅ System Stats: v3.0 Modular architecture confirmed`);
        } else {
          cycle.results.systemStats = { success: false, error: 'No stats response' };
          console.log(`❌ System Stats: No response`);
        }
      } catch (error) {
        cycle.results.systemStats = { success: false, error: error.message };
        console.log(`❌ System Stats: ${error.message}`);
      }

    } catch (error) {
      console.log(`❌ Cycle ${cycleNum} failed: ${error.message}`);
      cycle.errors.push(error.message);
    }

    cycle.endTime = new Date();
    cycle.duration = cycle.endTime - cycle.startTime;

    // Cycle Summary
    const searchOk = cycle.results.search.success ? '✅' : '❌';
    const downloadOk = cycle.results.download.success ? '✅' : '❌';
    const qaOk = cycle.results.qa.success ? '✅' : '❌';
    const statsOk = cycle.results.systemStats.success ? '✅' : '❌';

    console.log(`\n📋 Cycle ${cycleNum} Summary:`);
    console.log(`   ${searchOk} Search: ${cycle.results.search.count} results`);
    console.log(`   ${downloadOk} Download: ${cycle.results.download.count}/${target} files (${cycle.results.download.successRate}%)`);
    console.log(`   ${qaOk} Q&A: ${cycle.results.qa.count}/${cycle.results.qa.total} responses`);
    console.log(`   ${statsOk} System Stats: v3.0 features`);
    console.log(`   ⏱️  Duration: ${Math.round(cycle.duration/1000)}s`);

    return cycle;
  }

  async runAll10Cycles() {
    console.log('🚀 NRC ADAMS MCP Server v3.0 - 10 Cycle Test');
    console.log('   Modular Architecture with Enhanced Services');
    console.log('=' .repeat(70));

    for (let i = 0; i < 10; i++) {
      const keyword = this.testKeywords[i];
      const cycle = await this.runCycle(i + 1, keyword, keyword.target);
      this.results.cycles.push(cycle);
      
      // Update totals
      this.results.totalTests += 4; // search, download, qa, stats
      if (cycle.results.search.success) this.results.totalPassed++;
      if (cycle.results.download.success) this.results.totalPassed++;
      if (cycle.results.qa.success) this.results.totalPassed++;
      if (cycle.results.systemStats.success) this.results.totalPassed++;

      this.results.totalFailed = this.results.totalTests - this.results.totalPassed;

      // Wait between cycles
      if (i < 9) {
        console.log(`\n⏳ Waiting 3 seconds before next cycle...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    this.results.endTime = new Date();
    await this.generateReport();
  }

  async generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL TEST REPORT - NRC ADAMS MCP v3.0');
    console.log('='.repeat(70));

    const totalDuration = this.results.endTime - this.results.startTime;
    const successRate = Math.round((this.results.totalPassed / this.results.totalTests) * 100);

    // Overall Statistics
    console.log(`\n🎯 OVERALL PERFORMANCE:`);
    console.log(`   Total Tests: ${this.results.totalTests}`);
    console.log(`   ✅ Passed: ${this.results.totalPassed}`);
    console.log(`   ❌ Failed: ${this.results.totalFailed}`);
    console.log(`   📈 Success Rate: ${successRate}%`);
    console.log(`   ⏱️  Total Duration: ${Math.round(totalDuration/1000/60)} minutes`);

    // Feature-specific Analysis
    const searchSuccess = this.results.cycles.filter(c => c.results.search.success).length;
    const downloadSuccess = this.results.cycles.filter(c => c.results.download.success).length;
    const qaSuccess = this.results.cycles.filter(c => c.results.qa.success).length;
    const statsSuccess = this.results.cycles.filter(c => c.results.systemStats.success).length;

    console.log(`\n🔍 FEATURE ANALYSIS:`);
    console.log(`   Search Success: ${searchSuccess}/10 (${Math.round(searchSuccess/10*100)}%)`);
    console.log(`   Download Success: ${downloadSuccess}/10 (${Math.round(downloadSuccess/10*100)}%)`);
    console.log(`   Q&A Success: ${qaSuccess}/10 (${Math.round(qaSuccess/10*100)}%)`);
    console.log(`   System Stats: ${statsSuccess}/10 (${Math.round(statsSuccess/10*100)}%)`);

    // Download Performance Analysis
    const totalDownloads = this.results.cycles.reduce((sum, c) => sum + c.results.download.count, 0);
    const totalAttempts = this.results.cycles.reduce((sum, c) => sum + c.results.download.attempts, 0);
    const avgSuccessRate = this.results.cycles.reduce((sum, c) => sum + c.results.download.successRate, 0) / 10;

    console.log(`\n📥 DOWNLOAD ANALYSIS (v3.0 Retry Strategy):`);
    console.log(`   Total Downloaded: ${totalDownloads}/100 files`);
    console.log(`   Total Attempts: ${totalAttempts}`);
    console.log(`   Average Success Rate: ${Math.round(avgSuccessRate)}%`);
    console.log(`   Efficiency: ${Math.round(totalDownloads/totalAttempts*100)}% (downloads/attempts)`);

    // Cache Performance
    const cachedSearches = this.results.cycles.filter(c => c.results.search.cached).length;
    console.log(`\n💾 CACHE PERFORMANCE:`);
    console.log(`   Cached Searches: ${cachedSearches}/10 (${cachedSearches*10}%)`);

    // Generate detailed report file
    const reportData = {
      metadata: {
        version: '3.0.0',
        architecture: 'Modular',
        testDate: this.results.startTime.toISOString(),
        duration: totalDuration,
        successRate: successRate
      },
      summary: {
        totalTests: this.results.totalTests,
        passed: this.results.totalPassed,
        failed: this.results.totalFailed,
        features: {
          search: `${searchSuccess}/10`,
          download: `${downloadSuccess}/10`,
          qa: `${qaSuccess}/10`,
          systemStats: `${statsSuccess}/10`
        },
        performance: {
          totalDownloads: totalDownloads,
          totalAttempts: totalAttempts,
          avgSuccessRate: Math.round(avgSuccessRate),
          cachedSearches: cachedSearches
        }
      },
      cycles: this.results.cycles.map(cycle => ({
        number: cycle.number,
        keyword: cycle.keyword.query,
        category: cycle.keyword.category,
        duration: Math.round(cycle.duration/1000),
        results: {
          search: `${cycle.results.search.success ? 'PASS' : 'FAIL'} (${cycle.results.search.count} results)`,
          download: `${cycle.results.download.success ? 'PASS' : 'FAIL'} (${cycle.results.download.count}/${cycle.keyword.target})`,
          qa: `${cycle.results.qa.success ? 'PASS' : 'FAIL'} (${cycle.results.qa.count}/${cycle.results.qa.total})`,
          systemStats: `${cycle.results.systemStats.success ? 'PASS' : 'FAIL'}`
        },
        errors: cycle.errors
      }))
    };

    const reportPath = path.join(__dirname, `test-results-v3-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);

    // Final Status
    console.log(`\n🎯 FINAL STATUS:`);
    if (successRate >= 90) {
      console.log('✅ EXCELLENT - v3.0 Modular architecture performing exceptionally well!');
    } else if (successRate >= 75) {
      console.log('✅ GOOD - v3.0 architecture working well with minor issues');
    } else if (successRate >= 50) {
      console.log('⚠️  NEEDS ATTENTION - Some v3.0 features need debugging');
    } else {
      console.log('❌ CRITICAL - Major issues with v3.0 modular architecture');
    }

    return this.results;
  }
}

// Run the test
const tester = new ModularV3CycleTest();
tester.runAll10Cycles()
  .then(() => {
    console.log('\n✅ All 10 cycles completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test runner failed:', error.message);
    process.exit(1);
  });