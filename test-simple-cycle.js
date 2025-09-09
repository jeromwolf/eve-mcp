import { RealADAMSScraper } from './build/adams-real.js';
import { RAGEngine } from './build/rag-engine.js';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import path from 'path';

async function runSimpleTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 NRC ADAMS MCP - Simple Cycle Test');
  console.log('='.repeat(70));
  
  const scraper = new RealADAMSScraper();
  const rag = new RAGEngine();
  
  try {
    // 1. SEARCH
    console.log('\n📋 PHASE 1: SEARCH');
    console.log('Searching for "reactor safety 2024"...');
    
    await scraper.initialize();
    const results = await scraper.searchReal('reactor safety 2024', 5);
    
    console.log(`Found ${results.length} documents:`);
    results.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.accessionNumber}: ${doc.title.substring(0, 60)}...`);
    });
    
    if (results.length === 0) {
      console.log('No results found. Trying different query...');
      const results2 = await scraper.searchReal('nuclear', 5);
      if (results2.length > 0) {
        results.push(...results2);
      }
    }
    
    // 2. DOWNLOAD
    if (results.length > 0) {
      console.log('\n📥 PHASE 2: DOWNLOAD');
      const doc = results[0];
      const pdfPath = `downloaded_pdfs/${doc.accessionNumber}_test.pdf`;
      
      console.log(`Downloading ${doc.accessionNumber}...`);
      const success = await scraper.downloadRealPDF(doc.accessionNumber, pdfPath);
      
      if (success) {
        console.log('✅ Download successful');
        const stats = await fs.stat(pdfPath);
        console.log(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // 3. RAG INIT
        console.log('\n🧠 PHASE 3: RAG INIT');
        console.log('RAG Provider:', rag.getProvider());
        
        try {
          const pdfBuffer = await fs.readFile(pdfPath);
          const pdfData = await pdfParse(pdfBuffer);
          const text = pdfData.text || 'Document content';
          
          await rag.addDocument(doc.accessionNumber, text, {
            title: doc.title,
            date: doc.dateAdded
          });
          
          const stats = rag.getStats();
          console.log(`✅ Document added: ${stats.totalChunks} chunks`);
          
          // 4. Q&A TEST
          console.log('\n❓ PHASE 4: Q&A');
          const questions = [
            "What is this document about?",
            "What is the document number?"
          ];
          
          for (const q of questions) {
            console.log(`\nQ: ${q}`);
            const results = await rag.search(q, 2);
            if (results.length > 0) {
              console.log(`A: [Score: ${results[0].score.toFixed(3)}] ${results[0].text.substring(0, 100)}...`);
            } else {
              console.log('A: No relevant content found');
            }
          }
        } catch (err) {
          console.log('⚠️ PDF parsing failed:', err.message);
        }
      } else {
        console.log('❌ Download failed');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await scraper.close();
    rag.clear();
    console.log('\n✅ Test completed');
  }
}

runSimpleTest().catch(console.error);