import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function testADAMSSearch() {
  console.log('Testing ADAMS Search at adams-search.nrc.gov');
  console.log('='.repeat(50));
  
  try {
    // 1. 홈페이지 접속
    console.log('\n1. Accessing homepage...');
    const homeResponse = await axios.get('https://adams-search.nrc.gov/home');
    console.log(`   Status: ${homeResponse.status}`);
    
    // 2. 검색 수행 - GET 방식
    console.log('\n2. Performing search for "emergency plan"...');
    const searchUrl = 'https://adams-search.nrc.gov/home#!/search/';
    const searchParams = new URLSearchParams({
      'q': 'emergency plan',
      'qn': 'true',
      'tab': 'content-search-pars'
    });
    
    const fullSearchUrl = `${searchUrl}?${searchParams}`;
    console.log(`   URL: ${fullSearchUrl}`);
    
    // 3. WBA API 직접 호출 시도
    console.log('\n3. Trying WBA API directly...');
    const wbaSearchUrl = 'https://adams.nrc.gov/wba/services/search/advanced/nrc';
    
    const searchPayload = {
      mode: 'sections',
      sections: {
        single_content_search: 'emergency plan',
        filters: {
          'public-submission': false
        }
      }
    };
    
    try {
      const wbaResponse = await axios.post(wbaSearchUrl, searchPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
      });
      
      console.log(`   WBA Response status: ${wbaResponse.status}`);
      if (wbaResponse.data) {
        console.log(`   Response type: ${typeof wbaResponse.data}`);
        if (typeof wbaResponse.data === 'object') {
          console.log(`   Keys: ${Object.keys(wbaResponse.data).join(', ')}`);
        }
      }
    } catch (wbaError) {
      console.log(`   WBA API error: ${wbaError.message}`);
    }
    
    // 4. 직접 문서 접근 테스트
    console.log('\n4. Testing direct document access...');
    const testDocNumbers = ['ML24001A001', 'ML24343A074'];
    
    for (const docNum of testDocNumbers) {
      console.log(`\n   Testing ${docNum}:`);
      
      // 여러 URL 패턴 시도
      const urls = [
        `https://adams.nrc.gov/wba/services/document/${docNum}/content/downloadContent`,
        `https://www.nrc.gov/docs/${docNum.substring(0, 6)}/${docNum}.pdf`,
        `https://adamswebsearch2.nrc.gov/webSearch2/view?AccessionNumber=${docNum}`
      ];
      
      for (const url of urls) {
        try {
          const response = await axios.head(url, {
            timeout: 5000,
            maxRedirects: 5
          });
          console.log(`     ${url}: ${response.status}`);
          if (response.headers['content-type']) {
            console.log(`       Content-Type: ${response.headers['content-type']}`);
          }
        } catch (error) {
          console.log(`     ${url}: ${error.response?.status || 'Failed'}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testADAMSSearch();