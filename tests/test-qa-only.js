#!/usr/bin/env node

/**
 * Q&A Service Test - 10 Questions focused testing
 * Tests Q&A functionality with existing downloaded PDFs
 */

import { spawn } from 'child_process';

class QAServiceTest {
  constructor() {
    this.questions = [
      'What are the main safety requirements mentioned in these documents?',
      'What inspection findings were identified?', 
      'What corrective actions are required?',
      'What are the regulatory compliance requirements?',
      'What environmental considerations are discussed?',
      'What are the reactor safety analysis conclusions?',
      'What license renewal conditions are specified?',
      'What are the emergency preparedness requirements?',
      'What quality assurance measures are described?',
      'What technical specifications need to be updated?'
    ];
  }

  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 45000 // 45 second timeout per question
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
        // Suppress stderr for cleaner output
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
          reject(new Error(`Request timeout after 45 seconds`));
        }
      }, 45000);
    });
  }

  async testQAService() {
    console.log('🤖 NRC ADAMS MCP Server - Q&A Service Test');
    console.log('   Testing 10 Questions with existing PDFs');
    console.log('='.repeat(60));

    const results = {
      total: this.questions.length,
      successful: 0,
      failed: 0,
      responses: [],
      startTime: Date.now()
    };

    for (let i = 0; i < this.questions.length; i++) {
      const question = this.questions[i];
      const questionNum = i + 1;

      console.log(`\n💬 Question ${questionNum}/10: ${question}`);
      console.log('   ' + '-'.repeat(50));

      const startTime = Date.now();
      
      try {
        const qaResult = await this.sendMCPRequest('ask_about_documents', {
          question: question
        });

        const responseTime = Date.now() - startTime;

        if (qaResult?.content?.[0]?.text) {
          const answerText = qaResult.content[0].text;
          
          if (answerText.includes('No relevant information') || 
              answerText.includes('Sources: N/A') || 
              answerText.trim().length < 50) {
            console.log(`   ❌ No relevant info found (${responseTime}ms)`);
            results.failed++;
            results.responses.push({
              questionNum,
              question,
              success: false,
              responseTime,
              reason: 'No relevant information'
            });
          } else {
            // Extract sources
            const sourceMatch = answerText.match(/\[([^\]]+)\]/g) || [];
            const sources = sourceMatch.length;
            
            console.log(`   ✅ Found relevant info (${responseTime}ms)`);
            console.log(`   📄 Sources: ${sources} documents referenced`);
            if (answerText.length > 200) {
              console.log(`   📝 Answer: ${answerText.substring(0, 150)}...`);
            } else {
              console.log(`   📝 Answer: ${answerText}`);
            }
            
            results.successful++;
            results.responses.push({
              questionNum,
              question,
              success: true,
              responseTime,
              sources,
              answerLength: answerText.length
            });
          }
        } else {
          console.log(`   ❌ No response from Q&A system (${responseTime}ms)`);
          results.failed++;
          results.responses.push({
            questionNum,
            question,
            success: false,
            responseTime,
            reason: 'No response'
          });
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        console.log(`   ❌ Q&A error: ${error.message} (${responseTime}ms)`);
        results.failed++;
        results.responses.push({
          questionNum,
          question,
          success: false,
          responseTime,
          reason: error.message
        });
      }

      // Small delay between questions to avoid overwhelming the system
      if (i < this.questions.length - 1) {
        console.log('   ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const totalTime = Date.now() - results.startTime;
    const successRate = Math.round((results.successful / results.total) * 100);
    const avgResponseTime = Math.round(
      results.responses.reduce((sum, r) => sum + r.responseTime, 0) / results.responses.length
    );

    // Print final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Q&A SERVICE TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`🎯 Success Rate: ${successRate}% (${results.successful}/${results.total})`);
    console.log(`⏱️  Average Response Time: ${avgResponseTime}ms`);
    console.log(`🕒 Total Test Duration: ${Math.round(totalTime/1000)}s`);

    // Detailed breakdown
    if (results.successful > 0) {
      const successfulResponses = results.responses.filter(r => r.success);
      const avgSources = Math.round(
        successfulResponses.reduce((sum, r) => sum + (r.sources || 0), 0) / successfulResponses.length
      );
      const avgAnswerLength = Math.round(
        successfulResponses.reduce((sum, r) => sum + (r.answerLength || 0), 0) / successfulResponses.length
      );

      console.log(`\n✅ Successful Responses:`);
      console.log(`   📄 Average Sources: ${avgSources} documents per answer`);
      console.log(`   📝 Average Answer Length: ${avgAnswerLength} characters`);
    }

    if (results.failed > 0) {
      console.log(`\n❌ Failed Questions:`);
      results.responses
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   Q${r.questionNum}: ${r.reason} (${r.responseTime}ms)`);
        });
    }

    // Performance analysis
    console.log(`\n📈 Performance Analysis:`);
    const fastResponses = results.responses.filter(r => r.responseTime < 10000).length;
    const mediumResponses = results.responses.filter(r => r.responseTime >= 10000 && r.responseTime < 30000).length;
    const slowResponses = results.responses.filter(r => r.responseTime >= 30000).length;

    console.log(`   🚀 Fast (< 10s): ${fastResponses} questions`);
    console.log(`   🏃 Medium (10-30s): ${mediumResponses} questions`);
    console.log(`   🐌 Slow (> 30s): ${slowResponses} questions`);

    // Final verdict
    console.log(`\n🏁 Q&A SERVICE VERDICT:`);
    if (successRate >= 70) {
      console.log('✅ Q&A SERVICE WORKING WELL!');
      console.log('🎉 Ready for production use with existing PDF collection');
    } else if (successRate >= 50) {
      console.log('⚠️  Q&A SERVICE PARTIALLY WORKING');
      console.log('🔧 Consider improving PDF indexing or question processing');
    } else {
      console.log('❌ Q&A SERVICE NEEDS ATTENTION');
      console.log('🔥 Check RAG engine, PDF processing, and document indexing');
    }

    return successRate >= 70;
  }
}

// Run the Q&A service test
const tester = new QAServiceTest();
tester.testQAService()
  .then(success => {
    console.log(`\n🎯 Q&A Test completed. Success: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Q&A Test failed:', error.message);
    process.exit(1);
  });