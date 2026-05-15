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
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  
  // Navigate to the snap-in capacitor category page directly
  // LCSC uses routing like /catalog/[id] for category product listing
  console.log('1. Navigating to catalog category page...');
  await page.goto('https://www.szlcsc.com/catalog/11182', { 
    timeout: 30000, 
    waitUntil: 'networkidle' 
  });
  console.log('Title:', await page.title());
  console.log('URL:', page.url());
  
  // Wait a bit
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/lcsc_cat_11182_products.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Get page content
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== Page content (first 3000 chars) ===');
  console.log(bodyText.substring(0, 3000));
  
  // Check if there are any API calls that return product data
  console.log('\n=== Checking for product-related elements ===');
  const productInfo = await page.evaluate(() => {
    // Look for any element containing product data
    const results = [];
    
    // Check for common product list containers
    const selectors = [
      '[class*="product-list"]',
      '[class*="productList"]',
      '[class*="goods-list"]',
      '[class*="search-result"]',
      '[class*="searchResult"]',
      '[class*="catalog-product"]',
      'main',
      '[class*="container"]',
      '[class*="content"]',
      '[class*="list"]',
    ];
    
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results.push(`Selector "${sel}": ${els.length} elements`);
        els.forEach((el, i) => {
          const text = el.textContent.trim().substring(0, 200);
          if (text) results.push(`  [${i}] ${text}`);
        });
      }
    }
    return results;
  });
  
  productInfo.forEach(line => console.log(line));
  
  // Check network requests
  console.log('\n=== Checking for data on page ===');
  const htmlSnippets = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const snippets = [];
    // Search for product-related patterns
    const patterns = ['productId', 'productCode', 'productName', '"price"', 'totalCount', 'productRecord'];
    for (const p of patterns) {
      const idx = html.indexOf(p);
      if (idx >= 0) {
        snippets.push(`Found "${p}" at position ${idx}, context: ${html.substring(Math.max(0,idx-50), idx+100)}`);
      }
    }
    return snippets;
  });
  htmlSnippets.forEach(s => console.log(s));
  
  await browser.close();
  console.log('\nDone!');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
