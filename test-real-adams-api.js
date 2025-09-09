import 'dotenv/config';
import puppeteer from 'puppeteer';
import axios from 'axios';
import * as fs from 'fs';

async function testRealADAMS() {
  console.log('='.repeat(50));
  console.log('Testing REAL ADAMS - No Mock Data');
  console.log('='.repeat(50));
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 네트워크 요청 감시
    const apiCalls = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('api') || url.includes('search') || url.includes('wba')) {
        console.log(`REQUEST: ${request.method()} ${url.substring(0, 100)}`);
        apiCalls.push({
          method: request.method(),
          url: url,
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('api') || url.includes('search') || url.includes('wba')) {
        console.log(`RESPONSE: ${response.status()} ${url.substring(0, 100)}`);
      }
    });
    
    // 1. ADAMS 검색 페이지 접속
    console.log('\n1. Going to ADAMS search page...');
    await page.goto('https://adams-search.nrc.gov/home', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 2. 검색창 찾기
    console.log('\n2. Looking for search input...');
    
    // 페이지의 모든 input 요소 확인
    const inputs = await page.evaluate(() => {
      const allInputs = document.querySelectorAll('input');
      return Array.from(allInputs).map(input => ({
        type: input.type,
        name: input.name,
        placeholder: input.placeholder,
        id: input.id,
        className: input.className
      }));
    });
    
    console.log('Found inputs:');
    inputs.forEach(input => {
      console.log(`  - ${input.type} | ${input.name} | ${input.placeholder} | ${input.id}`);
    });
    
    // 3. 검색 수행
    console.log('\n3. Trying to search for "safety analysis 2024"...');
    
    // 여러 방법 시도
    const searchText = 'safety analysis 2024';
    
    // 방법 1: 직접 URL로 이동
    const searchParams = {
      keywords: searchText,
      legacyLibFilter: true,
      mainLibFilter: true
    };
    
    const encodedParams = encodeURIComponent(JSON.stringify(searchParams));
    const searchUrl = `https://adams-search.nrc.gov/results/${encodedParams}`;
    
    console.log(`\nDirect URL: ${searchUrl.substring(0, 100)}...`);
    
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. 검색 결과 파싱
    console.log('\n4. Parsing search results...');
    
    const results = await page.evaluate(() => {
      const docs = [];
      
      // 테이블 행 찾기
      const rows = document.querySelectorAll('tr');
      
      rows.forEach(row => {
        const text = row.innerText || '';
        
        // ML 번호 찾기
        const mlMatch = text.match(/ML\d{8,}/);
        if (mlMatch) {
          // 각 열 데이터 추출
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            docs.push({
              accessionNumber: mlMatch[0],
              title: cells[2]?.innerText || '',
              date: cells[3]?.innerText || '',
              docDate: cells[4]?.innerText || '',
              fullText: text
            });
          }
        }
      });
      
      return docs;
    });
    
    console.log(`\nFound ${results.length} documents:`);
    results.slice(0, 5).forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.accessionNumber} - ${doc.title || 'No title'}`);
      console.log(`   Date: ${doc.date} | Doc Date: ${doc.docDate}`);
    });
    
    // 5. API 호출 분석
    console.log('\n5. API calls captured:');
    apiCalls.filter(call => call.postData).forEach(call => {
      console.log(`\n${call.method} ${call.url.substring(0, 100)}`);
      console.log(`POST Data: ${call.postData?.substring(0, 200)}`);
    });
    
    // 6. 첫 번째 문서 다운로드 테스트
    if (results.length > 0) {
      const firstDoc = results[0];
      console.log(`\n6. Testing download for ${firstDoc.accessionNumber}...`);
      
      // PDF URL 생성
      const folder = firstDoc.accessionNumber.substring(0, 6);
      const pdfUrl = `https://www.nrc.gov/docs/${folder}/${firstDoc.accessionNumber}.pdf`;
      
      console.log(`PDF URL: ${pdfUrl}`);
      
      // 브라우저에서 직접 다운로드
      const downloadPage = await browser.newPage();
      const response = await downloadPage.goto(pdfUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      console.log(`Response status: ${response?.status()}`);
      
      if (response && response.status() === 200) {
        const buffer = await response.buffer();
        console.log(`Downloaded ${buffer.length} bytes`);
        
        // PDF 확인
        if (buffer.toString('utf8', 0, 4) === '%PDF') {
          console.log('✓ Valid PDF!');
          fs.writeFileSync(`test_${firstDoc.accessionNumber}.pdf`, buffer);
          console.log(`Saved to test_${firstDoc.accessionNumber}.pdf`);
        } else {
          console.log('✗ Not a PDF');
          console.log(`First bytes: ${buffer.toString('utf8', 0, 100)}`);
        }
      }
      
      await downloadPage.close();
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testRealADAMS().catch(console.error);