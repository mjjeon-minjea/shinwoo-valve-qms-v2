
const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    console.log('Navigating to Vercel...');
    await page.goto('https://shinwoo-valve-qms.vercel.app/');
    await page.waitForTimeout(5000);
    console.log('Done.');
    await browser.close();
  } catch(e) {
    console.error(e);
  }
})();

