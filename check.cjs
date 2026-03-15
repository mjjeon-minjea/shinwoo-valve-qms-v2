const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }});
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });
  page.on('pageerror', error => console.log('PAGE UNCAUGHT EXCEPTION:', error.message));

  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/');
  
  console.log('Logging in...');
  // QMS uses email input for user login. 
  // Let's type 'mjjeon@shinwoovalve.com' and '1'
  const emailInput = await page.locator('input[type="email"]');
  const pwdInput = await page.locator('input[type="password"]');
  
  if (await emailInput.count() > 0) {
      await emailInput.fill('mjjeon@shinwoovalve.com');
      await pwdInput.fill('1');
      await page.click('button:has-text("로그인")');
  } else {
      // If it's a text input
      await page.locator('input[placeholder*="아이디"], input[placeholder*="이메일"]').first().fill('mjjeon@shinwoovalve.com');
      await page.locator('input[type="password"]').fill('1');
      await page.click('button:has-text("로그인")');
  }
  
  await page.waitForTimeout(2000);
  
  console.log('Clicking on analysis menu...');
  // Click the sidebar menu for "작업장별 분석현황"
  await page.click('button:has-text("작업장별 분석현황")');
  
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'check_screenshot.png' });
  console.log('Screenshot saved to check_screenshot.png');
  
  await browser.close();
})();
