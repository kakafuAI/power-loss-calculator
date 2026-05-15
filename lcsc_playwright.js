const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    executablePath: '/snap/bin/chromium',
  });
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  });
  
  console.log('Navigating to LCSC...');
  await page.goto('https://www.szlcsc.com/', { timeout: 30000, waitUntil: 'networkidle' });
  console.log('Homepage loaded:', await page.title());
  await page.screenshot({ path: '/tmp/lcsc_pp_home.png', fullPage: false });
  
  // Navigate to snap-in capacitor catalog page
  console.log('Navigating to catalog page...');
  await page.goto('https://www.szlcsc.com/catalog.html?catalog=11182', { 
    timeout: 30000, 
    waitUntil: 'networkidle' 
  });
  console.log('Catalog page loaded:', await page.title());
  
  // Wait for content to render
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/lcsc_pp_catalog.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Try to find product elements
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text (first 2000 chars):', bodyText.substring(0, 2000));
  
  // Check for filter options
  const filterElements = await page.evaluate(() => {
    const filters = [];
    document.querySelectorAll('[class*="filter"], [class*="param"], [class*="筛"]').forEach(el => {
      filters.push(el.textContent.trim().substring(0, 100));
    });
    return filters;
  });
  console.log('Filter elements:', filterElements);
  
  // Try to find products
  const products = await page.evaluate(() => {
    const items = [];
    // Try various selectors for product items
    const selectors = [
      '[class*="product"]',
      '[class*="goods"]', 
      '[class*="item"]',
      'tr',
      'li',
      '[class*="card"]',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 20 && text.length < 500) {
          items.push(text);
        }
      });
    }
    return items.slice(0, 50);
  });
  console.log('\n=== Found content items ===');
  products.forEach((p, i) => console.log(`${i+1}. ${p.substring(0, 300)}`));
  
  await browser.close();
  console.log('\nDone!');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
