import 'dotenv/config';
import { ImprovedADAMSScraper } from './build/adams-real-improved.js';
import * as fs from 'fs/promises';
import path from 'path';

async function testImprovedScraper() {
  console.log('='.repeat(60));
  console.log('Testing Improved ADAMS Scraper with Logging');
  console.log('='.repeat(60));
  
  const scraper = new ImprovedADAMSScraper();
  
  try {
    // 1. 검색 테스트
    console.log('\n1. Testing search functionality...');
    const results = await scraper.searchReal('safety analysis 2024', 5);
    
    console.log(`\nFound ${results.length} documents:`);
    results.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.accessionNumber}`);
      console.log(`   Title: ${doc.title}`);
      console.log(`   Date: ${doc.dateAdded}`);
    });
    
    // 2. 다운로드 테스트
    if (results.length > 0) {
      console.log('\n2. Testing PDF download...');
      const doc = results[0];
      const downloadPath = path.join('downloaded_pdfs', `${doc.accessionNumber}_test.pdf`);
      
      const success = await scraper.downloadRealPDF(doc.accessionNumber, downloadPath);
      
      if (success) {
        const stats = await fs.stat(downloadPath);
        console.log(`✓ PDF downloaded successfully`);
        console.log(`  File: ${downloadPath}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
      } else {
        console.log('✗ Download failed');
      }
    }
    
    // 3. 에러 케이스 테스트
    console.log('\n3. Testing error handling...');
    try {
      await scraper.searchReal('', 5);
    } catch (error) {
      console.log('✓ Empty query handled correctly');
    }
    
    try {
      await scraper.downloadRealPDF('INVALID123', 'test.pdf');
      console.log('✗ Invalid document should have failed');
    } catch (error) {
      console.log('✓ Invalid document handled correctly');
    }
    
    // 4. 로그 파일 확인
    console.log('\n4. Checking log files...');
    const logDir = './logs';
    const dailyLogs = await fs.readdir(path.join(logDir, 'daily'));
    const errorLogs = await fs.readdir(path.join(logDir, 'errors'));
    
    console.log(`Daily logs: ${dailyLogs.length} files`);
    dailyLogs.forEach(file => console.log(`  - ${file}`));
    
    console.log(`Error logs: ${errorLogs.length} files`);
    errorLogs.forEach(file => console.log(`  - ${file}`));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.cleanup();
    console.log('\n✓ Cleanup completed');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test completed. Check logs directory for detailed logs.');
  console.log('='.repeat(60));
}

testImprovedScraper().catch(console.error);