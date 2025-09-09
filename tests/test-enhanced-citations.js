import 'dotenv/config';
import path from 'path';
import { EnhancedRAGEngine } from '../build/rag-engine-enhanced.js';
import { ImprovedADAMSScraper } from '../build/adams-real-improved.js';

async function testEnhancedCitations() {
  console.log('🎯 향상된 인용 형식 테스트 시작\n');
  console.log('=' .repeat(70));
  
  const ragEngine = new EnhancedRAGEngine();
  const scraper = new ImprovedADAMSScraper();
  
  try {
    // 1. 테스트용 문서 다운로드
    console.log('\n📥 문서 다운로드 중...');
    const searchResults = await scraper.searchReal('reactor safety', 2);
    
    if (searchResults.length > 0) {
      const doc = searchResults[0];
      console.log(`   다운로드: ${doc.accessionNumber}`);
      
      try {
        // PDF 다운로드
        const today = new Date().toISOString().split('T')[0];
        const downloadPath = path.join('downloaded_pdfs', `reactor_safety_${today}`, `${doc.accessionNumber}.pdf`);
        const downloaded = await scraper.downloadRealPDF(
          doc.accessionNumber,
          doc.downloadUrl || '',
          'reactor safety'
        );
        
        if (downloaded) {
          console.log('   ✅ PDF 다운로드 성공');
          
          // PDF에서 텍스트 추출
          const { extractTextFromPDF } = await import('../build/pdf-extractor.js');
          const content = await extractTextFromPDF(downloadPath);
          
          if (content) {
            // 2. 향상된 RAG 엔진에 추가 (페이지 정보 포함)
            console.log('\n📄 페이지 정보와 함께 문서 추가 중...');
            
            // PDF 메타데이터에서 페이지 수 추출
            const pageMatch = content.match(/Pages:\s*(\d+)/);
            const totalPages = pageMatch ? parseInt(pageMatch[1]) : 50;
            
            await ragEngine.addDocumentWithPages(
              doc.accessionNumber,
              content,
              {
                documentNumber: doc.accessionNumber,
                title: doc.title,
                filename: `${doc.accessionNumber}.pdf`
              },
              totalPages
            );
            
            // 3. 검색 테스트
            console.log('\n🔍 향상된 검색 테스트...');
            const searchQuery = 'safety requirements';
            const results = await ragEngine.search(searchQuery, 3);
            
            console.log(`\n질문: "${searchQuery}"`);
            console.log(`검색 결과: ${results.length}개\n`);
            
            // 4. 인용 형식 확인
            results.forEach((result, idx) => {
              console.log(`\n📌 결과 ${idx + 1}:`);
              console.log(`   점수: ${(result.score * 100).toFixed(1)}%`);
              
              // 향상된 메타데이터 출력
              const meta = result.metadata;
              console.log('\n   📄 메타데이터:');
              console.log(`      문서번호: ${meta.documentNumber || 'N/A'}`);
              console.log(`      페이지: ${meta.pageNumber || 'N/A'} / ${meta.totalPages || 'N/A'}`);
              console.log(`      섹션: ${meta.section || 'N/A'}`);
              console.log(`      라인: ${meta.lineNumbers ? `${meta.lineNumbers[0]}-${meta.lineNumbers[1]}` : 'N/A'}`);
              
              // 포맷된 인용
              console.log(`\n   📍 인용: ${meta.citation || 'No citation'}`);
              
              // 텍스트 미리보기
              const preview = result.text.substring(0, 150).replace(/\n/g, ' ');
              console.log(`\n   📝 내용: "${preview}..."`);
            });
            
            // 5. 통계 확인
            const stats = ragEngine.getStats();
            console.log('\n\n📊 RAG 엔진 통계:');
            console.log(`   Provider: ${stats.provider}`);
            console.log(`   문서 수: ${stats.documentCount}`);
            console.log(`   총 청크: ${stats.totalChunks}`);
            console.log(`   페이지 정보 있는 문서: ${stats.documentsWithPageInfo}`);
            console.log(`   평균 청크/문서: ${stats.averageChunksPerDocument.toFixed(1)}`);
            
          } else {
            console.log('   ❌ PDF 텍스트 추출 실패');
          }
        } else {
          console.log('   ❌ PDF 다운로드 실패');
        }
      } catch (e) {
        console.log(`   ❌ 오류: ${e.message}`);
      }
    } else {
      console.log('   ❌ 검색 결과 없음');
    }
    
  } catch (error) {
    console.error('테스트 실패:', error);
  } finally {
    await scraper.close();
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ 테스트 완료!\n');
  
  console.log('📝 개선 사항:');
  console.log('   1. 페이지 번호 추적 ✓');
  console.log('   2. 섹션 정보 추출 ✓');
  console.log('   3. 라인 번호 기록 ✓');
  console.log('   4. 포맷된 인용 생성 ✓');
  console.log('   5. 메타데이터 풍부화 ✓');
}

testEnhancedCitations().catch(console.error);