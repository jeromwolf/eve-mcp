import 'dotenv/config';
import { ImprovedADAMSScraper } from './build/adams-real-improved.js';
import { RAGEngine } from './build/rag-engine.js';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 테스트 결과 저장
const testResults = {
  search: { success: false, details: null },
  download: { success: false, details: null },
  ragInit: { success: false, details: null },
  qa: { success: false, details: [] },
  summary: { totalTests: 0, passed: 0, failed: 0 }
};

async function runFullCycleTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 NRC ADAMS MCP - Full Cycle Test');
  console.log('='.repeat(70));
  console.log(`Start Time: ${new Date().toISOString()}`);
  
  const scraper = new ImprovedADAMSScraper();
  const rag = new RAGEngine();
  let downloadedDoc = null;
  
  try {
    // ========================================
    // 1. SEARCH TEST
    // ========================================
    console.log('\n📋 PHASE 1: SEARCH TEST');
    console.log('-'.repeat(50));
    
    const searchQuery = 'reactor safety analysis 2024';
    console.log(`Query: "${searchQuery}"`);
    console.log('Searching...');
    
    const startSearch = Date.now();
    const searchResults = await scraper.searchReal(searchQuery, 10);
    const searchTime = Date.now() - startSearch;
    
    testResults.search.success = searchResults.length > 0;
    testResults.search.details = {
      query: searchQuery,
      resultsCount: searchResults.length,
      timeMs: searchTime,
      firstThree: searchResults.slice(0, 3).map(r => ({
        number: r.accessionNumber,
        title: r.title.substring(0, 80) + '...'
      }))
    };
    
    console.log(`✅ Found ${searchResults.length} documents in ${searchTime}ms`);
    searchResults.slice(0, 3).forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.accessionNumber}: ${doc.title.substring(0, 60)}...`);
    });
    
    if (searchResults.length === 0) {
      throw new Error('No search results found');
    }
    
    // ========================================
    // 2. DOWNLOAD TEST
    // ========================================
    console.log('\n📥 PHASE 2: DOWNLOAD TEST');
    console.log('-'.repeat(50));
    
    downloadedDoc = searchResults[0];
    const pdfPath = path.join(__dirname, 'downloaded_pdfs', `${downloadedDoc.accessionNumber}_test.pdf`);
    
    console.log(`Downloading: ${downloadedDoc.accessionNumber}`);
    console.log(`Title: ${downloadedDoc.title.substring(0, 80)}...`);
    
    const startDownload = Date.now();
    const downloadSuccess = await scraper.downloadRealPDF(downloadedDoc.accessionNumber, pdfPath);
    const downloadTime = Date.now() - startDownload;
    
    if (!downloadSuccess) {
      throw new Error('Download failed');
    }
    
    const stats = await fs.stat(pdfPath);
    testResults.download.success = true;
    testResults.download.details = {
      documentNumber: downloadedDoc.accessionNumber,
      title: downloadedDoc.title,
      fileSizeKB: (stats.size / 1024).toFixed(2),
      timeMs: downloadTime,
      path: pdfPath
    };
    
    console.log(`✅ Downloaded successfully`);
    console.log(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`  Time: ${downloadTime}ms`);
    
    // ========================================
    // 3. RAG INITIALIZATION TEST
    // ========================================
    console.log('\n🧠 PHASE 3: RAG INITIALIZATION');
    console.log('-'.repeat(50));
    
    // PDF 텍스트 추출
    console.log('Extracting text from PDF...');
    const pdfBuffer = await fs.readFile(pdfPath);
    let extractedText = '';
    
    try {
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text;
      console.log(`✅ Extracted ${extractedText.length} characters`);
    } catch (error) {
      console.log('⚠️ PDF text extraction failed, using fallback');
      extractedText = `Document ${downloadedDoc.accessionNumber}: ${downloadedDoc.title}. Content unavailable due to extraction error.`;
    }
    
    // RAG에 문서 추가
    console.log('Adding document to RAG engine...');
    const startRAG = Date.now();
    
    await rag.addDocument(
      downloadedDoc.accessionNumber,
      extractedText,
      {
        documentNumber: downloadedDoc.accessionNumber,
        title: downloadedDoc.title,
        dateAdded: downloadedDoc.dateAdded
      }
    );
    
    const ragTime = Date.now() - startRAG;
    const ragStats = rag.getStats();
    
    testResults.ragInit.success = true;
    testResults.ragInit.details = {
      provider: ragStats.provider,
      hasEmbeddings: ragStats.hasEmbeddings,
      totalChunks: ragStats.totalChunks,
      timeMs: ragTime,
      textLength: extractedText.length
    };
    
    console.log(`✅ RAG initialized with ${ragStats.provider}`);
    console.log(`  Chunks created: ${ragStats.totalChunks}`);
    console.log(`  Has embeddings: ${ragStats.hasEmbeddings}`);
    
    // ========================================
    // 4. Q&A TEST
    // ========================================
    console.log('\n❓ PHASE 4: Q&A TEST');
    console.log('-'.repeat(50));
    
    const questions = [
      "What is the main topic of this document?",
      "What safety measures are discussed?",
      "Are there any regulatory requirements mentioned?",
      "What is the document number?",
      "What are the key findings or conclusions?"
    ];
    
    for (const question of questions) {
      console.log(`\nQ: ${question}`);
      
      try {
        const startQA = Date.now();
        const searchResults = await rag.search(question, 3);
        const qaTime = Date.now() - startQA;
        
        if (searchResults.length > 0) {
          const topResult = searchResults[0];
          console.log(`A: [Score: ${topResult.score.toFixed(3)}] ${topResult.text.substring(0, 150)}...`);
          
          testResults.qa.details.push({
            question,
            success: true,
            topScore: topResult.score,
            resultsCount: searchResults.length,
            timeMs: qaTime,
            preview: topResult.text.substring(0, 100)
          });
        } else {
          console.log('A: No relevant content found');
          testResults.qa.details.push({
            question,
            success: false,
            error: 'No results'
          });
        }
      } catch (error) {
        console.log(`A: Error - ${error.message}`);
        testResults.qa.details.push({
          question,
          success: false,
          error: error.message
        });
      }
    }
    
    testResults.qa.success = testResults.qa.details.filter(q => q.success).length > 0;
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    // 정리
    await scraper.cleanup();
    rag.clear();
    
    // ========================================
    // 5. TEST SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    
    const tests = [
      { name: 'Search', passed: testResults.search.success },
      { name: 'Download', passed: testResults.download.success },
      { name: 'RAG Init', passed: testResults.ragInit.success },
      { name: 'Q&A', passed: testResults.qa.success }
    ];
    
    testResults.summary.totalTests = tests.length;
    testResults.summary.passed = tests.filter(t => t.passed).length;
    testResults.summary.failed = tests.filter(t => !t.passed).length;
    
    tests.forEach(test => {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}: ${test.passed ? 'PASSED' : 'FAILED'}`);
    });
    
    console.log('\n📈 Performance Metrics:');
    if (testResults.search.success) {
      console.log(`  Search: ${testResults.search.details.timeMs}ms (${testResults.search.details.resultsCount} results)`);
    }
    if (testResults.download.success) {
      console.log(`  Download: ${testResults.download.details.timeMs}ms (${testResults.download.details.fileSizeKB} KB)`);
    }
    if (testResults.ragInit.success) {
      console.log(`  RAG Init: ${testResults.ragInit.details.timeMs}ms (${testResults.ragInit.details.totalChunks} chunks)`);
    }
    if (testResults.qa.success) {
      const avgTime = testResults.qa.details
        .filter(q => q.success && q.timeMs)
        .reduce((acc, q) => acc + q.timeMs, 0) / testResults.qa.details.filter(q => q.success).length;
      console.log(`  Q&A Avg: ${avgTime.toFixed(0)}ms`);
    }
    
    // 결과 파일 저장
    const reportPath = path.join(__dirname, 'logs', `test-report-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    console.log(`End Time: ${new Date().toISOString()}`);
    console.log('='.repeat(70));
    
    // 로그 파일 정보
    console.log('\n📁 Log Files:');
    console.log(`  Daily: logs/daily/app-${new Date().toISOString().split('T')[0]}.log`);
    console.log(`  Errors: logs/errors/error-${new Date().toISOString().split('T')[0]}.log`);
    
    return testResults;
  }
}

// 실행
runFullCycleTest()
  .then(results => {
    console.log('\n✅ Test cycle completed successfully');
    process.exit(results.summary.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ Test cycle failed:', error);
    process.exit(1);
  });