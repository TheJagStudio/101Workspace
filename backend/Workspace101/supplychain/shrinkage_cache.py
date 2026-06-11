"""Cached per-product shrinkage detail (inventory log + audit trail)."""

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from supplychain.erp_client import erp_fetch_many, safe_float

CACHE_PREFIX = "supplychain:shrinkage_detail"
CACHE_TTL = 7 * 24 * 60 * 60
LOG_TIMEOUT = 25


def _cache_key(store_ids: str, product_id: int) -> str:
    return f"{CACHE_PREFIX}:{store_ids}:{product_id}"


def _normalize_rows(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("content") or data.get("data") or data.get("result") or []
    return []


def _flatten_audits(data):
    rows = _normalize_rows(data)
    flattened = []
    for entry in rows:
        if not isinstance(entry, dict):
            continue
        nested = entry.get("data")
        if isinstance(nested, list):
            flattened.extend(nested)
        else:
            flattened.append(entry)
    return flattened


def _log_shrinkage_events(log_rows):
    events = []
    for row in log_rows:
        if not isinstance(row, dict):
            continue
        qty = safe_float(row.get("quantity") or row.get("changeQuantity"))
        if qty >= 0:
            continue
        events.append({
            "id": row.get("id"),
            "productId": row.get("productId"),
            "productName": row.get("productName"),
            "quantity": qty,
            "reason": row.get("notes") or row.get("transactionType"),
            "date": row.get("insertedTimestamp"),
            "type": "log",
        })
    return events


def build_product_detail(store_ids: str, product_id: int) -> dict:
    """Fetch inventory log + audit for one product. Uses a 1-year window to reduce ERP load."""
    end = timezone.now()
    start = end - timedelta(days=365)
    date_params = {
        "startDate": start.strftime("%Y-%m-%d+04:00:00"),
        "endDate": end.strftime("%Y-%m-%d+%H:%M:%S"),
    }

    sources = erp_fetch_many([
        {
            "key": "inventoryLog",
            "path": "/report/inventory/log",
            "params": {
                **date_params,
                "storeIds": store_ids,
                "productId": product_id,
                "page": 0,
                "size": 100,
            },
            "timeout": LOG_TIMEOUT,
        },
        {
            "key": "audits",
            "path": "/audit",
            "params": {"storeIds": store_ids, "recordId": product_id, "moduleId": 1},
            "timeout": LOG_TIMEOUT,
        },
    ])

    log_rows = _normalize_rows(sources.get("inventoryLog", {}).get("data"))
    audit_rows = _flatten_audits(sources.get("audits", {}).get("data"))

    return {
        "cachedAt": timezone.now().isoformat(),
        "productId": product_id,
        "inventoryLog": log_rows,
        "audits": audit_rows,
        "logEvents": _log_shrinkage_events(log_rows),
        "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
    }


def get_product_detail(*, store_ids: str, product_id: int, force_refresh: bool = False) -> dict:
    key = _cache_key(store_ids, product_id)
    snapshot = None if force_refresh else cache.get(key)
    from_cache = snapshot is not None

    if snapshot is None:
        snapshot = build_product_detail(store_ids, product_id)
        if not snapshot.get("erpErrors") or snapshot.get("inventoryLog") or snapshot.get("audits"):
            cache.set(key, snapshot, CACHE_TTL)
        from_cache = False

    return {
        **snapshot,
        "cache": {
            "hit": from_cache,
            "cachedAt": snapshot.get("cachedAt"),
            "ttlDays": 7,
        },
    }
