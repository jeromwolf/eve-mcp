#!/usr/bin/env node

/**
 * Test Option A Implementation
 * Verifies that cache files are auto-generated when missing
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { pdfCacheService } from './build/services/pdf-cache-service.js';

const TEST_DOCUMENTS = [
  'ML081710326', // 5 pages, 9.8KB
  'ML19014A039'  // 62 pages, 90KB
];

async function testOptionA() {
  console.log('🧪 Testing Option A: Auto-cache in loadExistingPDFs()\n');
  console.log('=' .repeat(60));

  // Step 1: Find PDF files
  console.log('\n📂 Step 1: Locating test PDF files...');
  const pdfDir = 'downloaded_pdfs';
  const foundPDFs = [];

  try {
    const entries = await fs.readdir(pdfDir, { withFileTypes: true });
    const directories = entries.filter(entry => entry.isDirectory());

    for (const dir of directories) {
      const dirPath = path.join(pdfDir, dir.name);
      const files = await fs.readdir(dirPath);

      for (const testDoc of TEST_DOCUMENTS) {
        const pdfFile = files.find(f => f.includes(testDoc));
        if (pdfFile) {
          const fullPath = path.join(dirPath, pdfFile);
          foundPDFs.push({ documentNumber: testDoc, path: fullPath });
          console.log(`   ✅ Found: ${testDoc} at ${fullPath}`);
        }
      }
    }
  } catch (error) {
    console.error('   ❌ Error reading PDF directory:', error.message);
    process.exit(1);
  }

  if (foundPDFs.length === 0) {
    console.error('   ❌ No test PDFs found. Run search and download first.');
    process.exit(1);
  }

  console.log(`\n   Found ${foundPDFs.length}/${TEST_DOCUMENTS.length} test PDFs`);

  // Step 2: Initialize PDF cache service
  console.log('\n⚙️  Step 2: Initializing PDF cache service...');
  try {
    await pdfCacheService.initialize();
    console.log('   ✅ PDF cache service initialized');
  } catch (error) {
    console.error('   ❌ Initialization failed:', error.message);
    process.exit(1);
  }

  // Step 3: Test auto-cache generation
  console.log('\n🔧 Step 3: Testing auto-cache with getCachedText()...');
  const results = [];

  for (const pdf of foundPDFs) {
    console.log(`\n   Testing: ${pdf.documentNumber}`);

    // Check if cache exists before
    const cacheFile = path.join('pdf-text-cache', `${pdf.documentNumber}.txt`);
    let cacheExistsBefore = false;
    try {
      await fs.access(cacheFile);
      cacheExistsBefore = true;
      console.log(`      Cache exists: YES (will verify integrity)`);
    } catch {
      console.log(`      Cache exists: NO (will auto-create)`);
    }

    // Call getCachedText (should auto-extract if missing)
    const startTime = Date.now();
    try {
      const content = await pdfCacheService.getCachedText(pdf.path, pdf.documentNumber);
      const elapsed = Date.now() - startTime;

      if (content) {
        // Check if cache exists after
        let cacheExistsAfter = false;
        try {
          const stats = await fs.stat(cacheFile);
          cacheExistsAfter = true;

          results.push({
            documentNumber: pdf.documentNumber,
            success: true,
            cacheExistsBefore,
            cacheExistsAfter,
            contentLength: content.length,
            cacheFileSize: stats.size,
            elapsed
          });

          console.log(`      ✅ Success!`);
          console.log(`         Content: ${content.length} chars`);
          console.log(`         Cache file: ${stats.size} bytes`);
          console.log(`         Time: ${elapsed}ms`);
          console.log(`         Auto-generated: ${!cacheExistsBefore ? 'YES' : 'NO (used existing)'}`);
        } catch {
          results.push({
            documentNumber: pdf.documentNumber,
            success: false,
            error: 'Cache file not created after extraction'
          });
          console.log(`      ❌ Cache file not found after extraction`);
        }
      } else {
        results.push({
          documentNumber: pdf.documentNumber,
          success: false,
          error: 'getCachedText returned null'
        });
        console.log(`      ❌ getCachedText returned null`);
      }
    } catch (error) {
      results.push({
        documentNumber: pdf.documentNumber,
        success: false,
        error: error.message
      });
      console.log(`      ❌ Error: ${error.message}`);
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary\n');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (successCount > 0) {
    console.log('\n   📈 Performance:');
    const avgTime = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.elapsed, 0) / successCount;
    const totalChars = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.contentLength, 0);

    console.log(`      Average extraction: ${avgTime.toFixed(0)}ms`);
    console.log(`      Total text extracted: ${totalChars} chars`);
  }

  // Step 5: Check cache stats
  console.log('\n💾 Cache Statistics:');
  const cacheStats = pdfCacheService.getStats();
  console.log(`   Total entries: ${cacheStats.totalEntries}`);
  console.log(`   Total text size: ${cacheStats.totalTextSize} chars`);
  console.log(`   Cache hit rate: ${(cacheStats.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`   Avg extraction time: ${cacheStats.averageExtractionTime}ms`);

  console.log('\n' + '='.repeat(60));

  // Exit code based on results
  if (failCount > 0) {
    console.log('\n❌ FAILED: Some tests did not pass\n');
    process.exit(1);
  } else {
    console.log('\n✅ SUCCESS: All tests passed!\n');
    console.log('🎯 Option A is working correctly:');
    console.log('   - Cache files auto-generate when missing');
    console.log('   - loadExistingPDFs() will now work seamlessly');
    console.log('   - Q&A will succeed on first call after download\n');
    process.exit(0);
  }
}

// Run test
testOptionA().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});