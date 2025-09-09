import 'dotenv/config';
import { ImprovedADAMSScraper } from '../build/adams-real-improved.js';
import { RAGEngine } from '../build/rag-engine.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const typeColors = {
    'success': colors.green,
    'error': colors.red,
    'warning': colors.yellow,
    'info': colors.blue,
    'test': colors.magenta
  };
  const color = typeColors[type] || colors.reset;
  console.log(`${timestamp} ${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 정확도 평가를 위한 Ground Truth 데이터셋
const groundTruthQuestions = [
  {
    id: 'NUCLEAR_SAFETY_01',
    question: 'What are the main safety requirements for nuclear reactors?',
    expectedKeywords: [
      'safety systems', 'containment', 'emergency core cooling', 
      'reactor protection system', 'defense in depth', '10 CFR Part 50'
    ],
    expectedSources: ['CFR', 'safety evaluation', 'technical specification'],
    category: 'safety_requirements',
    difficulty: 'basic'
  },
  {
    id: 'EMERGENCY_01',
    question: 'What emergency planning requirements apply to nuclear facilities?',
    expectedKeywords: [
      'emergency planning zone', 'EPZ', 'evacuation', 'notification',
      'emergency response', '10 CFR Part 50.47'
    ],
    expectedSources: ['emergency plan', 'NUREG'],
    category: 'emergency_planning',
    difficulty: 'intermediate'
  },
  {
    id: 'REGULATION_01',
    question: 'What does 10 CFR Part 50 require for reactor licensing?',
    expectedKeywords: [
      'construction permit', 'operating license', 'safety analysis',
      'environmental report', 'technical specifications'
    ],
    expectedSources: ['10 CFR Part 50', 'Code of Federal Regulations'],
    category: 'regulations',
    difficulty: 'advanced'
  },
  {
    id: 'TECH_SPEC_01',
    question: 'What are reactor protection system requirements?',
    expectedKeywords: [
      'reactor trip', 'safety limit', 'limiting safety system',
      'control rod', 'scram', 'reactivity control'
    ],
    expectedSources: ['technical specification', 'safety analysis'],
    category: 'technical',
    difficulty: 'advanced'
  },
  {
    id: 'SMR_01',
    question: 'What are the key safety features of small modular reactors?',
    expectedKeywords: [
      'passive safety', 'small modular reactor', 'SMR', 
      'natural circulation', 'inherent safety'
    ],
    expectedSources: ['SMR', 'design certification'],
    category: 'new_technology',
    difficulty: 'intermediate'
  }
];

// 정확도 평가 함수들
class AccuracyEvaluator {
  constructor() {
    this.results = [];
  }

  // 키워드 일치도 평가 (0-1 점수)
  evaluateKeywordMatch(answer, expectedKeywords) {
    if (!answer || !expectedKeywords.length) return 0;
    
    const lowerAnswer = answer.toLowerCase();
    const matchedKeywords = expectedKeywords.filter(keyword => 
      lowerAnswer.includes(keyword.toLowerCase())
    );
    
    return matchedKeywords.length / expectedKeywords.length;
  }

  // 출처 신뢰도 평가 (0-1 점수)  
  evaluateSourceRelevance(citations, expectedSources) {
    if (!citations.length || !expectedSources.length) return 0;
    
    const citationTexts = citations.map(c => c.metadata?.title || c.text || '').join(' ').toLowerCase();
    const matchedSources = expectedSources.filter(source =>
      citationTexts.includes(source.toLowerCase())
    );
    
    return matchedSources.length / expectedSources.length;
  }

  // 답변 완성도 평가 (휴리스틱)
  evaluateCompleteness(answer, expectedKeywords) {
    if (!answer) return 0;
    
    // 기본 길이 점수 (50-500자 사이가 적절)
    const lengthScore = Math.min(Math.max(answer.length - 50, 0) / 450, 1);
    
    // 구조 점수 (문단, 목록 등)
    const structureScore = answer.includes('\n') || answer.includes('•') || 
                          answer.includes('-') || answer.includes('1.') ? 0.2 : 0;
    
    // 키워드 밀도 점수
    const keywordDensity = this.evaluateKeywordMatch(answer, expectedKeywords);
    
    return (lengthScore * 0.5 + structureScore + keywordDensity * 0.3);
  }

  // 종합 정확도 점수 계산
  calculateAccuracyScore(evaluation) {
    const weights = {
      keyword_match: 0.4,
      source_relevance: 0.3, 
      completeness: 0.3
    };
    
    return (
      evaluation.keyword_match * weights.keyword_match +
      evaluation.source_relevance * weights.source_relevance +
      evaluation.completeness * weights.completeness
    );
  }
}

// 메인 정확도 테스트 함수
async function runAccuracyTest() {
  log('🎯 정확도 평가 테스트 시작', 'test');
  log('=' .repeat(70), 'info');

  const scraper = new ImprovedADAMSScraper();
  const ragEngine = new RAGEngine();
  const evaluator = new AccuracyEvaluator();

  try {
    // 1. 테스트용 문서 다운로드
    log('📥 테스트용 문서 준비 중...', 'info');
    const searchQueries = ['reactor safety analysis', 'emergency planning', '10 CFR Part 50'];
    
    for (const query of searchQueries) {
      try {
        log(`   검색: "${query}"`, 'info');
        const searchResults = await scraper.searchReal(query, 10);
        
        if (searchResults.length > 0) {
          // 상위 2개 문서 다운로드
          for (let i = 0; i < Math.min(2, searchResults.length); i++) {
            const doc = searchResults[i];
            try {
              const result = await scraper.downloadRealPDF(
                doc.accessionNumber,
                doc.downloadUrl || '',
                query
              );
              if (result) {
                log(`     ✓ 다운로드 성공: ${doc.accessionNumber}`, 'success');
              }
            } catch (e) {
              log(`     ❌ 다운로드 실패: ${e.message}`, 'error');
            }
          }
        }
      } catch (e) {
        log(`   검색 실패: ${query} - ${e.message}`, 'error');
      }
    }

    // 2. 각 질문에 대한 정확도 평가
    log('\n🧠 RAG 답변 정확도 평가 시작', 'test');
    log('-'.repeat(50), 'info');

    const evaluationResults = [];

    for (const testCase of groundTruthQuestions) {
      log(`\n📋 테스트: ${testCase.id}`, 'test');
      log(`   질문: "${testCase.question}"`, 'info');
      log(`   난이도: ${testCase.difficulty}, 카테고리: ${testCase.category}`, 'info');

      try {
        // RAG 검색 실행
        const searchResults = await ragEngine.search(testCase.question, 5);
        
        if (searchResults.length === 0) {
          log('   ❌ RAG 검색 결과 없음', 'error');
          evaluationResults.push({
            id: testCase.id,
            question: testCase.question,
            answer: '',
            citations: [],
            evaluation: {
              keyword_match: 0,
              source_relevance: 0,
              completeness: 0,
              accuracy_score: 0
            },
            category: testCase.category,
            difficulty: testCase.difficulty
          });
          continue;
        }

        // 답변 생성 (상위 결과들을 종합)
        const answer = searchResults.map(r => r.text).join('\n\n').substring(0, 1000);
        const citations = searchResults;

        // 정확도 평가
        const evaluation = {
          keyword_match: evaluator.evaluateKeywordMatch(answer, testCase.expectedKeywords),
          source_relevance: evaluator.evaluateSourceRelevance(citations, testCase.expectedSources),
          completeness: evaluator.evaluateCompleteness(answer, testCase.expectedKeywords)
        };
        
        evaluation.accuracy_score = evaluator.calculateAccuracyScore(evaluation);

        evaluationResults.push({
          id: testCase.id,
          question: testCase.question,
          answer: answer.substring(0, 200) + '...',
          citations: citations.length,
          evaluation,
          category: testCase.category,
          difficulty: testCase.difficulty
        });

        // 결과 출력
        log(`   키워드 일치도: ${(evaluation.keyword_match * 100).toFixed(1)}%`, 
            evaluation.keyword_match > 0.6 ? 'success' : 'warning');
        log(`   출처 관련성: ${(evaluation.source_relevance * 100).toFixed(1)}%`,
            evaluation.source_relevance > 0.5 ? 'success' : 'warning');  
        log(`   답변 완성도: ${(evaluation.completeness * 100).toFixed(1)}%`,
            evaluation.completeness > 0.6 ? 'success' : 'warning');
        log(`   종합 정확도: ${(evaluation.accuracy_score * 100).toFixed(1)}%`,
            evaluation.accuracy_score > 0.7 ? 'success' : 
            evaluation.accuracy_score > 0.5 ? 'warning' : 'error');

      } catch (error) {
        log(`   ❌ 평가 실패: ${error.message}`, 'error');
      }
    }

    // 3. 종합 결과 분석
    log('\n' + '='.repeat(70), 'info');
    log('📊 정확도 평가 결과 분석', 'test');
    log('='.repeat(70), 'info');

    const validResults = evaluationResults.filter(r => r.evaluation.accuracy_score > 0);
    
    if (validResults.length === 0) {
      log('❌ 유효한 평가 결과가 없습니다', 'error');
      return;
    }

    // 전체 평균 정확도
    const avgAccuracy = validResults.reduce((sum, r) => sum + r.evaluation.accuracy_score, 0) / validResults.length;
    const avgKeywordMatch = validResults.reduce((sum, r) => sum + r.evaluation.keyword_match, 0) / validResults.length;
    const avgSourceRelevance = validResults.reduce((sum, r) => sum + r.evaluation.source_relevance, 0) / validResults.length;
    const avgCompleteness = validResults.reduce((sum, r) => sum + r.evaluation.completeness, 0) / validResults.length;

    log(`🎯 전체 평균 정확도: ${(avgAccuracy * 100).toFixed(1)}%`, 
        avgAccuracy > 0.7 ? 'success' : avgAccuracy > 0.5 ? 'warning' : 'error');
    log(`   키워드 일치도: ${(avgKeywordMatch * 100).toFixed(1)}%`, 'info');
    log(`   출처 관련성: ${(avgSourceRelevance * 100).toFixed(1)}%`, 'info');
    log(`   답변 완성도: ${(avgCompleteness * 100).toFixed(1)}%`, 'info');

    // 카테고리별 분석
    const categories = {};
    validResults.forEach(r => {
      if (!categories[r.category]) categories[r.category] = [];
      categories[r.category].push(r.evaluation.accuracy_score);
    });

    log('\n📈 카테고리별 정확도:', 'info');
    Object.entries(categories).forEach(([category, scores]) => {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      log(`   ${category}: ${(avgScore * 100).toFixed(1)}%`, 'info');
    });

    // 난이도별 분석
    const difficulties = {};
    validResults.forEach(r => {
      if (!difficulties[r.difficulty]) difficulties[r.difficulty] = [];
      difficulties[r.difficulty].push(r.evaluation.accuracy_score);
    });

    log('\n📊 난이도별 정확도:', 'info');
    Object.entries(difficulties).forEach(([difficulty, scores]) => {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      log(`   ${difficulty}: ${(avgScore * 100).toFixed(1)}%`, 'info');
    });

    // 결과 저장
    const resultPath = path.join(__dirname, '..', 'test-results', `accuracy-test-${Date.now()}.json`);
    await fs.mkdir(path.join(__dirname, '..', 'test-results'), { recursive: true });
    await fs.writeFile(resultPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total_questions: evaluationResults.length,
        valid_results: validResults.length,
        avg_accuracy: avgAccuracy,
        avg_keyword_match: avgKeywordMatch,
        avg_source_relevance: avgSourceRelevance,
        avg_completeness: avgCompleteness
      },
      by_category: categories,
      by_difficulty: difficulties,
      detailed_results: evaluationResults
    }, null, 2));
    
    log(`\n📁 상세 결과 저장: ${resultPath}`, 'info');

  } finally {
    await scraper.close();
  }
}

// 실행
runAccuracyTest().catch(console.error);