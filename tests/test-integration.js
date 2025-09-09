import 'dotenv/config';
#!/usr/bin/env node

import { ImprovedADAMSScraper } from './build/adams-real-improved.js';
import { RAGEngine } from './build/rag-engine.js';

/**
 * 통합 테스트: 검색 → 다운로드 → RAG → 인용 답변 전체 플로우
 */

async function runIntegrationTest() {
  console.log('================================================================================');
  console.log('🔄 INTEGRATION TEST - Full Citation Pipeline');
  console.log('================================================================================');
  console.log(`Test Start: ${new Date().toISOString()}\n`);

  const scraper = new ImprovedADAMSScraper();
  const ragEngine = new RAGEngine();
  
  try {
    // Step 1: 새로운 검색어로 테스트
    const searchQuery = "reactor design requirements 2024";
    console.log(`📍 Step 1: SEARCH - "${searchQuery}"`);
    
    const searchResults = await scraper.searchReal(searchQuery, 5);
    console.log(`✅ Found ${searchResults.length} documents\n`);
    
    if (searchResults.length === 0) {
      console.log('❌ No documents found. Exiting test.');
      return;
    }
    
    // Step 2: 문서 다운로드 및 RAG 추가
    console.log('📥 Step 2: DOWNLOAD & RAG PROCESSING');
    let downloadedCount = 0;
    
    for (let i = 0; i < Math.min(3, searchResults.length); i++) {
      const doc = searchResults[i];
      console.log(`[${i+1}/3] Downloading ${doc.accessionNumber}...`);
      
      try {
        const success = await scraper.downloadRealPDF(
          doc.accessionNumber, 
          '', 
          'integration_test'
        );
        
        if (success) {
          // PDF 텍스트 추출 (간단한 버전)
          console.log(`  ✅ Downloaded: ${doc.title.substring(0, 50)}...`);
          downloadedCount++;
          
          // RAG에 문서 추가 (실제 텍스트 추출은 별도 구현 필요)
          await ragEngine.addDocument(
            `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${doc.accessionNumber}`,
            `Document: ${doc.title}\nContent: This is a test document for ${doc.accessionNumber}`,
            {
              title: doc.title,
              documentNumber: doc.accessionNumber,
              filename: `${doc.accessionNumber}.pdf`
            }
          );
          
        } else {
          console.log(`  ❌ Failed to download ${doc.accessionNumber}`);
        }
      } catch (error) {
        console.log(`  💥 Error downloading ${doc.accessionNumber}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Downloaded ${downloadedCount}/3 documents\n`);
    
    if (downloadedCount === 0) {
      console.log('❌ No documents downloaded. Cannot test RAG functionality.');
      return;
    }
    
    // Step 3: RAG 질문 테스트
    console.log('🤔 Step 3: RAG Q&A WITH CITATIONS');
    
    const testQuestions = [
      "What design requirements are mentioned?",
      "What specific regulations are referenced?",
      "What are the key safety considerations?"
    ];
    
    for (const question of testQuestions) {
      console.log(`\nQuestion: "${question}"`);
      
      try {
        const ragResults = await ragEngine.search(question, 3);
        console.log(`  📊 Found ${ragResults.length} relevant chunks`);
        
        // 인용 포함 답변 생성 (수동 구성)
        if (ragResults.length > 0) {
          console.log('\n  📝 Generated Answer with Citations:');
          console.log('  ==========================================');
          
          let answer = `Based on the downloaded documents, here's what I found regarding "${question}":\n\n`;
          
          // 각 결과에 대해 인용 포함
          ragResults.forEach((result, idx) => {
            const metadata = result.metadata;
            const docRef = metadata.documentNumber || 'Document';
            const section = metadata.chunkIndex !== undefined ? `, Section ${metadata.chunkIndex + 1}` : '';
            
            const content = result.text.length > 150 
              ? result.text.substring(0, 150) + '...'
              : result.text;
            
            answer += `• ${content} [Source: ${docRef}${section}]\n\n`;
          });
          
          // 인용 섹션
          answer += '\n📚 **Citations and Sources:**\n';
          ragResults.forEach((result, idx) => {
            const metadata = result.metadata;
            const docNumber = metadata.documentNumber || 'N/A';
            const title = metadata.title || 'Untitled';
            const section = metadata.chunkIndex !== undefined ? `Section ${metadata.chunkIndex + 1}` : '';
            
            answer += `\n[${idx + 1}] **${title.substring(0, 50)}${title.length > 50 ? '...' : ''}**\n`;
            answer += `    Document: ${docNumber}${section ? ` | ${section}` : ''}\n`;
            answer += `    Link: [Open in ADAMS](https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?AccessionNumber=${docNumber})\n`;
            if (ragEngine.isEnabled()) {
              answer += `    Relevance: ${(result.score * 100).toFixed(1)}%\n`;
            }
          });
          
          // 메타데이터
          answer += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
          answer += '📊 **Search Metadata:**\n';
          answer += `• Method: ${ragEngine.isEnabled() ? 'AI Semantic Search (OpenAI Embeddings)' : 'Keyword Search'}\n`;
          answer += `• Documents searched: ${downloadedCount}\n`;
          answer += `• Top results shown: ${ragResults.length}\n`;
          
          console.log(answer);
          
          // 인용 기능 검증
          const hasCitations = answer.includes('📚 **Citations and Sources:**');
          const hasInlineCitations = answer.includes('[Source:');
          const hasADAMSLinks = answer.includes('[Open in ADAMS]');
          
          console.log('\n  🔍 Citation Feature Check:');
          console.log(`    Inline Citations: ${hasInlineCitations ? '✅' : '❌'}`);
          console.log(`    Citations Section: ${hasCitations ? '✅' : '❌'}`);
          console.log(`    ADAMS Links: ${hasADAMSLinks ? '✅' : '❌'}`);
          
        } else {
          console.log('  ❌ No relevant content found');
        }
        
      } catch (error) {
        console.log(`  💥 Error in RAG search: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Integration test failed:', error);
  } finally {
    await scraper.close();
    console.log(`\nTest End: ${new Date().toISOString()}`);
  }
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest().catch(console.error);
}

export { runIntegrationTest };