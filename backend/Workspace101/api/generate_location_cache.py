"""
Generate a local JSON cache of all US states → cities and counties from the ERP API.

Usage:
    cd backend/Workspace101
    python api/generate_location_cache.py

The output is saved to data/erp_locations_cache.json and loaded at startup by
SummerSaleUserRegistration so we don't have to call the ERP for every lookup.
"""

import json
import os
import sys
import time
import requests

# Add the project root to sys.path so Django settings can be imported
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Workspace101.settings")

import django
django.setup()

from api.models import SalesgentToken

ERP_BASE = "https://erp.101distributorsga.com"

STATE_ID_TO_NAME = {
    1: "Alabama", 2: "Alaska", 3: "Arizona", 4: "Arkansas",
    5: "California", 6: "Colorado", 7: "Connecticut", 8: "Delaware",
    9: "District Of Columbia", 10: "Florida", 11: "Georgia",
    12: "Hawaii", 13: "Idaho", 14: "Illinois", 15: "Indiana",
    16: "Iowa", 17: "Kansas", 18: "Kentucky", 19: "Louisiana",
    20: "Maine", 21: "Maryland", 22: "Massachusetts", 23: "Michigan",
    24: "Minnesota", 25: "Mississippi", 26: "Missouri", 27: "Montana",
    28: "Nebraska", 29: "Nevada", 30: "New Hampshire",
    31: "New Jersey", 32: "New Mexico", 33: "New York",
    34: "North Carolina", 35: "North Dakota", 36: "Ohio",
    37: "Oklahoma", 38: "Oregon", 39: "Pennsylvania",
    40: "Rhode Island", 41: "South Carolina", 42: "South Dakota",
    43: "Tennessee", 44: "Texas", 45: "Utah", 46: "Vermont",
    47: "Virginia", 48: "Washington", 49: "West Virginia",
    50: "Wisconsin", 51: "Wyoming",
}


def get_headers():
    token_obj = SalesgentToken.objects.first()
    if not token_obj:
        raise RuntimeError("No SalesgentToken in the database")
    return {
        "Authorization": f"Bearer {token_obj.accessToken}",
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Origin": ERP_BASE,
        "Pragma": "no-cache",
        "Referer": f"{ERP_BASE}/customer/add",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/149.0.0.0 Safari/537.36"
        ),
        "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }


def fetch_list(url, headers, retries=3):
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=headers, timeout=20)
            resp.raise_for_status()
            return resp.json().get("result", [])
        except Exception as e:
            print(f"  Attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                time.sleep(2)
    return []


def main():
    headers = get_headers()
    cache = {}

    print(f"Caching locations for {len(STATE_ID_TO_NAME)} states...")

    for state_id, state_name in sorted(STATE_ID_TO_NAME.items()):
        print(f"\n[{state_id}] {state_name}")

        cities = fetch_list(f"{ERP_BASE}/api/city/stateId/{state_id}", headers)
        counties = fetch_list(f"{ERP_BASE}/api/county/stateId/{state_id}", headers)

        cache[str(state_id)] = {
            "name": state_name,
            "cities": [{"id": c["id"], "name": c["name"]} for c in cities],
            "counties": [{"id": c["id"], "name": c["name"]} for c in counties],
        }

        print(f"  Cities: {len(cities)}, Counties: {len(counties)}")
        time.sleep(0.3)  # small delay to be nice to the API

    # Write to data/erp_locations_cache.json
    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    out_path = os.path.join(data_dir, "erp_locations_cache.json")

    with open(out_path, "w") as f:
        json.dump(cache, f, indent=2)

    print(f"\nDone! Cache saved to {out_path}")
    total_cities = sum(len(s["cities"]) for s in cache.values())
    total_counties = sum(len(s["counties"]) for s in cache.values())
    print(f"Total: {len(cache)} states, {total_cities} cities, {total_counties} counties")


if __name__ == "__main__":
    main()
