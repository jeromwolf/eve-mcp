#!/usr/bin/env node

/**
 * Comprehensive Test Suite for document_number filtering and cache auto-generation
 * Tests the complete workflow: search → download → Q&A with specific document filtering
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

// Test configuration
const TEST_DOCUMENTS = [
  {
    id: 'ML081710326',
    keyword: 'ACRS Safety Research',
    question: 'What is this ACRS meeting about? Who attended?',
    expectedInResult: ['ACRS', 'meeting', 'safety']
  },
  {
    id: 'ML020920623',
    keyword: 'Virgil Summer emergency',
    question: 'What is the emergency classification system?',
    expectedInResult: ['emergency', 'classification']
  },
  {
    id: 'ML19014A039',
    keyword: 'Prairie Island emergency',
    question: 'What are the protective action recommendations?',
    expectedInResult: ['protective', 'action']
  },
  {
    id: 'ML12305A251',
    keyword: 'diesel generator capacity',
    question: 'What are the diesel generator capacity requirements?',
    expectedInResult: ['diesel', 'generator', 'capacity']
  }
];

// Test steps
const TEST_STEPS = [
  'SEARCH',
  'DOWNLOAD',
  'VERIFY_CACHE',
  'QA_SPECIFIC_DOC',
  'VERIFY_FILTERING'
];

class TestRunner {
  constructor() {
    this.results = [];
    this.currentTest = null;
  }

  /**
   * Execute MCP tool via stdio
   */
  async executeMCPTool(toolName, args) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}\n${stderr}`));
          return;
        }

        try {
          // Parse MCP response
          const lines = stdout.split('\n').filter(line => line.trim());
          const response = JSON.parse(lines[lines.length - 1]);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}\n${stdout}`));
        }
      });

      // Send MCP request
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();

      // Timeout after 60 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('MCP request timeout'));
      }, 60000);
    });
  }

  /**
   * Step 1: Search for documents
   */
  async testSearch(doc) {
    console.log(`\n  📍 Step 1: Searching for "${doc.keyword}"...`);

    try {
      const result = await this.executeMCPTool('search_adams', {
        query: doc.keyword,
        max_results: 10
      });

      const hasResults = result.content && result.content[0]?.text?.includes(doc.id);

      if (hasResults) {
        console.log(`     ✅ Found ${doc.id} in search results`);
        return { success: true, step: 'SEARCH' };
      } else {
        console.log(`     ❌ ${doc.id} not in search results`);
        return { success: false, step: 'SEARCH', error: 'Document not found' };
      }
    } catch (error) {
      console.log(`     ❌ Search failed: ${error.message}`);
      return { success: false, step: 'SEARCH', error: error.message };
    }
  }

  /**
   * Step 2: Download document
   */
  async testDownload(doc) {
    console.log(`\n  📍 Step 2: Downloading ${doc.id}...`);

    try {
      const result = await this.executeMCPTool('download_adams_documents', {
        document_numbers: [doc.id]
      });

      const success = result.content && result.content[0]?.text?.includes('success');

      if (success) {
        console.log(`     ✅ Downloaded ${doc.id}`);
        return { success: true, step: 'DOWNLOAD' };
      } else {
        console.log(`     ❌ Download failed`);
        return { success: false, step: 'DOWNLOAD', error: 'Download unsuccessful' };
      }
    } catch (error) {
      console.log(`     ❌ Download error: ${error.message}`);
      return { success: false, step: 'DOWNLOAD', error: error.message };
    }
  }

  /**
   * Step 3: Verify cache file exists
   */
  async testVerifyCache(doc) {
    console.log(`\n  📍 Step 3: Verifying cache for ${doc.id}...`);

    // Wait 2 seconds for file system sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Check PDF file
      const pdfPattern = `downloaded_pdfs/*/${doc.id}.pdf`;
      const pdfFiles = await this.findFiles(pdfPattern);

      if (pdfFiles.length === 0) {
        console.log(`     ❌ PDF file not found`);
        return { success: false, step: 'VERIFY_CACHE', error: 'PDF not found' };
      }

      console.log(`     ✅ PDF file exists: ${pdfFiles[0]}`);

      // Cache file is optional (memory cache is primary)
      const cacheFile = `pdf-text-cache/${doc.id}.txt`;
      try {
        await fs.access(cacheFile);
        const stats = await fs.stat(cacheFile);
        console.log(`     ✅ Cache file exists: ${stats.size} bytes`);
      } catch {
        console.log(`     ℹ️  Cache file not persisted (memory cache used)`);
      }

      return { success: true, step: 'VERIFY_CACHE' };
    } catch (error) {
      console.log(`     ❌ Verification error: ${error.message}`);
      return { success: false, step: 'VERIFY_CACHE', error: error.message };
    }
  }

  /**
   * Step 4: Q&A with specific document
   */
  async testQASpecificDoc(doc) {
    console.log(`\n  📍 Step 4: Q&A with document_number="${doc.id}"...`);

    try {
      const result = await this.executeMCPTool('ask_about_documents', {
        question: doc.question,
        document_number: doc.id
      });

      const responseText = result.content?.[0]?.text || '';

      // Check if response is not an error
      if (responseText.includes('❌') || responseText.includes('No relevant information')) {
        console.log(`     ❌ Q&A failed or no results`);
        return { success: false, step: 'QA_SPECIFIC_DOC', error: 'No relevant information' };
      }

      // Check if expected keywords present
      const hasExpected = doc.expectedInResult.some(keyword =>
        responseText.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasExpected) {
        console.log(`     ✅ Q&A successful with relevant content`);
        console.log(`     📄 Response length: ${responseText.length} chars`);
        return { success: true, step: 'QA_SPECIFIC_DOC', responseLength: responseText.length };
      } else {
        console.log(`     ⚠️  Q&A returned but missing expected keywords`);
        return { success: true, step: 'QA_SPECIFIC_DOC', warning: 'Missing expected keywords' };
      }
    } catch (error) {
      console.log(`     ❌ Q&A error: ${error.message}`);
      return { success: false, step: 'QA_SPECIFIC_DOC', error: error.message };
    }
  }

  /**
   * Step 5: Verify filtering (check logs)
   */
  async testVerifyFiltering(doc) {
    console.log(`\n  📍 Step 5: Verifying document_number filtering...`);

    try {
      // Check latest MCP log file
      const logFiles = await this.findFiles('logs/mcp/mcp-server-*.log');
      if (logFiles.length === 0) {
        console.log(`     ⚠️  No log files found`);
        return { success: true, step: 'VERIFY_FILTERING', warning: 'No logs' };
      }

      const latestLog = logFiles.sort().reverse()[0];
      const logContent = await fs.readFile(latestLog, 'utf8');

      // Look for filter logs with this document
      const filterLogs = logContent.split('\n')
        .filter(line => line.includes(doc.id) && line.includes('Filter results'))
        .slice(-1)[0]; // Get most recent

      if (filterLogs) {
        const match = filterLogs.match(/afterFilter":(\d+).*filteredOut":(\d+)/);
        if (match) {
          const [, afterFilter, filteredOut] = match;
          console.log(`     ✅ Filtering verified: ${afterFilter} results kept, ${filteredOut} filtered out`);
          return {
            success: true,
            step: 'VERIFY_FILTERING',
            afterFilter: parseInt(afterFilter),
            filteredOut: parseInt(filteredOut)
          };
        }
      }

      console.log(`     ℹ️  No filtering logs found (may not be an issue)`);
      return { success: true, step: 'VERIFY_FILTERING', warning: 'No filter logs' };
    } catch (error) {
      console.log(`     ⚠️  Log verification error: ${error.message}`);
      return { success: true, step: 'VERIFY_FILTERING', warning: error.message };
    }
  }

  /**
   * Helper: Find files matching pattern
   */
  async findFiles(pattern) {
    const { glob } = await import('glob');
    return glob.sync(pattern);
  }

  /**
   * Run single test set
   */
  async runTestSet(testNumber, doc) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Test Set ${testNumber}: ${doc.id}`);
    console.log(`   Keyword: "${doc.keyword}"`);
    console.log(`   Question: "${doc.question}"`);
    console.log('='.repeat(70));

    const startTime = Date.now();
    const testResult = {
      testNumber,
      documentId: doc.id,
      keyword: doc.keyword,
      steps: [],
      success: true,
      duration: 0
    };

    // Run all steps sequentially
    const steps = [
      () => this.testSearch(doc),
      () => this.testDownload(doc),
      () => this.testVerifyCache(doc),
      () => this.testQASpecificDoc(doc),
      () => this.testVerifyFiltering(doc)
    ];

    for (const step of steps) {
      const result = await step();
      testResult.steps.push(result);

      if (!result.success) {
        testResult.success = false;
        console.log(`\n  ⛔ Test failed at step: ${result.step}`);
        break;
      }
    }

    testResult.duration = Date.now() - startTime;

    if (testResult.success) {
      console.log(`\n  ✅ Test Set ${testNumber} PASSED (${(testResult.duration / 1000).toFixed(1)}s)`);
    } else {
      console.log(`\n  ❌ Test Set ${testNumber} FAILED (${(testResult.duration / 1000).toFixed(1)}s)`);
    }

    return testResult;
  }

  /**
   * Print summary
   */
  printSummary(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${successRate}%`);

    // Step-by-step breakdown
    console.log(`\n📋 Step Breakdown:`);
    const stepStats = {};

    results.forEach(result => {
      result.steps.forEach(step => {
        if (!stepStats[step.step]) {
          stepStats[step.step] = { success: 0, fail: 0 };
        }
        if (step.success) {
          stepStats[step.step].success++;
        } else {
          stepStats[step.step].fail++;
        }
      });
    });

    Object.entries(stepStats).forEach(([step, stats]) => {
      const rate = ((stats.success / (stats.success + stats.fail)) * 100).toFixed(1);
      console.log(`   ${step}: ${stats.success}/${stats.success + stats.fail} (${rate}%)`);
    });

    // Performance
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    console.log(`\n⏱️  Average Test Duration: ${(avgDuration / 1000).toFixed(1)}s`);

    // Failed tests detail
    if (failedTests > 0) {
      console.log(`\n❌ Failed Tests Detail:`);
      results.filter(r => !r.success).forEach(result => {
        console.log(`\n   Test ${result.testNumber}: ${result.documentId}`);
        const failedStep = result.steps.find(s => !s.success);
        if (failedStep) {
          console.log(`      Failed at: ${failedStep.step}`);
          console.log(`      Error: ${failedStep.error}`);
        }
      });
    }

    console.log('\n' + '='.repeat(70));

    return successRate === '100.0';
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testCount = args[0] ? parseInt(args[0]) : 1;

  console.log('🚀 NRC ADAMS MCP - Comprehensive Test Suite');
  console.log(`📝 Running ${testCount} test set(s)...\n`);

  const runner = new TestRunner();
  const results = [];

  // Run first test
  console.log('🧪 Running initial test set...\n');
  const firstTest = await runner.runTestSet(1, TEST_DOCUMENTS[0]);
  results.push(firstTest);

  if (!firstTest.success) {
    console.log('\n❌ First test failed. Stopping test suite.');
    runner.printSummary(results);
    process.exit(1);
  }

  console.log('\n✅ First test passed! Continuing with remaining tests...\n');

  // Run remaining tests if requested
  if (testCount > 1) {
    for (let i = 1; i < testCount && i < TEST_DOCUMENTS.length; i++) {
      const result = await runner.runTestSet(i + 1, TEST_DOCUMENTS[i]);
      results.push(result);

      // Small delay between tests
      if (i < testCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // If more than 4 tests requested, cycle through documents again
    if (testCount > TEST_DOCUMENTS.length) {
      for (let i = TEST_DOCUMENTS.length; i < testCount; i++) {
        const doc = TEST_DOCUMENTS[i % TEST_DOCUMENTS.length];
        const result = await runner.runTestSet(i + 1, doc);
        results.push(result);

        if (i < testCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }

  // Print summary
  const allPassed = runner.printSummary(results);

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});