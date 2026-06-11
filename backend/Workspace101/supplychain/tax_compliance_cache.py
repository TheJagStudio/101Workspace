"""Weekly cache for multi-state tax compliance — heavy ERP fetches run once per week."""

from typing import List, Optional

from django.core.cache import cache
from django.utils import timezone

from supplychain.erp_client import erp_fetch_many, safe_float, safe_int

CACHE_PREFIX = "supplychain:tax_compliance"
CACHE_TTL = 7 * 24 * 60 * 60  # refresh weekly

# US state IDs in Salesgent ERP (alphabetical): FL=10, GA=11, AL=1, TN=42, SC=40, NC=33, TX=43
DEFAULT_TAX_STATE_IDS = [10, 11, 1, 42, 40, 33, 43]


def cache_key(store_ids: str, tax_type_id: int, state_id: int, state_ids: list[int]) -> str:
    states = ",".join(str(s) for s in sorted(set(state_ids)))
    return f"{CACHE_PREFIX}:{store_ids}:{tax_type_id}:{state_id}:{states}"


def _ytd_date_params():
    now = timezone.now()
    ytd_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return {
        "startDate": ytd_start.strftime("%Y-%m-%d+%H:%M:%S"),
        "endDate": now.strftime("%Y-%m-%d+%H:%M:%S"),
    }


def normalize_erp_list(data, *extra_keys):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("content", "data", "result", *extra_keys):
            val = data.get(key)
            if isinstance(val, list):
                return val
            if isinstance(val, dict) and isinstance(val.get("content"), list):
                return val["content"]
        return [v for v in data.values() if isinstance(v, dict)] if data else []
    return []


def aggregate_tax_rows(rows):
    by_state = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        state = row.get("stateName") or row.get("state") or row.get("stateCode") or "Unknown"
        amount = safe_float(
            row.get("taxAmount")
            or row.get("totalTax")
            or row.get("amount")
            or row.get("exciseTax")
            or row.get("exciseTaxAmount")
        )
        if not amount:
            continue
        if state not in by_state:
            by_state[state] = {"state": state, "taxCollected": 0.0, "transactionCount": 0}
        by_state[state]["taxCollected"] += amount
        by_state[state]["transactionCount"] += 1
    return by_state


def build_tax_compliance(
    *,
    store_ids: str,
    tax_type_id: int = 1,
    state_id: int = 10,
    state_ids: Optional[List[int]] = None,
) -> dict:
    """Fetch all ERP tax sources and return a cacheable snapshot."""
    state_ids = list(state_ids or DEFAULT_TAX_STATE_IDS)
    if state_id and state_id not in state_ids:
        state_ids.insert(0, state_id)

    date_params = _ytd_date_params()
    params = {
        "storeIds": store_ids,
        **date_params,
        "stateId": state_id,
        "taxTypeId": tax_type_id,
        "size": 500,
        "page": 0,
        "isTennessee": False,
    }

    specs = [
        {"key": "taxReport", "path": "/report/tax", "params": params, "timeout": 60},
        {
            "key": "excise",
            "path": "/report/tax/exciseTaxByLineItem",
            "params": params,
            "timeout": 45,
        },
        {
            "key": "stateCategories",
            "path": "/store/governmentStateCategory",
            "params": {"storeIds": store_ids, "stateId": state_id},
            "timeout": 30,
        },
    ]
    for sid in state_ids:
        specs.append({
            "key": f"purchaseTax_{sid}",
            "path": f"/report/tax/purchase/byTaxClassIdAndStateId/{tax_type_id}/stateId/{sid}",
            "params": params,
            "timeout": 60,
        })

    sources = erp_fetch_many(specs, max_workers=6)

    tax_raw = sources["taxReport"].get("data") or {}
    tax_rows = normalize_erp_list(tax_raw, "taxReportDtoList")
    by_state = aggregate_tax_rows(tax_rows)

    for sid in state_ids:
        purchase_raw = sources.get(f"purchaseTax_{sid}", {}).get("data") or {}
        purchase_rows = normalize_erp_list(purchase_raw)
        for state, bucket in aggregate_tax_rows(purchase_rows).items():
            if state not in by_state:
                by_state[state] = {"state": state, "taxCollected": 0.0, "transactionCount": 0}
            by_state[state]["taxCollected"] += bucket["taxCollected"]
            by_state[state]["transactionCount"] += bucket["transactionCount"]

    excise_raw = sources["excise"].get("data") or {}
    excise_rows = normalize_erp_list(excise_raw)
    for state, bucket in aggregate_tax_rows(excise_rows).items():
        if state not in by_state:
            by_state[state] = {"state": state, "taxCollected": 0.0, "transactionCount": 0}
        by_state[state]["taxCollected"] += bucket["taxCollected"]
        by_state[state]["transactionCount"] += bucket["transactionCount"]

    state_list = sorted(by_state.values(), key=lambda x: x["taxCollected"], reverse=True)
    for row in state_list:
        row["taxCollected"] = round(row["taxCollected"], 2)

    total_collected = round(sum(s["taxCollected"] for s in state_list), 2)
    erp_errors = {k: v["error"] for k, v in sources.items() if v.get("error")}
    if state_list:
        for optional in ("excise", "stateCategories", "taxReport"):
            erp_errors.pop(optional, None)

    return {
        "cachedAt": timezone.now().isoformat(),
        "storeIds": store_ids,
        "taxTypeId": tax_type_id,
        "stateId": state_id,
        "stateIds": state_ids,
        "dateRange": date_params,
        "taxByState": state_list,
        "exciseTax": excise_raw,
        "purchaseTax": sources.get(f"purchaseTax_{state_id}", {}).get("data"),
        "stateCategories": sources["stateCategories"].get("data"),
        "taxReport": tax_raw,
        "summary": {
            "totalTaxCollected": total_collected,
            "stateCount": len(state_list),
            "topState": state_list[0]["state"] if state_list else None,
        },
        "erpErrors": erp_errors,
    }


def get_tax_compliance(
    *,
    store_ids: str,
    tax_type_id: int = 1,
    state_id: int = 10,
    state_ids: Optional[List[int]] = None,
    force_refresh: bool = False,
    use_cache: bool = True,
) -> dict:
    state_ids = list(state_ids or DEFAULT_TAX_STATE_IDS)
    if state_id and state_id not in state_ids:
        state_ids.insert(0, state_id)

    key = cache_key(store_ids, tax_type_id, state_id, state_ids)
    snapshot = None if (force_refresh or not use_cache) else cache.get(key)
    from_cache = snapshot is not None

    if snapshot is None:
        snapshot = build_tax_compliance(
            store_ids=store_ids,
            tax_type_id=tax_type_id,
            state_id=state_id,
            state_ids=state_ids,
        )
        if use_cache:
            cache.set(key, snapshot, CACHE_TTL)
        from_cache = False

    return {
        "taxByState": snapshot["taxByState"],
        "exciseTax": snapshot.get("exciseTax"),
        "purchaseTax": snapshot.get("purchaseTax"),
        "stateCategories": snapshot.get("stateCategories"),
        "taxReport": snapshot.get("taxReport"),
        "summary": snapshot["summary"],
        "erpErrors": snapshot.get("erpErrors", {}),
        "cache": {
            "hit": from_cache,
            "cachedAt": snapshot.get("cachedAt"),
            "ttlDays": 7,
            "dateRange": snapshot.get("dateRange"),
        },
    }


def refresh_tax_compliance_cache(
    store_ids: str = "1,2",
    tax_type_id: int = 1,
    state_id: int = 10,
    state_ids: Optional[List[int]] = None,
) -> dict:
    """Pre-warm cache for scheduled weekend refresh."""
    state_ids = list(state_ids or DEFAULT_TAX_STATE_IDS)
    snapshot = build_tax_compliance(
        store_ids=store_ids,
        tax_type_id=tax_type_id,
        state_id=state_id,
        state_ids=state_ids,
    )
    cache.set(cache_key(store_ids, tax_type_id, state_id, state_ids), snapshot, CACHE_TTL)
    return {
        "storeIds": store_ids,
        "taxTypeId": tax_type_id,
        "stateId": state_id,
        "stateCount": snapshot["summary"]["stateCount"],
        "totalTaxCollected": snapshot["summary"]["totalTaxCollected"],
        "cachedAt": snapshot["cachedAt"],
    }
