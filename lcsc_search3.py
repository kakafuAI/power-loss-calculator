#!/usr/bin/env python3
"""
LCSC - Handle WAF/anti-scraping and search
"""
import json, time, re
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
})

# Get homepage first to establish cookies
print("Getting homepage...")
r = session.get("https://www.szlcsc.com/", timeout=15)
print(f"Homepage: {r.status_code}, cookies: {dict(session.cookies)}")

# The WAF (xvasu) seems to trigger on subsequent requests
# Let me try a different approach - get the catalog page first which is SSR
print("\nGetting catalog page with category 11182...")
r = session.get("https://www.szlcsc.com/catalog.html?catalog=11182", timeout=15)
print(f"Catalog page: {r.status_code}, len={len(r.text)}")

# The catalog page should contain all the data we need via Next.js SSR
# Let me look for the __NEXT_DATA__ more carefully for product data
# Actually the catalog page might NOT SSR products - they could be loaded client-side

# Let me try a different approach: use the Next.js API route
# First, let's check if there's a _next/data/ endpoint
print("\nTrying Next.js data endpoint...")
next_url = "https://www.szlcsc.com/_next/data/zB4j9vyDVseJLA_HYMPg3/catalog/11182.json"
r = session.get(next_url, timeout=15)
print(f"Next.js data: {r.status_code}")
if r.status_code == 200:
    try:
        data = r.json()
        print(f"  Keys: {list(data.keys())}")
        pp = data.get('pageProps', {})
        print(f"  pageProps keys: {list(pp.keys())}")
        # Save it
        with open("/tmp/lcsc_next_data.json", "w") as f:
            json.dump(data, f, ensure_ascii=False)
    except:
        print(f"  Not JSON: {r.text[:300]}")

# Let me also try to use requests.Session with the previous cookies
# and see if we can get the search to work with the session cookies
print("\nTrying search with existing cookies...")
search_url = "https://so.szlcsc.com/search"
payload = {
    "keyword": "牛角型电解电容",
    "catalogId": 11182,
    "page": 1,
    "pageSize": 20,
    "paramList": [],
    "sort": "",
}
r = session.post(search_url, json=payload, timeout=15)
print(f"Search: {r.status_code}")
print(f"Content-Type: {r.headers.get('Content-Type', '')}")
print(f"Response text (first 300): {r.text[:300]}")

if r.status_code == 200 and 'json' in r.headers.get('Content-Type', ''):
    try:
        data = r.json()
        print(f"  OK: {data.get('ok')}")
        print(f"  Total: {data.get('result', {}).get('totalCount')}")
    except:
        print("  Not valid JSON")
else:
    # Maybe it's the WAF challenge
    print(f"  Full response: {r.text[:500]}")
