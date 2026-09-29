const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/login', { waitUntil: 'load' });
  await page.fill('input[autocomplete="username"]', 'titanuser');
  await page.fill('input[type="password"]', 'TestPass123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('URL:', page.url());
  await page.screenshot({ path: 'emp-dashboard.png', fullPage: true });
  await browser.close();
})();
