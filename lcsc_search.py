#!/usr/bin/env python3
"""
立创商城 - 牛角型电解电容查询
Snap-in (牛角型) Aluminum Electrolytic Capacitors
"""
import json, os, time, sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

ScreenshotPath = "/tmp/lcsc_capacitor_result.png"
ResultsPath = "/tmp/lcsc_capacitor_results.json"

def setup_driver():
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--lang=zh-CN")
    opts.binary_location = "/snap/bin/chromium"
    svc = webdriver.chrome.service.Service("/snap/bin/chromium.chromedriver")
    driver = webdriver.Chrome(service=svc, options=opts)
    driver.set_page_load_timeout(30)
    return driver

def wait_and_click(driver, selector, timeout=10):
    """Wait for element to be clickable and click it."""
    el = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
    )
    driver.execute_script("arguments[0].scrollIntoView(true);", el)
    time.sleep(0.5)
    el.click()
    return el

def wait_for_element(driver, selector, timeout=10):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
    )

def main():
    driver = setup_driver()
    all_results = []

    try:
        # Step 1: Navigate to LCSC snap-in capacitor category
        # The catalog URL for 牛角型电解电容
        # Let's first go to the main site
        print("Navigating to LCSC...")
        driver.get("https://www.szlcsc.com/")
        time.sleep(3)

        # Take screenshot of initial page
        driver.save_screenshot("/tmp/lcsc_step0_home.png")
        print("Homepage loaded.")

        # Try to navigate to the catalog for snap-in electrolytic capacitors
        # The category URL structure: https://www.szlcsc.com/catalog.html
        print("Navigating to catalog...")
        driver.get("https://www.szlcsc.com/catalog.html")
        time.sleep(3)
        driver.save_screenshot("/tmp/lcsc_step1_catalog.png")
        print("Catalog page loaded.")

        # Search for 牛角型电解电容 to find the right category
        print("Searching for 牛角型电解电容...")
        search_box = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='搜索'], input.search-input, input#search-input, input[type='text']")
        if search_box:
            search_box.clear()
            search_box.send_keys("牛角型电解电容")
            search_box.submit()
            time.sleep(3)
            driver.save_screenshot("/tmp/lcsc_step2_search.png")
            print("Search submitted.")

        # Try the direct catalog URL for snap-in capacitors
        # LCSC category IDs: 牛角型电解电容 is usually under 电容器 -> 铝电解电容 -> 牛角型电解电容
        # Common URL patterns: https://www.szlcsc.com/catalog_cat_xxx.html or similar
        
        # Let me try a few known patterns
        current_url = driver.current_url
        print(f"Current URL: {current_url}")
        
        # If we're on search results, try to find the category
        # Try common category IDs for 牛角型电解电容
        cat_urls = [
            "https://www.szlcsc.com/catalog_cat_10196.html",  # 牛角型电解电容 common ID
            "https://www.szlcsc.com/catalog.html?catalog=10196",
            "https://www.szlcsc.com/catalog_cat_2461.html",   # 铝电解电容
        ]
        
        for url in cat_urls:
            print(f"Trying URL: {url}")
            driver.get(url)
            time.sleep(3)
            driver.save_screenshot(f"/tmp/lcsc_step_cat_try.png")
            # Check page content
            page_text = driver.find_element(By.TAG_NAME, "body").text[:500]
            if "牛角" in page_text or "snap" in page_text.lower() or "电解" in page_text:
                print(f"Found snap-in capacitor page!")
                # Check for product listing
                if "共 " in page_text or "商品" in page_text or "产品" in page_text:
                    print("Product listing detected!")
                    break

        # Let me take a comprehensive screenshot of the current state
        driver.save_screenshot("/tmp/lcsc_step3_current.png")
        print(f"Final URL: {driver.current_url}")
        page_source = driver.page_source

        # Save page source for analysis
        with open("/tmp/lcsc_page.html", "w", encoding="utf-8") as f:
            f.write(page_source)

        # Now let's look for filter panel and products
        # Get all text on page for analysis
        body_text = driver.find_element(By.TAG_NAME, "body").text
        print(f"\n--- Page text excerpt (first 2000 chars) ---")
        print(body_text[:2000])

        # Look for product elements
        products = driver.find_elements(By.CSS_SELECTOR, 
            ".product-item, .product-card, .goods-item, [class*='product'], [class*='goods'], tr.product, .item-row")
        print(f"\nFound {len(products)} product elements by generic selectors")

        # Extract product info
        for i, prod in enumerate(products[:20]):
            try:
                text = prod.text.strip()
                if text:
                    print(f"\nProduct {i+1}: {text[:300]}")
            except:
                pass

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        try:
            driver.save_screenshot("/tmp/lcsc_error.png")
        except:
            pass
    finally:
        try:
            driver.save_screenshot(ScreenshotPath)
            print(f"\nFinal screenshot saved to {ScreenshotPath}")
        except:
            pass
        driver.quit()

    # Save results
    with open(ResultsPath, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print("\nDone.")

if __name__ == "__main__":
    main()
