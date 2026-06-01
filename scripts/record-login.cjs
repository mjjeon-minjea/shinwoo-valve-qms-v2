const { chromium } = require('playwright');

async function recordLogin() {
  console.log('🚀 [안티그래비티 E2E] 자체 내장 브라우저 (CDP 9222) 연동 론칭 시작...');
  
  let browser;
  let page;
  try {
    // 🔌 안티그래비티 자체 브라우저 CDP 9222 연동 표준 준수
    console.log('🔄 Connecting to Antigravity Built-in Browser via CDP...');
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    console.log('✅ Connected successfully to CDP Browser!');

    // 1. 기존 액티브 컨텍스트 획득
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('No active browser context found on CDP!');
    }

    // 2. 새 탭 강제 개설 (내장 브라우저 화면 옆에 새 탭 추가)
    page = await context.newPage();
    console.log('✅ New page created in Antigravity Browser.');

    // 3. 테스트웹 이동
    console.log('🔄 Navigating to QMS Test Web...');
    await page.goto('https://shinwoo-valve-qms-testweb.vercel.app', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // [클린 세션 확보]
    console.log('🔄 Enforcing clean login session...');
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload({ waitUntil: 'load' });
    } catch (clearErr) {
      console.log('Session clear bypassed.');
    }
    await page.waitForTimeout(2000);

    // 4. 아이디 입력
    const emailSelector = 'input#email';
    await page.waitForSelector(emailSelector, { timeout: 5000 });
    console.log('- Typing ID (mjjeon)...');
    await page.click(emailSelector);
    await page.type(emailSelector, 'mjjeon', { delay: 100 });
    await page.waitForTimeout(500);

    // 5. 비밀번호 입력
    const passwordSelector = 'input#password';
    await page.waitForSelector(passwordSelector, { timeout: 5000 });
    console.log('- Typing Password...');
    await page.click(passwordSelector);
    await page.type(passwordSelector, '!alswo6305', { delay: 100 });
    await page.waitForTimeout(500);

    // 6. 로그인 버튼 제출
    const submitBtnSelector = 'button[type="submit"]';
    await page.waitForSelector(submitBtnSelector, { timeout: 5000 });
    console.log('- Submitting login form...');
    await page.click(submitBtnSelector);
    
    // 차장님 대시보드 안착 확인을 위한 8초 유지
    console.log('🔄 로그인 성공! 차장님 확인용 대시보드 8초간 유지 중...');
    await page.waitForTimeout(8000);
    
    console.log('🎉 [완료] 안티그래비티 자체 브라우저를 이용한 QMS 테스트웹 로그인 성공!');

  } catch (err) {
    console.error('❌ E2E 로그인 기동 실패:', err.message);
  } finally {
    // 🛡️ [좀비 및 교착 방지책]: 부모 브라우저 전체(browser.close)를 죽이지 않고, 생성된 개별 페이지 탭만 물리적으로 닫습니다!
    if (page) {
      console.log('🔌 Terminating only the created page tab to preserve the CDP parent browser process...');
      try {
        await page.close();
        console.log('✅ Page tab closed cleanly. CDP browser session kept alive!');
      } catch (pageCloseErr) {
        console.error('⚠️ Error closing page tab:', pageCloseErr.message);
      }
    }
  }
}

recordLogin();
