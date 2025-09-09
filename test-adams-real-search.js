import 'dotenv/config';
import puppeteer from 'puppeteer';
import axios from 'axios';

async function searchADAMSReal() {
  console.log('Testing Real ADAMS Search');
  console.log('='.repeat(50));
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 1. 검색 결과 페이지로 직접 이동
    const searchUrl = 'https://adams-search.nrc.gov/results/%257B%2522keywords%2522%253A%2522safety%2522%252C%2522legacyLibFilter%2522%253Atrue%252C%2522mainLibFilter%2522%253Atrue%252C%2522any%2522%253A%255B%255D%252C%2522all%2522%253A%255B%255D%257D';
    
    console.log('1. Navigating to search results page...');
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 페이지 로드 대기
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2. ML 번호 추출
    console.log('\n2. Extracting ML numbers from results...');
    
    const mlNumbers = await page.evaluate(() => {
      const numbers = [];
      
      // 모든 텍스트에서 ML 번호 찾기
      const allText = document.body.innerText || '';
      const matches = allText.match(/ML\d{8,11}/g) || [];
      
      // 중복 제거
      const unique = [...new Set(matches)];
      return unique.slice(0, 10); // 상위 10개만
    });
    
    console.log(`Found ${mlNumbers.length} ML numbers:`);
    mlNumbers.forEach((ml, i) => {
      console.log(`  ${i + 1}. ${ml}`);
    });
    
    // 3. 첫 번째 문서 다운로드 테스트
    if (mlNumbers.length > 0) {
      const testML = mlNumbers[0];
      console.log(`\n3. Testing download for ${testML}...`);
      
      // URL 생성
      const folder = testML.substring(0, 6); // ML2412
      const pdfUrl = `https://www.nrc.gov/docs/${folder}/${testML}.pdf`;
      
      console.log(`   URL: ${pdfUrl}`);
      
      // HEAD 요청으로 확인
      try {
        const response = await axios.head(pdfUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        console.log(`   Status: ${response.status}`);
        if (response.headers['content-type']) {
          console.log(`   Content-Type: ${response.headers['content-type']}`);
        }
        if (response.headers['content-length']) {
          const size = parseInt(response.headers['content-length']);
          console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
        }
        
        if (response.status === 200) {
          console.log('   ✓ Document is accessible!');
        }
      } catch (error) {
        console.log(`   ✗ Error: ${error.response?.status || error.message}`);
      }
    }
    
    // 4. 실제 검색 API 엔드포인트 찾기
    console.log('\n4. Looking for API endpoints...');
    
    // 네트워크 요청 감시
    const apiCalls = [];
    page.on('response', response => {
      const url = response.url();
      if (url.includes('api') || url.includes('search') || url.includes('results')) {
        apiCalls.push({
          url: url,
          status: response.status(),
          method: response.request().method()
        });
      }
    });
    
    // 페이지 새로고침하여 API 호출 캡처
    await page.reload({ waitUntil: 'networkidle2' });
    
    if (apiCalls.length > 0) {
      console.log('Found API calls:');
      apiCalls.forEach(call => {
        console.log(`  ${call.method} ${call.status} ${call.url.substring(0, 100)}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

searchADAMSReal().catch(console.error);