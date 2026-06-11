"""Shared ERP API client for Supply Chain Analytics."""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests
from api.models import SalesgentToken

logger = logging.getLogger(__name__)

ERP_BASE = "https://erp.101distributorsga.com"
DEFAULT_STORE_IDS = "1,2"


def _get_access_token():
    token = SalesgentToken.objects.filter(id=1).first()
    return token.accessToken if token else ""


def erp_headers(referer_path="/"):
    token = _get_access_token()
    return {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9",
        "Authorization": f"Bearer {token}",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": f"{ERP_BASE}{referer_path}",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }


def _unwrap_erp_response(payload: Any) -> tuple[Any, str | None]:
    if payload is None:
        return None, "Empty ERP response"
    if isinstance(payload, dict):
        if payload.get("hasError"):
            return None, payload.get("error") or payload.get("message") or "ERP error"
        if "result" in payload:
            return payload["result"], None
    return payload, None


def erp_request(method: str, path: str, *, params=None, json_data=None, referer="/", timeout=60):
    """Call ERP API and return (result, error_message)."""
    url = f"{ERP_BASE}/api{path}" if path.startswith("/") else f"{ERP_BASE}/api/{path}"
    headers = erp_headers(referer)
    try:
        response = requests.request(
            method.upper(),
            url,
            headers=headers,
            params=params,
            json=json_data,
            timeout=timeout,
        )
        if response.status_code >= 400:
            return None, f"HTTP {response.status_code}: {response.text[:500]}"
        try:
            payload = response.json()
        except ValueError:
            return None, "Invalid JSON from ERP"
        return _unwrap_erp_response(payload)
    except requests.RequestException as exc:
        logger.exception("ERP request failed: %s %s", method, path)
        return None, str(exc)


def erp_get(path, params=None, referer="/", timeout=60):
    if params is None:
        params = {}
    if "storeIds" not in params and "storeIds=" not in path:
        params = {**params, "storeIds": DEFAULT_STORE_IDS}
    return erp_request("GET", path, params=params, referer=referer, timeout=timeout)


def erp_put(path, json_data=None, params=None, referer="/"):
    return erp_request("PUT", path, params=params, json_data=json_data, referer=referer)


def erp_fetch_many(specs: list[dict], max_workers=4) -> dict[str, dict]:
    """
    Fetch multiple ERP endpoints concurrently.
    Each spec: {"key": str, "method": "GET"|"PUT", "path": str, "params": {}, "json": {}, "referer": "/", "timeout": 60}
    Returns {key: {"data": ..., "error": ...}}
    """
    results = {}

    def _fetch(spec):
        key = spec["key"]
        method = spec.get("method", "GET")
        timeout = spec.get("timeout", 60)
        if method == "PUT":
            data, err = erp_put(
                spec["path"],
                json_data=spec.get("json"),
                params=spec.get("params"),
                referer=spec.get("referer", "/"),
            )
        else:
            data, err = erp_get(
                spec["path"],
                params=spec.get("params"),
                referer=spec.get("referer", "/"),
                timeout=timeout,
            )
        return key, {"data": data, "error": err}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_fetch, spec) for spec in specs]
        for future in as_completed(futures):
            key, result = future.result()
            results[key] = result
    return results


def safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default
