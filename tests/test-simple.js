import 'dotenv/config';
import { ImprovedADAMSScraper } from './build/adams-real-improved.js';
import { RAGEngine } from './build/rag-engine.js';
import { getKeywordStatistics } from './build/utils.js';
import { ComplianceChecker } from './build/logger-privacy.js';
import fs from 'fs/promises';
import path from 'path';

async function extractTextFromPDF(pdfPath) {
  try {
    // Dynamic import of pdf-extractor module
    const { extractTextFromPDF: extractPDF } = await import('./build/pdf-extractor.js');
    const text = await extractPDF(pdfPath);
    
    if (!text) {
      console.warn(`No text extracted from ${pdfPath}`);
      // Fallback to basic info
      const stats = await fs.stat(pdfPath);
      return `[PDF: ${path.basename(pdfPath)}]\nSize: ${(stats.size / 1024).toFixed(2)} KB\nContent extraction failed - may be scanned document.`;
    }
    
    return text;
  } catch (error) {
    console.error(`Failed to extract text from ${pdfPath}:`, error.message);
    return null;
  }
}

async function runSimpleTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 SIMPLE TEST - 1 Search, 10 Downloads, 10 RAG Questions');
  console.log('='.repeat(80));
  console.log(`Test Start: ${new Date().toISOString()}`);
  
  const scraper = new ImprovedADAMSScraper();
  const rag = new RAGEngine();
  
  const testResults = {
    searchQuery: '',
    searchResults: 0,
    downloadsAttempted: 0,
    downloadsSucceeded: 0,
    downloadedFiles: [],
    ragDocuments: 0,
    ragQuestions: [],
    privacyCompliance: null
  };
  
  try {
    // 1. 단일 검색 수행
    const searchQuery = 'reactor safety analysis emergency planning';
    testResults.searchQuery = searchQuery;
    
    console.log('\n📍 Step 1: SEARCH');
    console.log(`Query: "${searchQuery}"`);
    console.log('Target: Find 10+ documents for download\n');
    
    const searchStart = Date.now();
    const searchResults = await scraper.searchReal(searchQuery, 15); // 15개 요청 (여유분)
    const searchTime = Date.now() - searchStart;
    
    testResults.searchResults = searchResults.length;
    console.log(`✅ Found ${searchResults.length} documents in ${searchTime}ms`);
    
    if (searchResults.length === 0) {
      console.log('❌ No search results found. Exiting test.');
      return;
    }
    
    // 검색 결과 표시
    console.log('\nSearch Results:');
    searchResults.slice(0, 10).forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.accessionNumber}: ${doc.title.substring(0, 60)}...`);
    });
    
    // 2. 10개 문서 다운로드
    console.log('\n📥 Step 2: DOWNLOAD 10 DOCUMENTS');
    const downloadLimit = Math.min(10, searchResults.length);
    testResults.downloadsAttempted = downloadLimit;
    
    console.log(`Downloading ${downloadLimit} documents...\n`);
    
    for (let i = 0; i < downloadLimit; i++) {
      const doc = searchResults[i];
      console.log(`[${i+1}/${downloadLimit}] Downloading ${doc.accessionNumber}...`);
      
      const downloadStart = Date.now();
      try {
        const success = await scraper.downloadRealPDF(
          doc.accessionNumber,
          '',
          searchQuery // 키워드 기반 폴더
        );
        
        const downloadTime = Date.now() - downloadStart;
        
        if (success) {
          console.log(`  ✅ Downloaded in ${downloadTime}ms`);
          testResults.downloadsSucceeded++;
          
          // PDF 경로 계산
          const folderName = searchQuery
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_\-]/g, '');
          const date = new Date().toISOString().split('T')[0];
          const pdfPath = `downloaded_pdfs/${folderName}_${date}/${doc.accessionNumber}.pdf`;
          
          testResults.downloadedFiles.push({
            accessionNumber: doc.accessionNumber,
            title: doc.title,
            path: pdfPath
          });
          
          // 3. RAG에 문서 추가 (실제 PDF 텍스트 추출)
          const pdfText = await extractTextFromPDF(pdfPath);
          if (pdfText) {
            await rag.addDocument(doc.accessionNumber, pdfText, {
              title: doc.title,
              datePublished: doc.datePublished || 'Unknown',
              documentType: doc.documentType || 'Report'
            });
            testResults.ragDocuments++;
          }
        } else {
          console.log(`  ❌ Download failed`);
        }
      } catch (error) {
        console.log(`  ❌ Download error: ${error.message}`);
      }
      
      // Rate limiting
      if (i < downloadLimit - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`\n📊 Download Summary: ${testResults.downloadsSucceeded}/${testResults.downloadsAttempted} succeeded`);
    
    // 4. RAG 질문 10개
    console.log('\n🧠 Step 3: RAG - 10 QUESTIONS');
    console.log(`Documents in RAG: ${testResults.ragDocuments}`);
    
    if (testResults.ragDocuments > 0) {
      const questions = [
        'What are the main safety requirements for nuclear reactors?',
        'Describe the emergency core cooling system procedures',
        'What inspection criteria are used for reactor vessels?',
        'How is reactor safety analysis performed?',
        'What are the regulatory requirements for emergency planning?',
        'Explain the containment system design requirements',
        'What are the radiation protection standards mentioned?',
        'Describe the quality assurance program requirements',
        'What are the technical specifications for reactor operation?',
        'How are safety margins calculated in the analysis?'
      ];
      
      console.log('\nAsking RAG questions:');
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        console.log(`\nQ${i+1}: ${q}`);
        
        try {
          const results = await rag.search(q, 3);
          testResults.ragQuestions.push({
            question: q,
            resultCount: results.length,
            topScore: results[0]?.score || 0
          });
          
          if (results.length > 0) {
            console.log(`  ✅ Found ${results.length} relevant chunks`);
            console.log(`  Top result (score: ${results[0].score.toFixed(2)}):`);
            console.log(`    Text: "${results[0].text.substring(0, 100)}..."`);
            
            // Add citation info
            const topResult = results[0];
            if (topResult.metadata) {
              const docNum = topResult.metadata.documentNumber || 'Unknown';
              const title = topResult.metadata.title || 'No title';
              const pageNum = topResult.metadata.pageNumber || 'N/A';
              
              // Build file path
              const folderName = testResults.searchQuery
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_\-]/g, '');
              const date = new Date().toISOString().split('T')[0];
              const filePath = `downloaded_pdfs/${folderName}_${date}/${docNum}.pdf`;
              
              console.log(`    Citation: ${docNum} - ${title.substring(0, 50)}...`);
              console.log(`    File: ${filePath}`);
              console.log(`    Page: ${pageNum}`);
            }
          } else {
            console.log(`  ⚠️ No relevant results found`);
          }
        } catch (error) {
          console.log(`  ❌ RAG error: ${error.message}`);
          testResults.ragQuestions.push({
            question: q,
            error: error.message
          });
        }
      }
    } else {
      console.log('⚠️ No documents in RAG, skipping questions');
    }
    
    // 5. 개인정보 보호 검사
    console.log('\n🔒 Step 4: PRIVACY COMPLIANCE CHECK');
    
    const today = new Date().toISOString().split('T')[0];
    const logFiles = [
      `logs/daily/app-${today}.log`,
      `logs/errors/error-${today}.log`,
      `logs/audit/audit-${today}.log`
    ];
    
    let piiViolations = 0;
    for (const logFile of logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.split('\n');
        
        // Check for common PII patterns
        const piiPatterns = [
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
          /\d{3}-\d{3}-\d{4}/g, // Phone
          /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP
        ];
        
        for (const pattern of piiPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            // Exclude masked patterns
            const realMatches = matches.filter(m => 
              !m.includes('MASKED') && 
              !m.includes('0.0.0.0') &&
              !m.includes('127.0.0.1')
            );
            piiViolations += realMatches.length;
          }
        }
      } catch (error) {
        // Log file might not exist
      }
    }
    
    testResults.privacyCompliance = {
      violations: piiViolations,
      status: piiViolations === 0 ? 'COMPLIANT' : 'VIOLATIONS_FOUND'
    };
    
    console.log(`Privacy Status: ${testResults.privacyCompliance.status}`);
    console.log(`PII Violations: ${piiViolations}`);
    
    // 6. 폴더 통계
    console.log('\n📁 Step 5: FOLDER STATISTICS');
    const folderStats = await getKeywordStatistics();
    console.log(`Total Keywords: ${folderStats.totalKeywords}`);
    console.log(`Total Documents: ${folderStats.totalDocuments}`);
    console.log(`Total Size: ${(folderStats.totalSizeKB / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await scraper.cleanup();
    rag.clear();
    
    // 7. 최종 요약
    console.log('\n' + '═'.repeat(80));
    console.log('📈 TEST SUMMARY');
    console.log('═'.repeat(80));
    
    console.log(`\n📍 Search:`);
    console.log(`  Query: "${testResults.searchQuery}"`);
    console.log(`  Results: ${testResults.searchResults} documents found`);
    
    console.log(`\n📥 Downloads:`);
    console.log(`  Success Rate: ${testResults.downloadsSucceeded}/${testResults.downloadsAttempted}`);
    console.log(`  Success Percentage: ${((testResults.downloadsSucceeded/testResults.downloadsAttempted)*100).toFixed(1)}%`);
    
    console.log(`\n🧠 RAG:`);
    console.log(`  Documents Indexed: ${testResults.ragDocuments}`);
    console.log(`  Questions Asked: ${testResults.ragQuestions.length}`);
    const answeredQuestions = testResults.ragQuestions.filter(q => q.resultCount > 0).length;
    console.log(`  Questions Answered: ${answeredQuestions}/${testResults.ragQuestions.length}`);
    
    console.log(`\n🔒 Privacy:`);
    console.log(`  Status: ${testResults.privacyCompliance?.status || 'NOT_CHECKED'}`);
    console.log(`  Violations: ${testResults.privacyCompliance?.violations || 0}`);
    
    // 결과 파일 저장
    const reportPath = `logs/test-simple-report-${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Report saved: ${reportPath}`);
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Simple Test Completed');
    console.log(`End Time: ${new Date().toISOString()}`);
    console.log('═'.repeat(80));
  }
}

// 실행
runSimpleTest().catch(console.error);