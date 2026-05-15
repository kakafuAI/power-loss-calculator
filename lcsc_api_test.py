#!/usr/bin/env python3
"""
使用 requests 直接爬取立创商城 LCSC 的牛角型电解电容数据
通过分析 API 接口获取数据
"""
import json, time, re, os
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.szlcsc.com/",
})

def api_get(url, max_retries=3):
    for i in range(max_retries):
        try:
            r = session.get(url, timeout=15)
            if r.status_code == 200:
                return r
            print(f"HTTP {r.status_code} for {url[:80]}")
        except Exception as e:
            print(f"Request error: {e}")
        time.sleep(2)
    return None

def main():
    print("="*60)
    print("立创商城 - 牛角型电解电容查询")
    print("="*60)

    # Step 1: Get homepage to establish cookies/session
    print("\n[1] Getting homepage...")
    r = api_get("https://www.szlcsc.com/")
    if not r:
        print("Failed to load homepage!")
        return
    print(f"Homepage loaded, cookies: {len(session.cookies)} cookies")

    # Step 2: Try to find the catalog API
    # LCSC uses an API at: https://www.szlcsc.com/api/search/
    # Let's try the category search first
    print("\n[2] Searching for 牛角型电解电容 category...")
    
    # Try to search for products with keywords
    search_url = "https://www.szlcsc.com/api/search/searchProductByKeyword"
    params = {"keyword": "牛角型电解电容", "page": 1, "pageSize": 20}
    r = api_get(f"{search_url}?{requests.models.PreparedRequest().prepare_url(requests.models.PreparedRequest(), params)}" if False else 
                search_url)
    
    # Actually let's just directly search
    search_url = f"https://www.szlcsc.com/api/search/searchProductByKeyword?keyword=牛角型电解电容&page=1&pageSize=20"
    r = api_get(search_url)
    if r and r.status_code == 200:
        try:
            data = r.json()
            print(f"Search API response keys: {list(data.keys())}")
            print(json.dumps(data, ensure_ascii=False, indent=2)[:2000])
        except:
            print(f"Not JSON, content[:500]: {r.text[:500]}")
    else:
        print(f"Search API failed or no response")

    # Try the catalog API
    print("\n[3] Trying catalog API...")
    catalog_url = "https://www.szlcsc.com/api/catalog/getCatalogs"
    r = api_get(catalog_url)
    if r:
        try:
            data = r.json()
            print(json.dumps(data, ensure_ascii=False, indent=2)[:2000])
        except:
            print(f"Not JSON: {r.text[:500]}")
    
    # Try product search with different parameters
    print("\n[4] Trying product search API...")
    # LCSC search API
    search_urls = [
        "https://www.szlcsc.com/api/search/products?keyword=牛角型&page=1&pageSize=20",
        "https://www.szlcsc.com/api/search/products?keyword=牛角型电解电容&page=1&pageSize=20",
        "https://www.szlcsc.com/api/search/product?keyword=牛角型&page=1&pageSize=20",
        "https://www.szlcsc.com/search.html?keyword=牛角型电解电容",
    ]
    for url in search_urls:
        print(f"\nTrying: {url[:80]}")
        r = api_get(url)
        if r:
            print(f"  Status: {r.status_code}, Content-Type: {r.headers.get('Content-Type', 'N/A')}")
            if 'json' in r.headers.get('Content-Type', ''):
                data = r.json()
                print(f"  Keys: {list(data.keys())}")
                print(f"  First 1000 chars: {json.dumps(data, ensure_ascii=False)[:1000]}")
            else:
                # It's HTML, let's check for product data
                html = r.text
                # Look for product data in script tags
                scripts = re.findall(r'<script[^>]*>([^<]+)</script>', html)
                for s in scripts[:5]:
                    if 'product' in s.lower() or 'goods' in s.lower() or '商品' in s or '产品' in s:
                        print(f"  Found relevant script tag: {s[:300]}")
                
                # Try to find JSON data embedded in HTML
                json_patterns = re.findall(r'window\.__NUXT__\s*=\s*({.*?});', html)
                if json_patterns:
                    print(f"  Found NUXT data: {json_patterns[0][:500]}")
                
                json_patterns2 = re.findall(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', html)
                if json_patterns2:
                    print(f"  Found NEXT data: {json_patterns2[0][:500]}")
                
                print(f"  Page title found: {re.findall(r'<title>(.*?)</title>', html)}")
                print(f"  First 500 chars of body text (approx):")
                body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
                if body_match:
                    body_text = re.sub(r'<[^>]+>', ' ', body_match.group(1))
                    body_text = re.sub(r'\s+', ' ', body_text).strip()
                    print(f"  {body_text[:500]}")

if __name__ == "__main__":
    main()
