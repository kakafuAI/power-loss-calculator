#!/usr/bin/env python3
"""
LCSC - Access the snap-in capacitor category page and extract product listings
"""
import json, time, re, os
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
})

# Category ID for 牛角型电解电容
CAT_ID = 11182

def get_html(url, name="page"):
    print(f"\n[{name}] Fetching: {url}")
    r = session.get(url, timeout=20)
    print(f"  Status: {r.status_code}, Content-Type: {r.headers.get('Content-Type', 'N/A')}")
    
    path = f"/tmp/lcsc_{name}.html"
    with open(path, "w", encoding="utf-8") as f:
        f.write(r.text)
    print(f"  Saved to {path} ({len(r.text)} bytes)")
    return r

# Try different URLs for the category page
print("=== Trying category URLs ===")
urls = [
    f"https://www.szlcsc.com/catalog_cat_{CAT_ID}.html",
    f"https://www.szlcsc.com/catalog/cat_{CAT_ID}.html",
    f"https://www.szlcsc.com/products/catalog/{CAT_ID}",
    f"https://www.szlcsc.com/catalog.html?catalog={CAT_ID}",
]

for url in urls:
    r = get_html(url, f"cat_{CAT_ID}")
    body = r.text
    # Check if we got a proper page with products
    has_products = 'product' in body.lower() or 'goods' in body.lower()
    has_results = 'result' in body.lower() or '共 ' in body or '商品' in body
    has_filter = 'filter' in body.lower() or '筛选' in body
    if has_products or has_results:
        print(f"  -> This page seems right! Products: {has_products}, Results: {has_results}")
        break

# Now let's also try the search API through so.szlcsc.com
print("\n=== Trying search API ===")
search_url = "https://so.szlcsc.com/search"
params = {
    "keyword": "牛角型电解电容",
    "catalogId": CAT_ID,
    "page": 1,
    "pageSize": 20,
}
r = session.get(search_url, params=params, timeout=20)
print(f"  Status: {r.status_code}")
print(f"  Content: {r.text[:500]}")
