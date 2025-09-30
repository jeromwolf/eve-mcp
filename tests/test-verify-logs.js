#!/usr/bin/env node

/**
 * Automated Log Verification for NRC ADAMS MCP
 * Analyzes logs to verify document_number filtering and cache functionality
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const TEST_DOCUMENTS = [
  'ML081710326',
  'ML020920623',
  'ML19014A039',
  'ML12305A251'
];

class LogVerifier {
  constructor() {
    this.results = [];
  }

  async readLatestLog() {
    const logDir = 'logs/mcp';
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(f => f.startsWith('mcp-server-') && f.endsWith('.log'));

    if (logFiles.length === 0) {
      throw new Error('No log files found');
    }

    const latestLog = logFiles.sort().reverse()[0];
    const logPath = path.join(logDir, latestLog);
    const content = await fs.readFile(logPath, 'utf8');

    console.log(`📄 Analyzing: ${latestLog}\n`);
    return content;
  }

  parseLogLine(line) {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }

  async verifyDocument(docId, logContent) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 Verifying: ${docId}`);
    console.log('='.repeat(70));

    const result = {
      documentId: docId,
      steps: {
        download: { checked: false, success: false },
        cache: { checked: false, success: false },
        ragIndexing: { checked: false, success: false },
        qaRequest: { checked: false, success: false },
        filtering: { checked: false, success: false, details: null }
      },
      overallSuccess: false
    };

    const lines = logContent.split('\n').filter(l => l.includes(docId));

    // Step 1: Check download
    console.log('\n📍 Step 1: Download');
    const downloadLogs = lines.filter(l => l.includes('Download success') || l.includes('Document downloaded'));
    if (downloadLogs.length > 0) {
      result.steps.download.checked = true;
      result.steps.download.success = true;
      console.log('   ✅ Downloaded successfully');
    } else {
      result.steps.download.checked = true;
      console.log('   ❌ No download logs found');
    }

    // Step 2: Check cache
    console.log('\n📍 Step 2: Cache');
    const cacheLogs = lines.filter(l =>
      l.includes('PDF text cache hit') ||
      l.includes('PDF text extracted') ||
      l.includes('textLength')
    );

    if (cacheLogs.length > 0) {
      result.steps.cache.checked = true;
      result.steps.cache.success = true;

      // Extract text length
      const cacheLog = this.parseLogLine(cacheLogs[cacheLogs.length - 1]);
      if (cacheLog?.data?.textLength || cacheLog?.data?.textSize) {
        const size = cacheLog.data.textLength || cacheLog.data.textSize;
        console.log(`   ✅ Cache hit: ${size} chars`);
      } else {
        console.log('   ✅ Cache operation logged');
      }
    } else {
      result.steps.cache.checked = true;
      console.log('   ⚠️  No cache logs (may use memory cache)');
      result.steps.cache.success = true; // Not critical
    }

    // Step 3: Check RAG indexing
    console.log('\n📍 Step 3: RAG Indexing');
    const ragLogs = lines.filter(l =>
      l.includes('Document indexed') ||
      l.includes('Adding document with page info')
    );

    if (ragLogs.length > 0) {
      result.steps.ragIndexing.checked = true;
      result.steps.ragIndexing.success = true;

      const ragLog = this.parseLogLine(ragLogs[ragLogs.length - 1]);
      if (ragLog?.data?.textLength) {
        console.log(`   ✅ Indexed: ${ragLog.data.textLength} chars, ${ragLog.data.totalPages || 'N/A'} pages`);
      } else {
        console.log('   ✅ Indexed in RAG engine');
      }
    } else {
      result.steps.ragIndexing.checked = true;
      console.log('   ❌ No RAG indexing logs');
    }

    // Step 4: Check Q&A requests
    console.log('\n📍 Step 4: Q&A Requests');
    const qaLogs = lines.filter(l =>
      l.includes('Q&A request initiated') &&
      l.includes(`"specificDocument":"${docId}"`)
    );

    if (qaLogs.length > 0) {
      result.steps.qaRequest.checked = true;
      result.steps.qaRequest.success = true;
      console.log(`   ✅ ${qaLogs.length} Q&A request(s) with document_number`);
    } else {
      result.steps.qaRequest.checked = true;
      console.log('   ⚠️  No Q&A requests with document_number specified');
    }

    // Step 5: Check filtering
    console.log('\n📍 Step 5: document_number Filtering');
    const filterLogs = lines.filter(l => l.includes('Filter results'));

    if (filterLogs.length > 0) {
      result.steps.filtering.checked = true;

      // Parse last filter log
      const lastFilter = this.parseLogLine(filterLogs[filterLogs.length - 1]);
      if (lastFilter?.data) {
        const { beforeFilter, afterFilter, filteredOut } = lastFilter.data;
        result.steps.filtering.details = { beforeFilter, afterFilter, filteredOut };

        if (afterFilter > 0) {
          result.steps.filtering.success = true;
          console.log(`   ✅ Filtering worked:`);
          console.log(`      Before: ${beforeFilter} results`);
          console.log(`      After: ${afterFilter} results (from ${docId})`);
          console.log(`      Filtered out: ${filteredOut} results (from other docs)`);
        } else {
          console.log(`   ❌ Filtering failed: 0 results after filter`);
        }
      } else {
        console.log('   ⚠️  Filter log found but couldn\'t parse');
      }
    } else {
      result.steps.filtering.checked = true;
      console.log('   ⚠️  No filtering logs found');
    }

    // Overall success
    const criticalSteps = [
      result.steps.download.success,
      result.steps.ragIndexing.success,
      result.steps.filtering.success
    ];

    result.overallSuccess = criticalSteps.every(s => s);

    if (result.overallSuccess) {
      console.log(`\n✅ ${docId}: ALL CRITICAL STEPS PASSED`);
    } else {
      console.log(`\n❌ ${docId}: SOME STEPS FAILED`);
    }

    return result;
  }

  async checkPhysicalFiles(docId) {
    console.log(`\n📂 Physical Files Check:`);

    // Check PDF
    try {
      const pdfFiles = await this.findFiles(`downloaded_pdfs/*/${docId}.pdf`);
      if (pdfFiles.length > 0) {
        const stats = await fs.stat(pdfFiles[0]);
        console.log(`   ✅ PDF: ${(stats.size / 1024).toFixed(1)}KB at ${pdfFiles[0]}`);
      } else {
        console.log(`   ❌ PDF: Not found`);
      }
    } catch (error) {
      console.log(`   ❌ PDF: Error checking (${error.message})`);
    }

    // Check cache (optional)
    try {
      const cacheFile = `pdf-text-cache/${docId}.txt`;
      const stats = await fs.stat(cacheFile);
      console.log(`   ✅ Cache: ${(stats.size / 1024).toFixed(1)}KB at ${cacheFile}`);
    } catch {
      console.log(`   ℹ️  Cache: Not persisted to disk (memory cache used)`);
    }
  }

  async findFiles(pattern) {
    const { glob } = await import('glob');
    return glob.sync(pattern);
  }

  printSummary(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(70));

    const totalDocs = results.length;
    const passedDocs = results.filter(r => r.overallSuccess).length;
    const successRate = ((passedDocs / totalDocs) * 100).toFixed(1);

    console.log(`\nDocuments Tested: ${totalDocs}`);
    console.log(`✅ Passed: ${passedDocs}`);
    console.log(`❌ Failed: ${totalDocs - passedDocs}`);
    console.log(`📈 Success Rate: ${successRate}%`);

    // Step breakdown
    console.log(`\n📋 Step-by-Step Breakdown:`);

    const stepNames = Object.keys(results[0].steps);
    stepNames.forEach(step => {
      const passed = results.filter(r => r.steps[step].success).length;
      const checked = results.filter(r => r.steps[step].checked).length;
      const rate = checked > 0 ? ((passed / checked) * 100).toFixed(1) : 0;
      console.log(`   ${step}: ${passed}/${checked} (${rate}%)`);
    });

    // Individual results
    console.log(`\n📄 Individual Results:`);
    results.forEach(result => {
      const status = result.overallSuccess ? '✅' : '❌';
      console.log(`   ${status} ${result.documentId}`);

      if (!result.overallSuccess) {
        Object.entries(result.steps).forEach(([step, data]) => {
          if (data.checked && !data.success) {
            console.log(`      ❌ ${step} failed`);
          }
        });
      }
    });

    console.log('\n' + '='.repeat(70));

    return successRate === '100.0';
  }
}

async function main() {
  console.log('🚀 NRC ADAMS MCP - Log Verification Tool');
  console.log('=' .repeat(70));

  const verifier = new LogVerifier();

  try {
    // Read latest log
    const logContent = await verifier.readLatestLog();

    // Verify each document
    const results = [];
    for (const docId of TEST_DOCUMENTS) {
      const result = await verifier.verifyDocument(docId, logContent);
      await verifier.checkPhysicalFiles(docId);
      results.push(result);
    }

    // Print summary
    const allPassed = verifier.printSummary(results);

    if (allPassed) {
      console.log('\n🎉 All tests passed! System is working correctly.\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Check details above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();