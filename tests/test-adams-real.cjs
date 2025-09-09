const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function searchADAMS(query, maxResults = 10) {
  console.log('='.repeat(50));
  console.log('Testing Real ADAMS Search');
  console.log('='.repeat(50));
  console.log(`Query: "${query}"`);
  
  // ADAMS 검색을 위한 세션 생성
  const axiosInstance = axios.create({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 30000
  });
  
  try {
    // 1. ADAMS 검색 페이지 직접 접근
    console.log('\n1. Accessing ADAMS search page...');
    const searchPageUrl = `https://adams.nrc.gov/wba/`;
    const mainPage = await axiosInstance.get(searchPageUrl);
    console.log(`   Status: ${mainPage.status}`);
    
    // 쿠키 저장
    const cookies = mainPage.headers['set-cookie'] || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
    
    // 2. 검색 실행
    console.log('\n2. Performing search...');
    
    // URL 인코딩된 검색
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://adams.nrc.gov/wba/services/search/advanced/nrc?q=${encodedQuery}`;
    
    try {
      const searchResponse = await axiosInstance.get(searchUrl, {
        headers: {
          'Cookie': cookieString,
          'Referer': searchPageUrl
        }
      });
      
      // HTML 응답 파싱
      const $ = cheerio.load(searchResponse.data);
      const results = [];
      
      // 여러 가능한 셀렉터 시도
      const selectors = [
        'tr[data-accession]',
        '.search-result',
        'table.results tr',
        'div.document-item'
      ];
      
      for (const selector of selectors) {
        $(selector).each((i, elem) => {
          if (i >= maxResults) return false;
          
          const $elem = $(elem);
          const text = $elem.text();
          
          // ML 번호 찾기
          const mlMatch = text.match(/ML\d{8,}/);
          if (mlMatch) {
            results.push({
              documentNumber: mlMatch[0],
              title: text.substring(0, 200).trim(),
              found: true
            });
          }
        });
        
        if (results.length > 0) break;
      }
      
      console.log(`   Found ${results.length} results`);
      return results;
      
    } catch (searchError) {
      console.log(`   Search error: ${searchError.message}`);
    }
    
    // 3. 대체 방법: 직접 URL 구성
    console.log('\n3. Trying alternative search method...');
    const directSearchUrl = `https://adamswebsearch2.nrc.gov/webSearch2/main.jsp?SearchMode=1&searchText=${encodedQuery}`;
    
    try {
      const directResponse = await axiosInstance.get(directSearchUrl);
      console.log(`   Status: ${directResponse.status}`);
      
      // 응답에서 ML 번호 찾기
      const mlNumbers = directResponse.data.match(/ML\d{8,}/g) || [];
      const uniqueMLs = [...new Set(mlNumbers)].slice(0, maxResults);
      
      console.log(`   Found ${uniqueMLs.length} ML numbers`);
      
      return uniqueMLs.map(ml => ({
        documentNumber: ml,
        title: `Document ${ml}`,
        found: true
      }));
      
    } catch (altError) {
      console.log(`   Alternative search error: ${altError.message}`);
    }
    
  } catch (error) {
    console.error('Search failed:', error.message);
    return [];
  }
}

async function downloadPDF(docNumber) {
  console.log(`\nDownloading ${docNumber}...`);
  
  const urls = [
    `https://adams.nrc.gov/wba/services/document/${docNumber}/content/downloadContent`,
    `https://adamswebsearch2.nrc.gov/IDMWS/ViewDocByAccession.asp?AccessionNumber=${docNumber}`,
    `https://adams.nrc.gov/wba/services/document/${docNumber}/pdf`,
    `https://www.nrc.gov/docs/${docNumber.substring(0, 4)}/${docNumber}.pdf`
  ];
  
  for (const url of urls) {
    console.log(`  Trying: ${url}`);
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/pdf'
        },
        timeout: 30000,
        maxRedirects: 5
      });
      
      if (response.status === 200 && response.data.length > 1000) {
        // PDF 시그니처 확인
        const buffer = Buffer.from(response.data);
        if (buffer.toString('utf8', 0, 4) === '%PDF') {
          console.log(`  ✓ Success! Downloaded ${buffer.length} bytes`);
          return buffer;
        } else {
          console.log(`  Not a PDF (first bytes: ${buffer.toString('utf8', 0, 20)})`);
        }
      }
    } catch (error) {
      console.log(`  Failed: ${error.message}`);
    }
  }
  
  return null;
}

// 메인 실행
async function main() {
  const results = await searchADAMS('emergency plan', 5);
  
  if (results.length > 0) {
    console.log('\nSearch Results:');
    results.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.documentNumber} - ${doc.title.substring(0, 80)}`);
    });
    
    // 첫 번째 문서 다운로드 시도
    const firstDoc = results[0];
    if (firstDoc.documentNumber) {
      const pdfBuffer = await downloadPDF(firstDoc.documentNumber);
      
      if (pdfBuffer) {
        const filename = `${firstDoc.documentNumber}.pdf`;
        fs.writeFileSync(filename, pdfBuffer);
        console.log(`\n✓ Saved to ${filename}`);
      } else {
        console.log('\n✗ Download failed');
      }
    }
  } else {
    console.log('\nNo results found');
  }
}

main().catch(console.error);