import { ImprovedADAMSScraper } from './build/adams-real-improved.js';
import { getKeywordStatistics, sanitizeKeywordForFolder } from './build/utils.js';
import fs from 'fs/promises';
import path from 'path';

async function testKeywordFolders() {
  console.log('\n' + '='.repeat(70));
  console.log('📁 Testing Keyword-Based Folder Structure');
  console.log('='.repeat(70));
  
  const scraper = new ImprovedADAMSScraper();
  
  try {
    // 테스트할 키워드들
    const testCases = [
      { keyword: 'reactor safety 2024', expectedFolder: 'reactor_safety_2024' },
      { keyword: 'Emergency Planning!!!', expectedFolder: 'emergency_planning' },
      { keyword: '核 안전성 분석', expectedFolder: 'general' },  // 한글/특수문자 -> general
      { keyword: 'ML-24@#$%', expectedFolder: 'ml24' }
    ];
    
    console.log('\n1️⃣ Testing Folder Name Sanitization');
    console.log('-'.repeat(50));
    
    for (const test of testCases) {
      const folderName = sanitizeKeywordForFolder(test.keyword);
      console.log(`"${test.keyword}"`);
      console.log(`  → ${folderName}`);
      console.log(`  Expected pattern: ${test.expectedFolder}_YYYY-MM-DD ✅`);
    }
    
    console.log('\n2️⃣ Testing Real Downloads with Keywords');
    console.log('-'.repeat(50));
    
    // 실제 검색 및 다운로드 테스트
    const searchKeywords = [
      'safety analysis',
      'reactor vessel',
      'emergency core cooling'
    ];
    
    for (const keyword of searchKeywords) {
      console.log(`\n🔍 Searching: "${keyword}"`);
      
      // 검색
      const results = await scraper.searchReal(keyword, 2);
      console.log(`  Found ${results.length} documents`);
      
      if (results.length > 0) {
        const doc = results[0];
        console.log(`  Downloading: ${doc.accessionNumber}`);
        
        // 키워드 기반 다운로드 (3번째 파라미터로 키워드 전달)
        const success = await scraper.downloadRealPDF(
          doc.accessionNumber,
          '', // 빈 경로 전달 (키워드가 있으면 무시됨)
          keyword // 키워드 전달
        );
        
        if (success) {
          // 예상 경로 확인
          const folderName = sanitizeKeywordForFolder(keyword);
          const expectedPath = path.join('downloaded_pdfs', folderName, `${doc.accessionNumber}.pdf`);
          
          try {
            const stats = await fs.stat(expectedPath);
            console.log(`  ✅ Saved to: ${expectedPath}`);
            console.log(`     Size: ${(stats.size / 1024).toFixed(2)} KB`);
          } catch (err) {
            console.log(`  ⚠️ File not found at expected path`);
          }
        } else {
          console.log(`  ❌ Download failed`);
        }
      }
    }
    
    console.log('\n3️⃣ Folder Structure Summary');
    console.log('-'.repeat(50));
    
    // 폴더 구조 통계
    const stats = await getKeywordStatistics();
    
    console.log(`📊 Statistics:`);
    console.log(`  Total Keywords: ${stats.totalKeywords}`);
    console.log(`  Total Documents: ${stats.totalDocuments}`);
    console.log(`  Total Size: ${(stats.totalSizeKB / 1024).toFixed(2)} MB`);
    
    if (stats.keywords.length > 0) {
      console.log('\n📁 Keyword Folders:');
      stats.keywords.forEach(k => {
        console.log(`  ${k.name}/`);
        console.log(`    Documents: ${k.documents}`);
        console.log(`    Size: ${(k.sizeKB / 1024).toFixed(2)} MB`);
      });
    }
    
    // 폴더 트리 표시
    console.log('\n🌳 Directory Tree:');
    const baseDir = 'downloaded_pdfs';
    const folders = await fs.readdir(baseDir, { withFileTypes: true });
    
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const folderPath = path.join(baseDir, folder.name);
        const files = await fs.readdir(folderPath);
        const pdfFiles = files.filter(f => f.endsWith('.pdf'));
        
        console.log(`  📁 ${folder.name}/`);
        pdfFiles.slice(0, 3).forEach(file => {
          console.log(`     📄 ${file}`);
        });
        if (pdfFiles.length > 3) {
          console.log(`     ... and ${pdfFiles.length - 3} more files`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await scraper.cleanup();
    console.log('\n' + '='.repeat(70));
    console.log('✅ Keyword folder test completed');
    console.log('='.repeat(70));
  }
}

testKeywordFolders().catch(console.error);