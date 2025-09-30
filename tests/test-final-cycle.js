#!/usr/bin/env node

/**
 * Final Single Cycle Test - Complete System Verification
 * Tests all components with optimized settings
 */

import { spawn } from 'child_process';

class FinalCycleTest {
  constructor() {
    this.results = {
      search: { success: false, time: 0, count: 0 },
      download: { success: false, time: 0, count: 0 },
      qa: { success: false, time: 0, responses: 0 },
      stats: { success: false, time: 0 }
    };
  }

  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
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
            const elapsed = Date.now() - startTime;
            serverProcess.kill();
            resolve({ result: response.result, time: elapsed });
          }
        } catch (e) {
          // Continue waiting
        }
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      serverProcess.on('close', (code) => {
        if (!hasResponse) {
          reject(new Error(`Server closed with code ${code}`));
        }
      });

      setTimeout(() => {
        serverProcess.stdin.write(JSON.stringify(request) + '\n');
      }, 1000);

      setTimeout(() => {
        if (!hasResponse) {
          serverProcess.kill();
          reject(new Error(`Timeout after 45 seconds`));
        }
      }, 45000);
    });
  }

  async runFullCycle() {
    console.log('🚀 FINAL SYSTEM TEST - SINGLE CYCLE');
    console.log('====================================\n');

    // 1. SEARCH TEST
    console.log('1️⃣ SEARCH TEST');
    console.log('   Query: "reactor safety analysis"');
    try {
      const searchResult = await this.sendMCPRequest('search_adams', {
        query: 'reactor safety analysis',
        maxResults: 20
      });

      const searchText = searchResult.result.content[0].text;
      const mlDocs = (searchText.match(/ML\d{8,}/g) || []);
      
      this.results.search = {
        success: mlDocs.length > 0,
        time: searchResult.time,
        count: mlDocs.length
      };

      console.log(`   ✅ Found ${mlDocs.length} ML documents (${Math.round(searchResult.time/1000)}s)`);
      console.log(`   📄 Sample: ${mlDocs.slice(0, 3).join(', ')}\n`);
    } catch (error) {
      console.log(`   ❌ Search failed: ${error.message}\n`);
    }

    // 2. DOWNLOAD TEST
    console.log('2️⃣ DOWNLOAD TEST');
    console.log('   Downloading first 5 ML documents');
    try {
      const downloadResult = await this.sendMCPRequest('download_adams_documents', {
        documentNumbers: '1,2,3,4,5'
      });

      const downloadText = downloadResult.result.content[0].text;
      const successCount = (downloadText.match(/✅/g) || []).length;
      
      this.results.download = {
        success: successCount > 0,
        time: downloadResult.time,
        count: successCount
      };

      console.log(`   ✅ Downloaded ${successCount}/5 documents (${Math.round(downloadResult.time/1000)}s)\n`);
    } catch (error) {
      console.log(`   ❌ Download failed: ${error.message}\n`);
    }

    // 3. Q&A TEST
    console.log('3️⃣ Q&A TEST');
    const questions = [
      'What are the safety requirements?',
      'What are the main findings?',
      'What actions are required?'
    ];

    let qaSuccess = 0;
    let totalQATime = 0;

    for (let i = 0; i < questions.length; i++) {
      console.log(`   Question ${i+1}: "${questions[i]}"`);
      try {
        const qaResult = await this.sendMCPRequest('ask_about_documents', {
          question: questions[i]
        });

        const qaText = qaResult.result.content[0].text;
        if (qaText.includes('Citation') && !qaText.includes('No relevant')) {
          qaSuccess++;
          console.log(`   ✅ Answer found (${Math.round(qaResult.time/1000)}s)`);
        } else {
          console.log(`   ⚠️ No relevant info (${Math.round(qaResult.time/1000)}s)`);
        }
        totalQATime += qaResult.time;
      } catch (error) {
        console.log(`   ❌ Q&A failed: ${error.message}`);
      }
    }

    this.results.qa = {
      success: qaSuccess > 0,
      time: totalQATime,
      responses: qaSuccess
    };

    console.log(`   📊 Q&A Success: ${qaSuccess}/${questions.length}\n`);

    // 4. STATS TEST
    console.log('4️⃣ SYSTEM STATS');
    try {
      const statsResult = await this.sendMCPRequest('list_downloaded_documents', {});
      const statsText = statsResult.result.content[0].text;
      
      this.results.stats = {
        success: statsText.includes('System Statistics'),
        time: statsResult.time
      };

      console.log(`   ✅ Stats retrieved (${Math.round(statsResult.time/1000)}s)\n`);
    } catch (error) {
      console.log(`   ❌ Stats failed: ${error.message}\n`);
    }

    // FINAL REPORT
    console.log('====================================');
    console.log('📊 FINAL RESULTS\n');

    const components = [
      { name: 'Search', result: this.results.search },
      { name: 'Download', result: this.results.download },
      { name: 'Q&A', result: this.results.qa },
      { name: 'Stats', result: this.results.stats }
    ];

    let successCount = 0;
    components.forEach(comp => {
      const status = comp.result.success ? '✅' : '❌';
      const time = Math.round(comp.result.time / 1000);
      console.log(`${status} ${comp.name}: ${comp.result.success ? 'Working' : 'Failed'} (${time}s)`);
      if (comp.result.success) successCount++;
    });

    const totalTime = Object.values(this.results).reduce((sum, r) => sum + r.time, 0);
    const successRate = Math.round((successCount / 4) * 100);

    console.log(`\n⏱️ Total Time: ${Math.round(totalTime/1000)}s`);
    console.log(`🎯 Success Rate: ${successRate}% (${successCount}/4 components)`);

    if (successRate === 100) {
      console.log('\n🎉 PERFECT! All systems operational!');
    } else if (successRate >= 75) {
      console.log('\n✅ GOOD! System mostly functional.');
    } else {
      console.log('\n⚠️ NEEDS WORK! Multiple issues detected.');
    }

    console.log('\n📈 Performance Summary:');
    console.log(`   • Search: ${this.results.search.count} ML docs`);
    console.log(`   • Download: ${this.results.download.count} successful`);
    console.log(`   • Q&A: ${this.results.qa.responses}/3 answered`);
    console.log(`   • Avg Q&A Time: ${Math.round(totalTime/3000)}s`);

    return successRate === 100;
  }
}

const tester = new FinalCycleTest();
tester.runFullCycle()
  .then(success => {
    console.log(`\n🏁 Test completed. Perfect: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });