#!/usr/bin/env node

/**
 * Quick Q&A Test - 3 questions only
 * Test optimized Q&A service performance
 */

import { spawn } from 'child_process';

class QuickQATest {
  constructor() {
    this.questions = [
      'What safety requirements are mentioned?',
      'What are the main findings?', 
      'What actions are required?'
    ];
  }

  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000 // 30 second timeout
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

      serverProcess.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      serverProcess.on('close', (code) => {
        if (!hasResponse) {
          reject(new Error(`Server closed with code ${code}`));
        }
      });

      setTimeout(() => {
        try {
          serverProcess.stdin.write(JSON.stringify(request) + '\n');
        } catch (error) {
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      }, 1000);

      setTimeout(() => {
        if (!hasResponse) {
          serverProcess.kill();
          reject(new Error(`Request timeout after 30 seconds`));
        }
      }, 30000);
    });
  }

  async testQuickQA() {
    console.log('🚀 Quick Q&A Test - 3 Questions');
    console.log('='.repeat(40));

    let successful = 0;
    const startTime = Date.now();

    for (let i = 0; i < this.questions.length; i++) {
      const question = this.questions[i];
      console.log(`\n💬 Q${i+1}: ${question}`);

      const qStart = Date.now();
      
      try {
        const qaResult = await this.sendMCPRequest('ask_about_documents', {
          question: question
        });

        const responseTime = Date.now() - qStart;

        if (qaResult?.content?.[0]?.text) {
          const answerText = qaResult.content[0].text;
          
          if (answerText.includes('No relevant information') || answerText.includes('Sources: N/A')) {
            console.log(`   ❌ No relevant info (${Math.round(responseTime/1000)}s)`);
          } else {
            successful++;
            const sourceCount = (answerText.match(/\[([^\]]+)\]/g) || []).length;
            console.log(`   ✅ Found answer with ${sourceCount} sources (${Math.round(responseTime/1000)}s)`);
            console.log(`   📝 ${answerText.substring(0, 100)}...`);
          }
        } else {
          console.log(`   ❌ No response (${Math.round(responseTime/1000)}s)`);
        }
      } catch (error) {
        const responseTime = Date.now() - qStart;
        console.log(`   ❌ Error: ${error.message} (${Math.round(responseTime/1000)}s)`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const totalTime = Date.now() - startTime;
    const successRate = Math.round((successful / this.questions.length) * 100);

    console.log(`\n📊 RESULTS:`);
    console.log(`   Success: ${successful}/${this.questions.length} (${successRate}%)`);
    console.log(`   Time: ${Math.round(totalTime/1000)}s`);

    if (successRate >= 67) {
      console.log('   ✅ Q&A SERVICE WORKING!');
    } else {
      console.log('   ⚠️  Q&A SERVICE NEEDS WORK');
    }

    return successRate >= 67;
  }
}

const tester = new QuickQATest();
tester.testQuickQA()
  .then(success => {
    console.log(`\n🏁 Quick test completed. Success: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Quick test failed:', error.message);
    process.exit(1);
  });