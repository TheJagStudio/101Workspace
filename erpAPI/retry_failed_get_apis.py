#!/usr/bin/env python3
"""Retry failed GET API probes using real IDs discovered from list endpoints."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

# Reuse probe helpers
from probe_get_apis import (
    DEFAULT_BASE_URL,
    DEFAULT_STORE_IDS,
    DEFAULT_TOKEN,
    ProbeResult,
    build_request_url,
    infer_json_schema,
    probe_one,
    result_to_dict,
    truncate_sample,
)
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent

DISCOVERY_CALLS = [
    ("/product/list?storeIds={storeIds}&page=0&size=5", ["productId", "id"]),
    ("/customer/list?storeIds={storeIds}&page=0&size=5", ["customerId", "id"]),
    ("/vendor/list?storeIds={storeIds}&page=0&size=5", ["vendorId", "id"]),
    ("/order/list?storeIds={storeIds}&page=0&size=5", ["orderId", "id"]),
    ("/employee/list?storeIds={storeIds}&page=0&size=5", ["employeeId", "id"]),
    ("/brand/list", ["brandId", "id"]),
    ("/category/all", ["categoryId", "id"]),
]


def fetch_json(url: str, token: str) -> dict | list | None:
    headers = {
        "Accept": "application/json, text/plain",
        "Authorization": f"Bearer {token}",
    }
    try:
        req = Request(url, headers=headers, method="GET")
        with urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def extract_ids(payload: dict | list | None, keys: list[str]) -> list[str]:
    if not payload:
        return []
    items: list = []
    if isinstance(payload, dict):
        result = payload.get("result", payload)
        if isinstance(result, dict) and "content" in result:
            items = result["content"]
        elif isinstance(result, list):
            items = result
        elif isinstance(result, dict):
            items = [result]
    elif isinstance(payload, list):
        items = payload

    ids: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        for key in keys:
            if key in item and item[key] is not None:
                ids.append(str(item[key]))
                break
    return ids


def discover_ids(base_url: str, token: str) -> dict[str, str]:
    discovered: dict[str, str] = {
        "storeIds": DEFAULT_STORE_IDS,
        "storeId": "1",
        "fieldId": "450",
        "moduleId": "1",
    }
    for path_tpl, keys in DISCOVERY_CALLS:
        path = path_tpl.replace("{storeIds}", quote(DEFAULT_STORE_IDS, safe=","))
        url = build_request_url(base_url, path)
        data = fetch_json(url, token)
        ids = extract_ids(data, keys)
        if ids:
            # Map generic names
            for key in keys:
                base = key.replace("Id", "")
                discovered[key] = ids[0]
                discovered[base] = ids[0]
            print(f"  discovered {keys[0]}={ids[0]} from {path_tpl}")
    return discovered


def substitute_template(template: str, ids: dict[str, str]) -> tuple[str, list[dict]]:
    path_part, _, query_part = template.partition("?")
    used: list[dict] = []

    def pick(name_hint: str, idx: int) -> str:
        for candidate in (name_hint, f"{name_hint}Id", "id"):
            if candidate in ids:
                return ids[candidate]
        return ids.get("id", "1")

    segments = []
    idx = 0
    for seg in path_part.split("/"):
        if seg == "{param}":
            val = ids.get("id", "1")
            used.append({"name": f"path_param_{idx}", "location": "path", "value": val})
            segments.append(val)
            idx += 1
        elif re.fullmatch(r"\{(\w+)\}", seg):
            name = seg[1:-1]
            val = pick(name, idx)
            used.append({"name": name, "location": "path", "value": val})
            segments.append(val)
            idx += 1
        else:
            segments.append(seg)

    concrete = "/".join(segments)
    if not concrete.startswith("/"):
        concrete = "/" + concrete

    if query_part:
        pairs = []
        for pair in query_part.split("&"):
            k, _, v = pair.partition("=")
            if v == "{param}" or re.fullmatch(r"\{(\w+)\}", v or ""):
                val = ids.get(k, ids.get(k.replace("Ids", "Id"), DEFAULT_STORE_IDS if "store" in k.lower() else "1"))
                used.append({"name": k, "location": "query", "value": val})
                pairs.append(f"{k}={quote(str(val), safe=',')}")
            else:
                pairs.append(pair)
        concrete += "?" + "&".join(pairs)

    return concrete, used


def main() -> int:
    probed_path = ROOT / "erp-get-apis-probed.json"
    if not probed_path.is_file():
        print("Run probe_get_apis.py first", file=sys.stderr)
        return 1

    data = json.loads(probed_path.read_text(encoding="utf-8"))
    failed = data.get("failed_apis", [])
    working = data.get("working_apis", [])

    print("Discovering real IDs...")
    ids = discover_ids(DEFAULT_BASE_URL, DEFAULT_TOKEN)

    newly_working: list[dict] = []
    still_failed: list[dict] = []

    for item in failed:
        template = item["path_template"]
        # Only retry endpoints that need dynamic IDs or returned 400/404
        if item.get("http_status") not in (400, 404, 412, None) and "{param}" not in template:
            still_failed.append(item)
            continue

        concrete, _ = substitute_template(template, ids)
        ep = {"path": template, "line": item.get("line")}
        result = probe_one(ep, DEFAULT_BASE_URL, DEFAULT_TOKEN, 20)
        rd = result_to_dict(result)
        if result.works:
            newly_working.append(rd)
            print(f"  RECOVERED {template}")
        else:
            still_failed.append(rd)

    merged_working = working + newly_working
    # dedupe by path_template
    seen = set()
    unique_working = []
    for w in merged_working:
        if w["path_template"] not in seen:
            seen.add(w["path_template"])
            unique_working.append(w)

    out = {
        "meta": {
            **data["meta"],
            "retry_recovered": len(newly_working),
            "working_count_after_retry": len(unique_working),
            "failed_count_after_retry": len(still_failed),
            "discovered_ids": ids,
        },
        "working_apis": unique_working,
        "failed_apis": still_failed,
    }

    (ROOT / "erp-get-apis-probed.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (ROOT / "erp-get-apis-working.json").write_text(
        json.dumps(
            {"meta": out["meta"], "apis": unique_working},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(f"\nRecovered {len(newly_working)} more APIs")
    print(f"Total working: {len(unique_working)} / failed: {len(still_failed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
