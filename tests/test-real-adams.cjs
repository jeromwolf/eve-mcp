#!/usr/bin/env node

const { ADAMSScraper } = require('./build/adams-scraper.js');

async function test() {
  console.log('=' * 50);
  console.log('Testing Real ADAMS Integration');
  console.log('=' * 50);
  
  const scraper = new ADAMSScraper();
  
  try {
    // 1. 검색 테스트
    console.log('\n1. Searching for "emergency plan"...');
    const results = await scraper.search('emergency plan', 5);
    
    console.log(`\nFound ${results.length} results:`);
    results.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.documentNumber} - ${doc.title}`);
    });
    
    if (results.length > 0) {
      // 2. 다운로드 테스트
      const firstDoc = results[0];
      console.log(`\n2. Downloading ${firstDoc.documentNumber}...`);
      
      const filename = `test_${firstDoc.documentNumber}.pdf`;
      const success = await scraper.downloadPDF(firstDoc.documentNumber, filename);
      
      if (success) {
        console.log(`✓ Downloaded successfully to ${filename}`);
        
        // 파일 크기 확인
        const fs = require('fs');
        const stats = fs.statSync(filename);
        console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // PDF 확인
        const buffer = fs.readFileSync(filename);
        if (buffer.toString('utf8', 0, 4) === '%PDF') {
          console.log('   ✓ Valid PDF file');
        } else {
          console.log('   ✗ Not a valid PDF');
        }
      } else {
        console.log('✗ Download failed');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.close();
  }
}

test();