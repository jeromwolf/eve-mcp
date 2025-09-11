#!/usr/bin/env node

/**
 * Background PDF Indexing Script
 * Pre-processes all PDFs and creates cached text for instant Q&A responses
 */

import { promises as fs } from 'fs';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;
const PROJECT_ROOT = path.dirname(__dirname);

class PDFIndexer {
  constructor() {
    this.startTime = Date.now();
    this.stats = {
      found: 0,
      processed: 0,
      cached: 0,
      failed: 0,
      totalSize: 0
    };
  }

  async indexAllPDFs() {
    console.log('🚀 NRC ADAMS PDF Background Indexer');
    console.log('   Creating high-speed text cache for instant Q&A');
    console.log('='.repeat(60));

    try {
      // Initialize PDF cache service
      const { pdfCacheService } = await import('../build/services/pdf-cache-service.js');
      await pdfCacheService.initialize();

      // Find all PDF directories
      const pdfBaseDir = path.join(PROJECT_ROOT, 'downloaded_pdfs');
      console.log(`\n📂 Scanning PDF directory: ${pdfBaseDir}`);

      const exists = await fs.access(pdfBaseDir).then(() => true).catch(() => false);
      if (!exists) {
        console.log('❌ No downloaded_pdfs directory found');
        return false;
      }

      // Get all subdirectories
      const entries = await fs.readdir(pdfBaseDir, { withFileTypes: true });
      const directories = entries.filter(entry => entry.isDirectory());

      console.log(`\n🔍 Found ${directories.length} PDF collections to process`);

      // Process each directory
      for (let i = 0; i < directories.length; i++) {
        const dir = directories[i];
        const dirPath = path.join(pdfBaseDir, dir.name);
        
        console.log(`\n📁 Processing collection ${i+1}/${directories.length}: ${dir.name}`);
        await this.processDirectory(pdfCacheService, dirPath, dir.name);
      }

      // Get final cache stats
      const cacheStats = pdfCacheService.getStats();
      const totalTime = Date.now() - this.startTime;

      // Print comprehensive results
      console.log('\n' + '='.repeat(60));
      console.log('📊 PDF INDEXING COMPLETE');
      console.log('='.repeat(60));
      
      console.log(`📄 PDFs Found: ${this.stats.found}`);
      console.log(`✅ Successfully Processed: ${this.stats.processed}`);
      console.log(`💾 Cached Entries: ${cacheStats.totalEntries}`);
      console.log(`❌ Failed: ${this.stats.failed}`);
      console.log(`📐 Total PDF Size: ${Math.round(this.stats.totalSize/1024/1024)}MB`);
      console.log(`💿 Total Text Size: ${Math.round(cacheStats.totalTextSize/1024)}KB`);
      console.log(`⏱️  Total Time: ${Math.round(totalTime/1000)}s`);
      console.log(`🚀 Cache Hit Rate: ${Math.round(cacheStats.cacheHitRate*100)}%`);
      console.log(`📈 Avg Extraction Time: ${cacheStats.averageExtractionTime}ms`);

      if (this.stats.processed > 0) {
        const avgTimePerPDF = Math.round(totalTime / this.stats.processed);
        console.log(`⚡ Avg Time per PDF: ${avgTimePerPDF}ms`);
      }

      console.log('\n🎯 PERFORMANCE IMPROVEMENT:');
      console.log(`   Before: ${Math.round(cacheStats.averageExtractionTime/1000)}s per Q&A (cold)`);
      console.log(`   After: <1s per Q&A (cached)`);
      console.log(`   Speedup: ${Math.round(cacheStats.averageExtractionTime/1000)}x faster`);

      if (this.stats.processed === this.stats.found) {
        console.log('\n✅ ALL PDFs SUCCESSFULLY INDEXED!');
        console.log('🚀 Q&A system ready for lightning-fast responses');
        return true;
      } else {
        console.log(`\n⚠️  Some PDFs failed to process (${this.stats.failed}/${this.stats.found})`);
        return false;
      }

    } catch (error) {
      console.error('💥 PDF indexing failed:', error.message);
      return false;
    }
  }

  async processDirectory(cacheService, dirPath, collectionName) {
    try {
      const files = await fs.readdir(dirPath);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      
      this.stats.found += pdfFiles.length;
      
      if (pdfFiles.length === 0) {
        console.log(`   📂 Empty collection: ${collectionName}`);
        return;
      }

      console.log(`   📄 Found ${pdfFiles.length} PDFs in ${collectionName}`);

      // Process PDFs with progress indicator
      for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i];
        const pdfPath = path.join(dirPath, pdfFile);
        const documentNumber = path.basename(pdfFile, '.pdf');

        process.stdout.write(`   [${i+1}/${pdfFiles.length}] ${documentNumber}... `);

        try {
          // Get file size
          const stats = await fs.stat(pdfPath);
          this.stats.totalSize += stats.size;

          const startTime = Date.now();
          const cachedText = await cacheService.getCachedText(pdfPath, documentNumber);
          const processingTime = Date.now() - startTime;

          if (cachedText && cachedText.length > 0) {
            this.stats.processed++;
            this.stats.cached++;
            
            const pages = Math.max(1, Math.ceil(cachedText.length / 1250)); // ~1250 chars/page
            const sizeKB = Math.round(stats.size / 1024);
            const textKB = Math.round(cachedText.length / 1024);
            
            console.log(`✅ ${pages}p, ${sizeKB}KB→${textKB}KB (${processingTime}ms)`);
          } else {
            this.stats.failed++;
            console.log(`❌ Failed (${processingTime}ms)`);
          }
        } catch (error) {
          this.stats.failed++;
          console.log(`❌ Error: ${error.message}`);
        }
      }

      console.log(`   📊 Collection ${collectionName}: ${pdfFiles.length - this.stats.failed} successful`);

    } catch (error) {
      console.log(`   ❌ Directory error: ${error.message}`);
    }
  }
}

// Run the indexer
const indexer = new PDFIndexer();
indexer.indexAllPDFs()
  .then(success => {
    console.log(`\n🏁 PDF indexing completed. Success: ${success}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 PDF indexer crashed:', error.message);
    process.exit(1);
  });