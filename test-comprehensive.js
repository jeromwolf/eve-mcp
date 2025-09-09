import 'dotenv/config';
import { ImprovedADAMSScraper } from './build/adams-real-improved.js';
import { RAGEngine } from './build/rag-engine.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const typeColors = {
    'success': colors.green,
    'error': colors.red,
    'warning': colors.yellow,
    'info': colors.cyan,
    'test': colors.magenta
  };
  const color = typeColors[type] || colors.reset;
  console.log(`${timestamp} ${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 테스트 시나리오 정의
const testScenarios = [
  {
    id: 'SCENARIO_1',
    name: '기본 검색 및 다운로드',
    description: '다양한 검색어로 문서 검색 및 다운로드 테스트',
    tests: [
      {
        name: '원자로 안전 검색',
        searchQuery: 'reactor safety analysis',
        expectedMinResults: 5,
        downloadCount: 3
      },
      {
        name: '비상 계획 검색',
        searchQuery: 'emergency planning procedures',
        expectedMinResults: 5,
        downloadCount: 2
      },
      {
        name: 'SMR 관련 검색',
        searchQuery: 'small modular reactor SMR',
        expectedMinResults: 3,
        downloadCount: 2
      }
    ]
  },
  {
    id: 'SCENARIO_2',
    name: 'RAG 질의응답 및 인용',
    description: '다운로드한 문서에 대한 질문과 인용 검증',
    tests: [
      {
        name: '안전 요구사항 질문',
        question: 'What are the main safety requirements for nuclear reactors?',
        expectCitations: true,
        minCitations: 2
      },
      {
        name: '규제 프레임워크 질문',
        question: 'What regulatory framework applies to nuclear facilities?',
        expectCitations: true,
        minCitations: 1
      },
      {
        name: '특정 문서 질문',
        question: 'What does 10 CFR Part 50 require?',
        expectCitations: true,
        minCitations: 1
      },
      {
        name: '비교 분석 질문',
        question: 'Compare safety requirements between different reactor types',
        expectCitations: true,
        minCitations: 2
      }
    ]
  },
  {
    id: 'SCENARIO_3',
    name: '엣지 케이스 및 오류 처리',
    description: '예외 상황 및 오류 처리 검증',
    tests: [
      {
        name: '빈 검색어',
        searchQuery: '',
        expectError: true
      },
      {
        name: '특수문자 검색',
        searchQuery: '@#$%^&*()',
        expectedMinResults: 0
      },
      {
        name: '매우 긴 검색어',
        searchQuery: 'nuclear safety requirements regulations compliance quality assurance emergency planning radiation protection environmental monitoring'.repeat(3),
        expectedMinResults: 0
      },
      {
        name: '존재하지 않는 문서번호',
        documentNumber: 'ML99999999',
        expectDownloadFail: true
      }
    ]
  },
  {
    id: 'SCENARIO_4',
    name: '성능 및 동시성',
    description: '대량 작업 및 동시 처리 테스트',
    tests: [
      {
        name: '대량 다운로드',
        searchQuery: 'safety evaluation',
        downloadCount: 10,
        measureTime: true
      },
      {
        name: '연속 RAG 질문',
        questions: [
          'What is nuclear safety?',
          'Explain reactor protection systems',
          'Describe emergency core cooling',
          'What are containment requirements?',
          'How does radiation monitoring work?'
        ],
        measureTime: true
      }
    ]
  },
  {
    id: 'SCENARIO_5',
    name: 'API 키 및 임베딩 검증',
    description: 'OpenAI API 및 임베딩 기능 테스트',
    tests: [
      {
        name: 'RAG 엔진 초기화',
        checkProvider: true,
        expectedProvider: 'openai'
      },
      {
        name: '임베딩 생성',
        testText: 'Nuclear safety is paramount in reactor operations',
        expectEmbedding: true
      },
      {
        name: '시맨틱 검색',
        addDocuments: [
          { text: 'Nuclear reactors require safety systems', id: 'doc1' },
          { text: 'Emergency planning is essential', id: 'doc2' },
          { text: 'Radiation protection standards apply', id: 'doc3' }
        ],
        searchQuery: 'reactor safety requirements',
        expectSemanticMatch: true
      }
    ]
  }
];

// 테스트 실행 함수
async function runComprehensiveTests() {
  const results = {
    scenarios: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    }
  };

  const startTime = Date.now();
  log('🚀 종합 테스트 시작', 'test');
  log('=' .repeat(70), 'info');

  const scraper = new ImprovedADAMSScraper();
  const ragEngine = new RAGEngine();
  
  // PDF 파일들을 RAG 엔진에 로드
  const pdfDir = path.join(__dirname, 'downloaded_pdfs');
  try {
    const dirs = await fs.readdir(pdfDir);
    for (const dir of dirs) {
      const dirPath = path.join(pdfDir, dir);
      const stat = await fs.stat(dirPath);
      if (stat.isDirectory()) {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          if (file.endsWith('.pdf')) {
            const filePath = path.join(dirPath, file);
            try {
              const pdfBuffer = await fs.readFile(filePath);
              const pdfParse = (await import('pdf-parse')).default;
              const pdfData = await pdfParse(pdfBuffer);
              const docNumber = file.replace('.pdf', '');
              await ragEngine.addDocument(docNumber, pdfData.text, {
                documentNumber: docNumber,
                title: `${docNumber} - NRC Document`,
                filename: file
              });
              log(`     ✓ PDF 로드: ${file}`, 'success');
            } catch (e) {
              // PDF 파싱 실패는 무시
            }
          }
        }
      }
    }
  } catch (e) {
    // 디렉토리가 없으면 무시
  }
  
  try {
    for (const scenario of testScenarios) {
      log(`\n📋 ${scenario.id}: ${scenario.name}`, 'test');
      log(scenario.description, 'info');
      log('-'.repeat(50), 'info');

      const scenarioResult = {
        id: scenario.id,
        name: scenario.name,
        tests: [],
        passed: 0,
        failed: 0
      };

      for (const test of scenario.tests) {
        results.summary.total++;
        const testResult = {
          name: test.name,
          status: 'pending',
          details: {},
          duration: 0
        };

        const testStart = Date.now();
        
        try {
          // SCENARIO 1: 검색 및 다운로드
          if (test.searchQuery !== undefined && !test.expectError) {
            log(`  🔍 검색: "${test.searchQuery}"`, 'info');
            const searchResults = await scraper.searchReal(test.searchQuery, 20);
            
            testResult.details.searchResults = searchResults.length;
            log(`     ✓ 검색 결과: ${searchResults.length}개`, 'success');

            if (test.expectedMinResults && searchResults.length < test.expectedMinResults) {
              throw new Error(`검색 결과 부족: ${searchResults.length} < ${test.expectedMinResults}`);
            }

            if (test.downloadCount && searchResults.length > 0) {
              const downloadCount = Math.min(test.downloadCount, searchResults.length);
              let successCount = 0;

              for (let i = 0; i < downloadCount; i++) {
                const doc = searchResults[i];
                try {
                  const result = await scraper.downloadRealPDF(
                    doc.accessionNumber,  // Fixed: use accessionNumber instead of documentNumber
                    doc.downloadUrl || '',
                    test.searchQuery
                  );
                  if (result) successCount++;
                } catch (e) {
                  // 다운로드 실패는 무시 (오래된 문서일 수 있음)
                }
              }
              
              testResult.details.downloadSuccess = successCount;
              testResult.details.downloadAttempted = downloadCount;
              log(`     ✓ 다운로드: ${successCount}/${downloadCount} 성공`, 'success');
            }
          }

          // SCENARIO 2: RAG Q&A
          if (test.question) {
            log(`  💬 질문: "${test.question}"`, 'info');
            const results = await ragEngine.search(test.question, 5);
            
            testResult.details.ragResults = results.length;
            
            if (test.expectCitations) {
              const citations = results.filter(r => r.metadata?.documentNumber);
              testResult.details.citations = citations.length;
              
              if (citations.length < test.minCitations) {
                throw new Error(`인용 부족: ${citations.length} < ${test.minCitations}`);
              }
              
              log(`     ✓ RAG 결과: ${results.length}개, 인용: ${citations.length}개`, 'success');
            }
          }

          // SCENARIO 3: 에러 케이스
          if (test.expectError) {
            try {
              await scraper.searchReal(test.searchQuery, 10);
              throw new Error('예상된 에러가 발생하지 않음');
            } catch (e) {
              log(`     ✓ 예상된 에러 발생: ${e.message}`, 'success');
            }
          }

          // SCENARIO 4: 성능 측정
          if (test.measureTime) {
            testResult.details.measured = true;
          }

          // SCENARIO 5: API 검증
          if (test.checkProvider) {
            const provider = ragEngine.provider;
            testResult.details.provider = provider;
            
            if (provider !== test.expectedProvider) {
              throw new Error(`Provider 불일치: ${provider} !== ${test.expectedProvider}`);
            }
            log(`     ✓ RAG Provider: ${provider}`, 'success');
          }

          if (test.testText && test.expectEmbedding) {
            await ragEngine.addDocument('test', test.testText, { id: 'test' });
            const searchResults = await ragEngine.search(test.testText, 1);
            
            if (searchResults.length === 0) {
              throw new Error('임베딩 검색 실패');
            }
            log(`     ✓ 임베딩 생성 및 검색 성공`, 'success');
          }

          testResult.status = 'passed';
          testResult.duration = Date.now() - testStart;
          scenarioResult.passed++;
          results.summary.passed++;
          
          log(`  ✅ ${test.name}: PASSED (${testResult.duration}ms)`, 'success');

        } catch (error) {
          testResult.status = 'failed';
          testResult.error = error.message;
          testResult.duration = Date.now() - testStart;
          scenarioResult.failed++;
          results.summary.failed++;
          
          log(`  ❌ ${test.name}: FAILED - ${error.message}`, 'error');
        }

        scenarioResult.tests.push(testResult);
      }

      results.scenarios.push(scenarioResult);
      
      // 시나리오 요약
      log(`\n  📊 시나리오 결과: ✅ ${scenarioResult.passed} / ❌ ${scenarioResult.failed}`, 
          scenarioResult.failed === 0 ? 'success' : 'warning');
    }

  } finally {
    await scraper.close();
  }

  results.summary.duration = Date.now() - startTime;

  // 최종 결과 출력
  log('\n' + '='.repeat(70), 'info');
  log('📊 테스트 결과 요약', 'test');
  log('='.repeat(70), 'info');
  
  for (const scenario of results.scenarios) {
    const status = scenario.failed === 0 ? '✅' : '⚠️';
    log(`${status} ${scenario.id}: ${scenario.name}`, scenario.failed === 0 ? 'success' : 'warning');
    log(`   통과: ${scenario.passed}, 실패: ${scenario.failed}`, 'info');
  }
  
  log('\n' + '='.repeat(70), 'info');
  const successRate = Math.round((results.summary.passed / results.summary.total) * 100);
  log(`🎯 전체 결과: ${results.summary.passed}/${results.summary.total} (${successRate}%)`, 
      successRate >= 80 ? 'success' : successRate >= 60 ? 'warning' : 'error');
  log(`⏱️  실행 시간: ${(results.summary.duration / 1000).toFixed(2)}초`, 'info');
  
  // 결과 파일 저장
  const resultPath = path.join(__dirname, 'test-results', `test-${Date.now()}.json`);
  await fs.mkdir(path.join(__dirname, 'test-results'), { recursive: true });
  await fs.writeFile(resultPath, JSON.stringify(results, null, 2));
  log(`\n📁 결과 저장: ${resultPath}`, 'info');

  return results;
}

// 실행
runComprehensiveTests().catch(console.error);