#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🧪 EVE MCP 캐시 관리 테스트');
console.log('========================\n');

async function sendRequest(request) {
  return new Promise((resolve) => {
    const server = spawn('node', ['build/index.js']);
    let output = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.on('close', () => {
      try {
        const lines = output.trim().split('\n');
        const response = JSON.parse(lines[0]);
        resolve(response);
      } catch (e) {
        resolve({ error: e.message });
      }
    });

    server.stdin.write(JSON.stringify(request) + '\n');
    server.stdin.end();
  });
}

async function testCacheManagement() {
  console.log('1. PDF 다운로드 시뮬레이션...');
  
  // PDF 다운로드 (실제로는 안 함, URL 검증만)
  const downloadTest = await sendRequest({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'download_pdf',
      arguments: { url: 'https://example.com/test.pdf' }
    },
    id: 1
  });
  
  console.log('   다운로드 시도:', downloadTest.error ? '❌ 실패 (예상됨)' : '✅');

  // PDF 목록 확인
  console.log('\n2. 캐시 상태 확인...');
  const listResult = await sendRequest({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'list_downloaded_pdfs',
      arguments: {}
    },
    id: 2
  });

  if (listResult.result) {
    const text = listResult.result.content[0].text;
    console.log('   ' + text.split('\n')[0]); // 첫 줄만 출력 (캐시 상태)
    
    // 캐시 사용률 확인
    if (text.includes('Cache Usage:')) {
      console.log('   ✅ 캐시 사용률 표시 확인');
    } else {
      console.log('   ❌ 캐시 사용률 표시 없음');
    }
  }

  // 검색 결과 캐싱 테스트
  console.log('\n3. 검색 결과 캐싱 테스트...');
  const searchResult = await sendRequest({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'search_papers',
      arguments: { query: 'test', max_results: 2 }
    },
    id: 3
  });

  if (searchResult.result) {
    const hasNumberInstruction = searchResult.result.content[0].text.includes('number (1-');
    console.log('   번호로 다운로드 안내:', hasNumberInstruction ? '✅ 있음' : '❌ 없음');
  }

  // 번호로 다운로드 테스트
  console.log('\n4. 번호로 다운로드 기능...');
  const numberDownload = await sendRequest({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'download_pdf',
      arguments: { url: '1' }
    },
    id: 4
  });

  const isHandled = !numberDownload.error || 
                    numberDownload.error.message.includes('Found');
  console.log('   번호 인식:', isHandled ? '✅ 지원' : '❌ 미지원');

  console.log('\n========================');
  console.log('✅ 캐시 관리 기능 테스트 완료');
}

// 실행
testCacheManagement().catch(console.error);