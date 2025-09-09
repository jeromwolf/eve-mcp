import { RealADAMSScraper } from './build/adams-real.js';
import { RAGEngine } from './build/rag-engine.js';
import fs from 'fs/promises';
import path from 'path';

async function readPDF(filePath) {
  try {
    // 간단한 PDF 텍스트 추출 시도
    const buffer = await fs.readFile(filePath);
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
    
    // PDF 헤더 확인
    if (buffer.toString('utf-8', 0, 4) === '%PDF') {
      console.log('  Valid PDF detected');
      // PDF에서 읽을 수 있는 텍스트 추출 시도
      const textMatch = text.match(/[\x20-\x7E\n\r\t]+/g);
      if (textMatch) {
        return textMatch.join(' ').substring(0, 5000);
      }
    }
    return 'PDF content (binary)';
  } catch (error) {
    return 'PDF reading error';
  }
}

async function runQuickTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 NRC ADAMS MCP - Quick Test Cycle');
  console.log('='.repeat(70));
  console.log(`Start: ${new Date().toISOString()}`);
  
  const scraper = new RealADAMSScraper();
  const rag = new RAGEngine();
  
  try {
    // ========================================
    // 1. SEARCH TEST
    // ========================================
    console.log('\n📋 STEP 1: SEARCH TEST');
    console.log('-'.repeat(50));
    
    await scraper.initialize();
    const query = 'safety evaluation report';
    console.log(`Query: "${query}"`);
    
    const startSearch = Date.now();
    const results = await scraper.searchReal(query, 3);
    const searchTime = Date.now() - startSearch;
    
    console.log(`✅ Found ${results.length} documents in ${searchTime}ms`);
    
    if (results.length === 0) {
      console.log('No results. Trying simpler query...');
      const results2 = await scraper.searchReal('ML24', 3);
      results.push(...results2);
    }
    
    results.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.accessionNumber}`);
      console.log(`     ${doc.title.substring(0, 70)}...`);
    });
    
    if (results.length === 0) {
      throw new Error('No search results found');
    }
    
    // ========================================
    // 2. DOWNLOAD TEST
    // ========================================
    console.log('\n📥 STEP 2: DOWNLOAD TEST');
    console.log('-'.repeat(50));
    
    const doc = results[0];
    const pdfPath = path.join('downloaded_pdfs', `${doc.accessionNumber}_quicktest.pdf`);
    
    console.log(`Downloading: ${doc.accessionNumber}`);
    
    const startDownload = Date.now();
    const success = await scraper.downloadRealPDF(doc.accessionNumber, pdfPath);
    const downloadTime = Date.now() - startDownload;
    
    if (success) {
      const stats = await fs.stat(pdfPath);
      console.log(`✅ Downloaded in ${downloadTime}ms`);
      console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`  Path: ${pdfPath}`);
      
      // ========================================
      // 3. RAG INITIALIZATION
      // ========================================
      console.log('\n🧠 STEP 3: RAG INITIALIZATION');
      console.log('-'.repeat(50));
      
      console.log(`Provider: ${rag.getProvider()}`);
      console.log(`Enabled: ${rag.isEnabled()}`);
      
      // PDF 텍스트 추출 (간소화)
      const pdfText = await readPDF(pdfPath);
      console.log(`  Text preview: ${pdfText.substring(0, 100)}...`);
      
      // RAG에 추가
      const startRAG = Date.now();
      await rag.addDocument(doc.accessionNumber, pdfText, {
        title: doc.title,
        date: doc.dateAdded
      });
      const ragTime = Date.now() - startRAG;
      
      const ragStats = rag.getStats();
      console.log(`✅ Document added in ${ragTime}ms`);
      console.log(`  Chunks: ${ragStats.totalChunks}`);
      console.log(`  Has embeddings: ${ragStats.hasEmbeddings}`);
      
      // ========================================
      // 4. Q&A TEST
      // ========================================
      console.log('\n❓ STEP 4: Q&A TEST');
      console.log('-'.repeat(50));
      
      const questions = [
        "What is the document number?",
        "What is the main topic?",
        "safety"
      ];
      
      for (const q of questions) {
        console.log(`\nQ: ${q}`);
        const startQA = Date.now();
        const searchResults = await rag.search(q, 2);
        const qaTime = Date.now() - startQA;
        
        if (searchResults.length > 0) {
          const top = searchResults[0];
          console.log(`A: [${qaTime}ms, Score: ${top.score.toFixed(3)}]`);
          console.log(`   ${top.text.substring(0, 120)}...`);
        } else {
          console.log(`A: No results found (${qaTime}ms)`);
        }
      }
      
    } else {
      console.log('❌ Download failed');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await scraper.close();
    rag.clear();
    
    // ========================================
    // 5. SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('✅ Test cycle completed');
    console.log(`End: ${new Date().toISOString()}`);
    
    // 로그 파일 위치
    const today = new Date().toISOString().split('T')[0];
    console.log('\n📁 Check logs:');
    console.log(`  ./logs/daily/app-${today}.log`);
    console.log(`  ./logs/errors/error-${today}.log`);
  }
}

runQuickTest().catch(console.error);