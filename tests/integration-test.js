#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

console.log('🧪 EVE MCP 통합 테스트');
console.log('===================\n');

const tests = [
  {
    name: '1. 도구 목록 확인',
    request: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
    validate: (res) => {
      const tools = res.result.tools.map(t => t.name);
      return tools.includes('search_papers') && 
             tools.includes('download_pdf') && 
             tools.includes('ask_about_pdf');
    }
  },
  {
    name: '2. arXiv 검색 (machine learning)',
    request: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_papers',
        arguments: { query: 'transformer', max_results: 3 }
      },
      id: 2
    },
    validate: (res) => {
      return res.result && 
             res.result.content[0].text.includes('Found') &&
             res.result.content[0].text.includes('papers');
    }
  },
  {
    name: '3. PubMed 검색 (COVID-19)',
    request: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_papers',
        arguments: { query: 'COVID-19', site: 'pubmed', max_results: 2 }
      },
      id: 3
    },
    validate: (res) => {
      return res.result && 
             res.result.content[0].text.includes('pubmed');
    }
  },
  {
    name: '4. 잘못된 사이트 오류 처리',
    request: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_papers',
        arguments: { query: 'test', site: 'invalid' }
      },
      id: 4
    },
    validate: (res) => {
      return res.error && res.error.message.includes('Unsupported site');
    }
  },
  {
    name: '5. PDF 목록 (빈 상태)',
    request: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'list_downloaded_pdfs',
        arguments: {}
      },
      id: 5
    },
    validate: (res) => {
      return res.result && 
             res.result.content[0].text.includes('No PDFs');
    }
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    const server = spawn('node', ['build/index.js']);
    let output = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      // 무시 (서버 시작 메시지)
    });

    server.on('close', () => {
      try {
        const lines = output.trim().split('\n');
        const response = JSON.parse(lines[0]);
        
        if (test.validate(response)) {
          console.log(`✅ ${test.name}`);
          resolve(true);
        } else {
          console.log(`❌ ${test.name}`);
          console.log(`   응답: ${JSON.stringify(response, null, 2).substring(0, 100)}...`);
          resolve(false);
        }
      } catch (e) {
        console.log(`❌ ${test.name} - 파싱 오류`);
        console.log(`   출력: ${output.substring(0, 100)}...`);
        resolve(false);
      }
    });

    // 요청 전송
    server.stdin.write(JSON.stringify(test.request) + '\n');
    server.stdin.end();
  });
}

async function runAllTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await runTest(test);
    if (result) passed++;
    else failed++;
  }

  console.log('\n===================');
  console.log(`결과: ${passed}/${tests.length} 성공`);
  
  if (failed === 0) {
    console.log('🎉 모든 테스트 통과!');
    process.exit(0);
  } else {
    console.log(`⚠️  ${failed}개 테스트 실패`);
    process.exit(1);
  }
}

// 실행
runAllTests().catch(console.error);