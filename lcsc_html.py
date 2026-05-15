#!/usr/bin/env python3
"""
LCSC - Get HTML pages first to understand the API structure
"""
import json, time, re, os
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
})

def get_html(url, name="page"):
    print(f"\n[{name}] Fetching: {url}")
    r = session.get(url, timeout=20)
    print(f"  Status: {r.status_code}, Content-Type: {r.headers.get('Content-Type', 'N/A')}")
    
    # Save HTML
    path = f"/tmp/lcsc_{name}.html"
    with open(path, "w", encoding="utf-8") as f:
        f.write(r.text)
    print(f"  Saved to {path} ({len(r.text)} bytes)")
    
    # Extract script tags that might contain API config
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', r.text, re.DOTALL)
    for s in scripts:
        s_stripped = s.strip()
        if s_stripped and ('csrf' in s_stripped.lower() or 'token' in s_stripped.lower() or 'api' in s_stripped.lower() or 'config' in s_stripped.lower()):
            print(f"  Relevant script: {s_stripped[:500]}")
    
    # Look for CSRF meta tags
    csrf_meta = re.findall(r'<meta[^>]*csrf[^>]*>', r.text, re.IGNORECASE)
    if csrf_meta:
        print(f"  CSRF meta tags: {csrf_meta}")
    
    # Look for setup/init data
    init_data = re.findall(r'window\.__NUXT__\s*=\s*({.*?});', r.text, re.DOTALL)
    if init_data:
        print(f"  __NUXT__ data found ({len(init_data[0])} chars)")
        # Save it separately
        with open(f"/tmp/lcsc_{name}_nuxt.json", "w") as f:
            f.write(init_data[0])
    
    # Page title
    title = re.findall(r'<title>(.*?)</title>', r.text)
    if title:
        print(f"  Title: {title[0]}")
    
    # Body text preview
    body_match = re.search(r'<body[^>]*>(.*?)</body>', r.text, re.DOTALL)
    if body_match:
        body_text = re.sub(r'<[^>]+>', ' ', body_match.group(1))
        body_text = re.sub(r'\s+', ' ', body_text).strip()
        print(f"  Body text preview: {body_text[:300]}")
    
    return r

# Step 1: Get homepage
get_html("https://www.szlcsc.com/", "home")

# Step 2: Try catalog page
get_html("https://www.szlcsc.com/catalog.html", "catalog")

# Step 3: Try the search page (maybe it's a different URL)
# Common LCSC search patterns
search_urls = [
    "https://www.szlcsc.com/search?keyword=牛角型电解电容",
    "https://www.szlcsc.com/search.html?keyword=牛角型电解电容",
    "https://www.szlcsc.com/catalog?keyword=牛角型电解电容",
    "https://www.szlcsc.com/products/search?keyword=牛角型电解电容",
]
for url in search_urls:
    get_html(url, "search_try")

# Step 4: Look at cookie/session info
print(f"\nCookies: {dict(session.cookies)}")
print(f"Headers: {dict(session.headers)}")
