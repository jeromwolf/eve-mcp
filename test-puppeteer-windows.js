// Windows Puppeteer 직접 테스트
import puppeteer from 'puppeteer';

async function testPuppeteer() {
  console.log('🔧 Starting Puppeteer test...');
  console.log('Platform:', process.platform);
  console.log('Chrome path:', process.env.PUPPETEER_EXECUTABLE_PATH);

  let browser = null;
  let page = null;

  try {
    // 브라우저 시작
    console.log('\n1️⃣ Launching browser...');
    browser = await puppeteer.launch({
      headless: true,  // headless: true로 테스트
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      timeout: 60000
    });
    console.log('✅ Browser launched successfully');

    // 페이지 생성
    console.log('\n2️⃣ Creating new page...');
    page = await browser.newPage();
    console.log('✅ Page created successfully');

    // ADAMS 사이트로 이동
    console.log('\n3️⃣ Navigating to ADAMS...');
    const searchUrl = 'https://adams-search.nrc.gov/results/%7B%22keywords%22%3A%22reactor%22%2C%22legacyLibFilter%22%3Atrue%2C%22mainLibFilter%22%3Atrue%2C%22any%22%3A%5B%5D%2C%22all%22%3A%5B%5D%7D';

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log('✅ Navigation successful');

    // 결과 대기
    console.log('\n4️⃣ Waiting for results...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    console.log('✅ Wait completed');

    // HTML 확인
    console.log('\n5️⃣ Checking page content...');
    const html = await page.content();
    console.log('Page HTML length:', html.length);
    console.log('Contains "Accession":', html.includes('Accession'));

    // 테이블 파싱 시도
    console.log('\n6️⃣ Trying to parse results...');
    const results = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      return rows.length;
    });
    console.log('Found table rows:', results);

    console.log('\n✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅');
    console.log('Puppeteer is working on Windows!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

  } finally {
    if (page) {
      await page.close().catch(err => console.error('Failed to close page:', err.message));
    }
    if (browser) {
      await browser.close().catch(err => console.error('Failed to close browser:', err.message));
    }
  }
}

testPuppeteer();
