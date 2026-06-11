#!/usr/bin/env python3
"""
Probe all GET APIs extracted from erp-all.js against the live ERP server.

Uses auth headers from a reference curl. For each endpoint:
  - Builds a test URL with sensible default parameter values
  - Records whether the call succeeds (HTTP 2xx + JSON)
  - Infers input requirements and output JSON shape
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent

DEFAULT_BASE_URL = "https://erp.101distributorsga.com/api"
DEFAULT_STORE_IDS = "1,2,3,4,5"
DEFAULT_TOKEN = (
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzgwNzA2NjM3LCJ1c2VySWQiOjIwLCJpYXQiOjE3ODA1ODY2MzcsInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.rRhqD5TmNqDfdoKEdKDhXXRfiFyX-1cfMb1YCF_dolE"
)

# Context-aware defaults for path/query placeholder names.
PARAM_DEFAULTS: dict[str, str] = {
    "storeIds": DEFAULT_STORE_IDS,
    "storeId": "1",
    "page": "0",
    "size": "20",
    "orderId": "1",
    "productId": "1",
    "customerId": "1",
    "vendorId": "1",
    "employeeId": "1",
    "recordId": "1",
    "moduleId": "1",
    "parentModuleId": "1",
    "stateId": "1",
    "countryId": "1",
    "id": "1",
    "quotationId": "1",
    "salesOrderId": "1",
    "inventoryId": "1",
    "paymentId": "1",
    "parentPaymentId": "1",
    "taxTypeId": "1",
    "categoryId": "1",
    "brandId": "1",
    "roleId": "1",
    "fieldId": "450",
    "uuid": "00000000-0000-0000-0000-000000000001",
    "fromDate": "2024-01-01",
    "toDate": "2025-12-31",
    "startDate": "2024-01-01",
    "endDate": "2025-12-31",
    "search": "",
    "keyword": "",
    "q": "",
}

GENERIC_PARAM_VALUE = "1"

# Endpoints that return binary/large exports — still test but mark separately.
EXPORT_PATH_MARKERS = ("/export/", "/csv", "/pdf", "/download")


@dataclass
class InputParam:
    name: str
    location: str  # path | query
    required: bool
    default_used: str | None
    description: str | None = None


@dataclass
class ProbeResult:
    path_template: str
    method: str = "GET"
    works: bool = False
    http_status: int | None = None
    tested_url: str = ""
    error: str | None = None
    input_params: list[InputParam] = field(default_factory=list)
    output_format: dict[str, Any] = field(default_factory=dict)
    sample_response: Any = None
    response_content_type: str | None = None
    line: int | None = None
    duration_ms: int | None = None


def infer_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def infer_json_schema(value: Any, max_depth: int = 4, max_props: int = 40) -> dict[str, Any]:
    """Build a lightweight JSON schema description from a response sample."""
    t = infer_type(value)
    if t == "object" and max_depth > 0:
        props: dict[str, Any] = {}
        for i, (k, v) in enumerate(value.items()):
            if i >= max_props:
                props["..."] = {"type": "...", "note": f"{len(value) - max_props} more keys"}
                break
            props[k] = infer_json_schema(v, max_depth - 1, max_props)
        return {"type": "object", "properties": props}
    if t == "array" and max_depth > 0:
        if not value:
            return {"type": "array", "items": {"type": "unknown"}}
        return {"type": "array", "items": infer_json_schema(value[0], max_depth - 1, max_props)}
    return {"type": t}


def truncate_sample(value: Any, max_items: int = 2, max_str: int = 200) -> Any:
    if isinstance(value, dict):
        return {k: truncate_sample(v, max_items, max_str) for k, v in list(value.items())[:15]}
    if isinstance(value, list):
        return [truncate_sample(v, max_items, max_str) for v in value[:max_items]]
    if isinstance(value, str) and len(value) > max_str:
        return value[:max_str] + "..."
    return value


def parse_path_template(template: str) -> tuple[str, list[InputParam]]:
    """Split path template into concrete path pattern and declared params."""
    params: list[InputParam] = []
    path_part, _, query_part = template.partition("?")

    # Path placeholders
    path_segments = path_part.split("/")
    concrete_segments: list[str] = []
    path_param_idx = 0
    for seg in path_segments:
        if seg == "{param}":
            # Try to infer name from neighbors in full template
            name = f"path_param_{path_param_idx}"
            path_param_idx += 1
            default = GENERIC_PARAM_VALUE
            params.append(
                InputParam(
                    name=name,
                    location="path",
                    required=True,
                    default_used=default,
                    description="Dynamic path segment (placeholder name unknown in bundle)",
                )
            )
            concrete_segments.append(default)
        else:
            # Named placeholders like not used in our extraction, but handle if present
            m = re.fullmatch(r"\{(\w+)\}", seg)
            if m:
                name = m.group(1)
                default = PARAM_DEFAULTS.get(name, GENERIC_PARAM_VALUE)
                params.append(
                    InputParam(name=name, location="path", required=True, default_used=default)
                )
                concrete_segments.append(default)
            else:
                concrete_segments.append(seg)

    concrete_path = "/".join(concrete_segments)
    if not concrete_path.startswith("/"):
        concrete_path = "/" + concrete_path

    query_dict: dict[str, str] = {}
    if query_part:
        for pair in query_part.split("&"):
            if not pair:
                continue
            key, _, val = pair.partition("=")
            if val == "{param}":
                default = PARAM_DEFAULTS.get(key, GENERIC_PARAM_VALUE)
                params.append(
                    InputParam(name=key, location="query", required=True, default_used=default)
                )
                query_dict[key] = default
            else:
                m = re.fullmatch(r"\{(\w+)\}", val)
                if m:
                    name = m.group(1)
                    default = PARAM_DEFAULTS.get(name, GENERIC_PARAM_VALUE)
                    params.append(
                        InputParam(name=name, location="query", required=True, default_used=default)
                    )
                    query_dict[key] = default
                else:
                    params.append(
                        InputParam(
                            name=key,
                            location="query",
                            required="{param}" in val,
                            default_used=val or None,
                        )
                    )
                    query_dict[key] = val

    # Common ERP pattern: add storeIds if sibling endpoints use it and this one doesn't
    if "storeIds" not in query_dict and "storeIds" not in template:
        # only for resource APIs that often need store context
        if any(
            concrete_path.startswith(prefix)
            for prefix in (
                "/product",
                "/order",
                "/customer",
                "/vendor",
                "/inventory",
                "/report",
                "/salesOrder",
                "/quotation",
                "/purchaseOrder",
                "/employee",
                "/bill",
            )
        ):
            query_dict.setdefault("storeIds", DEFAULT_STORE_IDS)
            params.append(
                InputParam(
                    name="storeIds",
                    location="query",
                    required=False,
                    default_used=DEFAULT_STORE_IDS,
                    description="Added by probe — commonly required for multi-store endpoints",
                )
            )

    # Pagination defaults for list endpoints
    if concrete_path.endswith("/list") or "/list?" in template or concrete_path.endswith("/all"):
        if "page" not in query_dict:
            query_dict.setdefault("page", "0")
            params.append(
                InputParam(name="page", location="query", required=False, default_used="0")
            )
        if "size" not in query_dict:
            query_dict.setdefault("size", "20")
            params.append(
                InputParam(name="size", location="query", required=False, default_used="20")
            )

    if query_dict:
        concrete_path += "?" + urlencode(query_dict)

    return concrete_path, params


def build_request_url(base_url: str, path_with_query: str) -> str:
    base = base_url.rstrip("/")
    path = path_with_query if path_with_query.startswith("/") else "/" + path_with_query
    return base + path


def probe_one(
    endpoint: dict[str, Any],
    base_url: str,
    token: str,
    timeout: int,
) -> ProbeResult:
    template = endpoint["path"]
    result = ProbeResult(path_template=template, line=endpoint.get("line"))

    concrete_path, params = parse_path_template(template)
    result.input_params = params
    result.tested_url = build_request_url(base_url, concrete_path)

    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9",
        "Authorization": f"Bearer {token}",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://erp.101distributorsga.com/",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        ),
    }

    start = time.perf_counter()
    try:
        req = Request(result.tested_url, headers=headers, method="GET")
        with urlopen(req, timeout=timeout) as resp:
            status = resp.status
            content_type = resp.headers.get("Content-Type", "")
            body = resp.read()
            duration_ms = int((time.perf_counter() - start) * 1000)

        result.http_status = status
        result.response_content_type = content_type
        result.duration_ms = duration_ms

        if 200 <= status < 300:
            if "json" in content_type.lower():
                parsed = json.loads(body.decode("utf-8", errors="replace"))
                result.works = True
                result.output_format = infer_json_schema(parsed)
                result.sample_response = truncate_sample(parsed)
            elif any(m in template for m in EXPORT_PATH_MARKERS):
                result.works = True
                result.output_format = {
                    "type": "binary",
                    "content_type": content_type,
                    "size_bytes": len(body),
                }
                result.sample_response = None
            else:
                # Non-JSON success — still record
                text = body.decode("utf-8", errors="replace")[:500]
                result.works = True
                result.output_format = {"type": "text", "content_type": content_type}
                result.sample_response = text
        else:
            result.error = f"Unexpected status {status}"

    except HTTPError as e:
        result.http_status = e.code
        result.duration_ms = int((time.perf_counter() - start) * 1000)
        try:
            err_body = e.read().decode("utf-8", errors="replace")[:500]
        except Exception:
            err_body = ""
        result.error = f"HTTP {e.code}: {err_body or e.reason}"
    except URLError as e:
        result.duration_ms = int((time.perf_counter() - start) * 1000)
        result.error = f"URL error: {e.reason}"
    except json.JSONDecodeError as e:
        result.error = f"Invalid JSON response: {e}"
    except Exception as e:
        result.duration_ms = int((time.perf_counter() - start) * 1000)
        result.error = str(e)

    return result


def result_to_dict(r: ProbeResult) -> dict[str, Any]:
    return {
        "path_template": r.path_template,
        "method": r.method,
        "works": r.works,
        "http_status": r.http_status,
        "tested_url": r.tested_url,
        "duration_ms": r.duration_ms,
        "error": r.error,
        "line": r.line,
        "response_content_type": r.response_content_type,
        "input_requirements": [
            {
                "name": p.name,
                "location": p.location,
                "required": p.required,
                "default_used": p.default_used,
                "description": p.description,
            }
            for p in r.input_params
        ],
        "output_format": r.output_format,
        "sample_response": r.sample_response,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Probe ERP GET APIs and document I/O.")
    parser.add_argument(
        "--input",
        default=str(ROOT / "erp-apis.json"),
        help="Extracted APIs JSON (default: erpAPI/erp-apis.json)",
    )
    parser.add_argument(
        "--output",
        default=str(ROOT / "erp-get-apis-probed.json"),
        help="Output JSON path (default: erp-get-apis-probed.json)",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--token", default=DEFAULT_TOKEN)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0, help="Max endpoints to probe (0=all)")
    parser.add_argument("--only-working", action="store_true", help="Output only working APIs")
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"Error: {input_path} not found", file=sys.stderr)
        return 1

    all_apis = json.loads(input_path.read_text(encoding="utf-8"))
    get_apis = [a for a in all_apis if a.get("method") == "GET"]
    if args.limit:
        get_apis = get_apis[: args.limit]

    print(f"Probing {len(get_apis)} GET endpoints against {args.base_url} ...")

    results: list[ProbeResult] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(probe_one, ep, args.base_url, args.token, args.timeout): ep
            for ep in get_apis
        }
        done = 0
        for fut in as_completed(futures):
            done += 1
            results.append(fut.result())
            if done % 25 == 0 or done == len(get_apis):
                working = sum(1 for r in results if r.works)
                print(f"  {done}/{len(get_apis)} tested, {working} working so far")

    results.sort(key=lambda r: r.path_template)
    working = [r for r in results if r.works]
    failed = [r for r in results if not r.works]

    payload = {
        "meta": {
            "base_url": args.base_url,
            "total_get_endpoints": len(get_apis),
            "working_count": len(working),
            "failed_count": len(failed),
            "probed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "notes": (
                "Path placeholders {param} are tested with generic value '1'. "
                "Some failures may be due to missing valid IDs, not broken APIs."
            ),
        },
        "working_apis": [result_to_dict(r) for r in working],
        "failed_apis": [result_to_dict(r) for r in failed] if not args.only_working else [],
    }

    if args.only_working:
        payload = {
            "meta": payload["meta"],
            "apis": payload["working_apis"],
        }

    out_path = Path(args.output)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    working_path = out_path.with_name("erp-get-apis-working.json")
    working_payload = {
        "meta": payload["meta"],
        "apis": payload["working_apis"] if not args.only_working else payload["apis"],
    }
    working_path.write_text(
        json.dumps(working_payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\nDone: {len(working)} working / {len(failed)} failed")
    print(f"Wrote {out_path}")
    print(f"Wrote {working_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
