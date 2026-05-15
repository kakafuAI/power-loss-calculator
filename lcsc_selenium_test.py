#!/usr/bin/env python3
"""
Try to run Selenium with snap chromium
"""
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--disable-gpu")
opts.add_argument("--window-size=1920,1080")
opts.add_argument("--disable-software-rasterizer")
opts.add_argument("--remote-debugging-port=0")
opts.add_argument("--lang=zh-CN")
opts.binary_location = "/snap/bin/chromium"

# Try without the "new" headless
svc = Service("/snap/bin/chromium.chromedriver")

try:
    print("Starting Chrome...")
    driver = webdriver.Chrome(service=svc, options=opts)
    print("Chrome started!")
    
    driver.get("https://www.szlcsc.com/")
    time.sleep(3)
    print(f"Title: {driver.title}")
    driver.save_screenshot("/tmp/lcsc_selenium_test.png")
    
    driver.quit()
    print("Done!")
except Exception as e:
    print(f"Error: {e}")
    
    # Try without headless
    print("\nTrying without headless...")
    opts2 = Options()
    opts2.add_argument("--no-sandbox")
    opts2.add_argument("--disable-dev-shm-usage")
    opts2.add_argument("--window-size=1920,1080")
    opts2.add_argument("--lang=zh-CN")
    opts2.binary_location = "/snap/bin/chromium"
    
    try:
        driver = webdriver.Chrome(service=svc, options=opts2)
        print("Chrome started in headed mode!")
        driver.get("https://www.szlcsc.com/")
        time.sleep(3)
        print(f"Title: {driver.title}")
        driver.save_screenshot("/tmp/lcsc_selenium_test2.png")
        driver.quit()
    except Exception as e2:
        print(f"Error 2: {e2}")
        
        # Try with more debugging
        import subprocess
        result = subprocess.run(["/snap/bin/chromium", "--version"], capture_output=True, text=True, timeout=10)
        print(f"Chromium version: {result.stdout}")
        
        result = subprocess.run(["/snap/bin/chromium", "--headless=new", "--no-sandbox", "--disable-gpu", "--dump-dom", "https://www.szlcsc.com/"], 
                              capture_output=True, text=True, timeout=15)
        print(f"Headless dump-dom stdout ({len(result.stdout)} bytes): {result.stdout[:500]}")
        print(f"stderr: {result.stderr[:500]}")
