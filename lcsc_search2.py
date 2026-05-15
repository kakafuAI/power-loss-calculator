#!/usr/bin/env python3
"""
LCSC - Search for snap-in capacitors with proper parameters
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

# Get homepage first
r = session.get("https://www.szlcsc.com/", timeout=15)
print(f"Homepage: {r.status_code}")

search_url = "https://so.szlcsc.com/search"

def search_capacitors(keyword="", catalog_id=11182, page=1, page_size=20, params_list=None):
    """Search for capacitors with given parameters."""
    payload = {
        "keyword": keyword,
        "catalogId": catalog_id,
        "page": page,
        "pageSize": page_size,
        "paramList": params_list or [],
        "sort": "",
    }
    r = session.post(search_url, json=payload, timeout=15)
    result = r.json()
    return result

# Try with keyword first
print("\n=== Approach 1: Search with keyword ===")
result = search_capacitors(keyword="牛角")
if result.get("ok"):
    total = result["result"]["totalCount"]
    products = result["result"]["productRecordList"]
    print(f"Total: {total}, Products on page: {len(products)}")
    for p in products[:5]:
        print(json.dumps(p, ensure_ascii=False)[:500])
        print("---")

# Try with catalog ID and no keyword
print("\n=== Approach 2: Catalog ID only ===")
result = search_capacitors(catalog_id=11182)
if result.get("ok"):
    total = result["result"]["totalCount"]
    products = result["result"]["productRecordList"]
    print(f"Total: {total}, Products on page: {len(products)}")
    
    # Also check other groups
    for key in result["result"]:
        val = result["result"][key]
        if isinstance(val, list) and len(val) > 0:
            print(f"  {key}: {len(val)} items, first: {json.dumps(val[0], ensure_ascii=False)[:200]}")

# Try with sub-catalog IDs
print("\n=== Approach 3: Try different keywords ===")
for kw in ["牛角型", "电解电容", "牛角型电解电容", "铝电解电容", "CD29", "snap-in"]:
    result = search_capacitors(keyword=kw)
    total = result.get("result", {}).get("totalCount", 0)
    print(f"  '{kw}': total={total}")

# Check what parameters/params are supported
print("\n=== Approach 4: Check available filter params ===")
# First get the filter groups
payload = {
    "keyword": "牛角型电解电容",
    "catalogId": 11182,
    "page": 1,
    "pageSize": 20,
    "paramList": [],
    "sort": "",
}
r = session.post(search_url, json=payload, timeout=15)
data = r.json()
if data.get("ok"):
    result = data["result"]
    # Check for filter/param groups
    for key in result:
        val = result[key]
        if isinstance(val, list) and len(val) > 0:
            print(f"\n  {key}:")
            for item in val[:5]:
                if isinstance(item, dict):
                    print(f"    {json.dumps(item, ensure_ascii=False)[:200]}")
                else:
                    print(f"    {str(item)[:200]}")
