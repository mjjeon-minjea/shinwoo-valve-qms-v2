const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
      await page.goto('https://shinwoo-valve-qms.vercel.app/');
      console.log('Navigated to Vercel.');
      
      await page.waitForTimeout(2000);
      await page.fill('input[name="email"]', 'mjjeon');
      await page.fill('input[name="password"]', '1');
      await page.click('button:has-text("로그인")');
      console.log('Clicked login.');
      
      await page.waitForTimeout(3000);
      const modalText = await page.content();
      if (modalText.includes('개인정보 보안 강화')) {
          console.log('Password modal appeared.');
          
          await page.fill('input[placeholder="현재 비밀번호"]', '1');
          await page.fill('input[placeholder="신규 비밀번호 6~16자"]', 'mjjeon1234');
          await page.fill('input[placeholder="신규 비밀번호 확인"]', 'mjjeon1234');
          
          const buttons = await page.$$('button');
          for (let btn of buttons) {
              const text = await btn.textContent();
              if (text && text.includes('변경하기')) {
                  await btn.click();
                  break;
              }
          }
          console.log('Clicked 변경하기. Waiting 5s...');
          await page.waitForTimeout(5000);
          
          const contentAfter = await page.content();
          if (contentAfter.includes('주간 업무 보고')) {
              console.log('SUCCESS: Reached Dashboard!');
          } else {
              if (contentAfter.includes('개인정보 보안 강화')) {
                  console.log('FAILED: Modal is still open. Checking for error messages...');
                  const errMatch = contentAfter.match(/<div class="[^"]*text-red-600[^"]*">([^<]+)<\/div>/);
                  if (errMatch) {
                      console.log('ERROR MESSAGE IN MODAL:', errMatch[1]);
                  } else {
                      console.log('NO ERROR MESSAGE FOUND IN MODAL HTML.');
                  }
                  await page.screenshot({ path: 'vercel_modal_error.png' });
              } else {
                  console.log('FAILED: Did not reach Dashboard, but modal disappeared?');
              }
          }
      } else if (modalText.includes('주간 업무 보고')) {
          console.log('SUCCESS: Reached Dashboard immediately!');
      } else {
          console.log('Unknown state. Could not find Modal or Dashboard.');
      }
  } catch(err) {
      console.error(err);
  } finally {
      await browser.close();
  }
})();
