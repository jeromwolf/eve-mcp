#!/usr/bin/env node
import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface TestCase {
  name: string;
  request: any;
  expectedResponse?: string;
  shouldFail?: boolean;
}

const testCases: TestCase[] = [
  // 1. 검색 테스트
  {
    name: "기본 arXiv 검색",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search_papers",
        arguments: {
          query: "machine learning",
          max_results: 3
        }
      },
      id: 1
    }
  },
  {
    name: "PubMed 검색",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search_papers",
        arguments: {
          query: "COVID-19",
          site: "pubmed",
          max_results: 2
        }
      },
      id: 2
    }
  },
  {
    name: "잘못된 사이트",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search_papers",
        arguments: {
          query: "test",
          site: "invalid_site"
        }
      },
      id: 3
    },
    shouldFail: true
  },
  // 2. PDF 다운로드 테스트
  {
    name: "PDF 다운로드",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "download_pdf",
        arguments: {
          url: "https://arxiv.org/pdf/1706.03762.pdf"
        }
      },
      id: 4
    }
  },
  // 3. PDF 질의응답
  {
    name: "PDF에 질문",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "ask_about_pdf",
        arguments: {
          question: "What is attention mechanism?"
        }
      },
      id: 5
    }
  },
  // 4. PDF 목록
  {
    name: "다운로드한 PDF 목록",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "list_downloaded_pdfs",
        arguments: {}
      },
      id: 6
    }
  },
  // 5. 도구 목록
  {
    name: "사용 가능한 도구 확인",
    request: {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 7
    }
  }
];

async function runTest(testCase: TestCase): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n🧪 테스트: ${testCase.name}`);
    console.log('📤 요청:', JSON.stringify(testCase.request, null, 2));
    
    const mcpProcess = spawn('node', ['../build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let error = '';
    
    mcpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mcpProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    mcpProcess.on('close', (code) => {
      try {
        const response = JSON.parse(output);
        
        if (testCase.shouldFail) {
          if (response.error) {
            console.log('✅ 예상대로 실패:', response.error.message);
            resolve(true);
          } else {
            console.log('❌ 실패해야 하는데 성공함');
            resolve(false);
          }
        } else {
          if (response.error) {
            console.log('❌ 오류 발생:', response.error.message);
            resolve(false);
          } else {
            console.log('✅ 성공');
            console.log('📥 응답:', JSON.stringify(response, null, 2).substring(0, 200) + '...');
            resolve(true);
          }
        }
      } catch (e) {
        console.log('❌ 파싱 오류:', e);
        console.log('출력:', output);
        console.log('오류:', error);
        resolve(false);
      }
    });
    
    // Send request
    mcpProcess.stdin.write(JSON.stringify(testCase.request) + '\n');
    mcpProcess.stdin.end();
    
    // Timeout
    setTimeout(() => {
      mcpProcess.kill();
      console.log('❌ 타임아웃');
      resolve(false);
    }, 30000);
  });
}

async function runAllTests() {
  console.log('🚀 EVE MCP 테스트 시작\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n📊 테스트 결과:');
  console.log(`✅ 성공: ${passed}`);
  console.log(`❌ 실패: ${failed}`);
  console.log(`📈 성공률: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
}

// CLI 모드
if (process.argv[2] === '--interactive') {
  console.log('🎮 대화형 테스트 모드');
  console.log('사용법: 테스트 번호를 입력하세요 (0-6), 종료는 q');
  
  process.stdin.on('data', async (data) => {
    const input = data.toString().trim();
    if (input === 'q') {
      process.exit(0);
    }
    
    const index = parseInt(input);
    if (index >= 0 && index < testCases.length) {
      await runTest(testCases[index]);
    } else {
      console.log('잘못된 번호입니다');
    }
    
    console.log('\n다음 테스트 번호: ');
  });
} else {
  runAllTests();
}