#!/usr/bin/env python3
"""
LCSC - Try different search API approaches
"""
import json, time, re
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
})

# First, get the homepage to establish session cookies
r = session.get("https://www.szlcsc.com/", timeout=15)
print(f"Homepage: {r.status_code}, cookies: {len(session.cookies)}")

# Try so.szlcsc.com search API with various parameter formats
print("\n=== Trying so.szlcsc.com search ===")

# The catalog ID for 牛角型电解电容 is 11182
# Let's try the search API that the frontend likely calls

# Approach 1: POST to search API
search_url = "https://so.szlcsc.com/search"
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
}

payload = {
    "keyword": "",
    "catalogId": 11182,
    "page": 1,
    "pageSize": 20,
    "paramList": [],
    "sort": "",
}

r = session.post(search_url, json=payload, headers=headers, timeout=15)
print(f"POST /search: {r.status_code}")
print(f"  Response: {r.text[:500]}")

# Approach 2: Try with different content type
r = session.post(search_url, data=payload, timeout=15)
print(f"\nPOST /search (form): {r.status_code}")
print(f"  Response: {r.text[:500]}")

# Approach 3: GET request
r = session.get(search_url, params={"catalogId": 11182, "page": 1, "pageSize": 20}, timeout=15)
print(f"\nGET /search: {r.status_code}")
print(f"  Response: {r.text[:500]}")

# Approach 4: Try lcscWwwUrl + search path
search_url2 = "https://www.szlcsc.com/api/search/products"
r = session.get(search_url2, params={"catalogId": 11182, "page": 1, "pageSize": 20}, timeout=15)
print(f"\nGET /api/search/products: {r.status_code}")
print(f"  Response: {r.text[:500]}")

# Approach 5: Try the old pattern
search_url3 = "https://www.szlcsc.com/search/"
r = session.get(search_url3, params={"catalogId": 11182, "keyword": "", "page": 1}, timeout=15)
print(f"\nGET /search/: {r.status_code}")
if r.headers.get('content-type', '').startswith('text/html'):
    print(f"  HTML response (title extraction):")
    title = re.findall(r'<title>(.*?)</title>', r.text)
    print(f"  Title: {title}")
    body = re.sub(r'<[^>]+>', ' ', r.text)[:300]
    print(f"  Body: {body}")
else:
    print(f"  Response: {r.text[:500]}")

# Approach 6: Try the catalog page category URL
print("\n=== Trying catalog page URLs ===")
urls = [
    f"https://www.szlcsc.com/catalog_cat_11182.html",
    f"https://www.szlcsc.com/catalog.html?catalog=11182",
]
for url in urls:
    r = session.get(url, timeout=15)
    print(f"\n{url[:60]}: {r.status_code}")
    # Check if there's embedded product data in the HTML
    # Look for JSON data in the page
    json_matches = re.findall(r'\"productId\":(\d+)', r.text)
    print(f"  Product IDs found: {len(json_matches)}")
    if json_matches:
        print(f"  First 10: {json_matches[:10]}")
    
    # Also look for product list data
    for pat in ['productList', 'productListVO', 'products', 'productVOs']:
        try:
            matches = re.findall(rf'"{pat}"\s*:\s*\[', r.text)
            if matches:
                print(f"  Found {pat}: {len(matches)}")
        except:
            pass

# Approach 7: Try the CAS (passport) service
print("\n=== Trying CAS / passport ===")
r = session.get("https://passport.szlcsc.com", timeout=15)
print(f"Passport: {r.status_code}")

# Let's also try to understand the search flow by looking at what happens
# when we navigate to the search page
print("\n=== Trying search.html (old site) ===")
r = session.get("https://www.szlcsc.com/search.html?keyword=牛角型", timeout=15)
print(f"search.html: {r.status_code}, len={len(r.text)}")
body_clean = re.sub(r'<[^>]+>', ' ', r.text)
body_clean = re.sub(r'\s+', ' ', body_clean).strip()
print(f"  Body: {body_clean[:500]}")
