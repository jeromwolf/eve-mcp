import 'dotenv/config';
#!/usr/bin/env node

import { NRCADAMSMCPServer } from './build/index.js';

/**
 * 인용 기능 전용 테스트 케이스
 * - 다양한 질문 유형으로 인용 표시 확인
 * - 검색 결과 및 답변 형식 검증
 */

const TEST_QUESTIONS = [
  {
    name: "기술적 요구사항 질문",
    question: "What are the specific quality assurance requirements mentioned?",
    expectedKeywords: ["10 CFR Part 50", "ANSI", "quality assurance"]
  },
  {
    name: "표준 및 규정 질문", 
    question: "Which ANSI standards are referenced in the documents?",
    expectedKeywords: ["N45.2-1971", "Committee N45", "ANSI"]
  },
  {
    name: "보안 요구사항 질문",
    question: "What physical security requirements are described?",
    expectedKeywords: ["industrial sabotage", "physical security", "access control"]
  },
  {
    name: "일반적 안전 질문",
    question: "What are the main safety principles mentioned?",
    expectedKeywords: ["safety", "reactor", "nuclear"]
  },
  {
    name: "문서 특정 질문",
    question: "What does Safety Guide 28 specifically require?",
    expectedKeywords: ["Safety Guide 28", "construction", "design"]
  }
];

async function runCitationTest() {
  console.log('================================================================================');
  console.log('🔍 CITATION FUNCTIONALITY TEST');
  console.log('================================================================================');
  console.log(`Test Start: ${new Date().toISOString()}\n`);
  
  const server = new NRCADAMSMCPServer();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  try {
    // Step 1: 검색 및 문서 다운로드 (기존 캐시 사용 가능)
    console.log('📍 Step 1: Ensure documents are available');
    console.log('Using existing cached documents or downloading if needed...\n');
    
    // Step 2: 각 질문별 테스트
    for (const testCase of TEST_QUESTIONS) {
      console.log(`🧪 Testing: ${testCase.name}`);
      console.log(`Question: "${testCase.question}"`);
      totalTests++;
      
      try {
        // Q&A 실행
        const response = await server.askAboutDocuments({
          question: testCase.question
        });
        
        const answerText = response.content[0].text;
        
        // 인용 형식 확인
        const hasCitations = answerText.includes('📚 **Citations and Sources:**');
        const hasInlineCitations = answerText.includes('[Source:');
        const hasADAMSLinks = answerText.includes('[Open in ADAMS]');
        const hasRelevanceScores = answerText.includes('Relevance:');
        const hasSearchMetadata = answerText.includes('📊 **Search Metadata:**');
        
        // 키워드 확인
        const keywordMatches = testCase.expectedKeywords.filter(keyword => 
          answerText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // 결과 분석
        console.log('  ✅ 답변 생성: 성공');
        console.log(`  📚 인용 섹션: ${hasCitations ? '✅ 있음' : '❌ 없음'}`);
        console.log(`  📝 인라인 인용: ${hasInlineCitations ? '✅ 있음' : '❌ 없음'}`);
        console.log(`  🔗 ADAMS 링크: ${hasADAMSLinks ? '✅ 있음' : '❌ 없음'}`);
        console.log(`  📊 관련성 점수: ${hasRelevanceScores ? '✅ 있음' : '❌ 없음'}`);
        console.log(`  📈 검색 메타데이터: ${hasSearchMetadata ? '✅ 있음' : '❌ 없음'}`);
        console.log(`  🔍 키워드 매칭: ${keywordMatches.length}/${testCase.expectedKeywords.length} (${keywordMatches.join(', ')})`);
        
        // 성공 기준: 인용 관련 요소 중 최소 3개 이상 + 키워드 50% 이상
        const citationScore = [hasCitations, hasInlineCitations, hasADAMSLinks, hasRelevanceScores, hasSearchMetadata].filter(Boolean).length;
        const keywordScore = keywordMatches.length / testCase.expectedKeywords.length;
        
        if (citationScore >= 3 && keywordScore >= 0.5) {
          console.log('  🎉 결과: PASS\n');
          passedTests++;
        } else {
          console.log('  ❌ 결과: FAIL (인용 기능 미작동)\n');
          failedTests++;
          
          // 실패한 경우 답변 일부 출력
          console.log('  📄 답변 샘플 (첫 200자):');
          console.log(`  "${answerText.substring(0, 200)}..."\n`);
        }
        
      } catch (error) {
        console.log(`  💥 에러: ${error.message}`);
        console.log('  ❌ 결과: FAIL (실행 오류)\n');
        failedTests++;
      }
      
      // 테스트 간 간격
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 최종 결과
    console.log('================================================================================');
    console.log('📊 FINAL RESULTS');
    console.log('================================================================================');
    console.log(`총 테스트: ${totalTests}`);
    console.log(`성공: ${passedTests} ✅`);
    console.log(`실패: ${failedTests} ❌`);
    console.log(`성공률: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 모든 테스트 통과! 인용 기능이 올바르게 작동합니다.');
    } else if (passedTests > 0) {
      console.log('\n⚠️ 일부 테스트 실패. 인용 기능이 부분적으로 작동합니다.');
    } else {
      console.log('\n❌ 모든 테스트 실패. 인용 기능이 작동하지 않습니다.');
      console.log('💡 해결 방법:');
      console.log('   1. 클로드 데스크탑 완전 재시작 (Cmd+Q 후 재실행)');
      console.log('   2. 새 대화창에서 테스트');
      console.log('   3. 캐시 삭제: rm -rf ~/Library/Caches/com.anthropic.claude-desktop/');
    }
    
  } catch (error) {
    console.error('💥 테스트 실행 중 오류:', error);
  }
  
  console.log(`\nTest End: ${new Date().toISOString()}`);
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  runCitationTest().catch(console.error);
}

export { runCitationTest };