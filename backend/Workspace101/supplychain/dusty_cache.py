"""Weekly cache for dusty inventory — full dataset computed once, paginated from memory."""

from datetime import timedelta

from django.core.cache import cache
from django.db.models import DateTimeField, ExpressionWrapper, F, Max, OuterRef, Q, Subquery, Sum, Value
from django.db.models.fields import DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone

from api.models import InvoiceLineItem, Product, PurchaseHistory

from supplychain.erp_client import erp_fetch_many, safe_float, safe_int

CACHE_PREFIX = "supplychain:dusty_inventory"
CACHE_TTL = 7 * 24 * 60 * 60  # refresh weekly

SORT_FIELDS = {
    "inventoryCost": "inventoryCost",
    "retailValue": "retailValue",
    "quantity": "availableQuantity",
    "productName": "productName",
    "daysSinceLastSale": "daysSinceLastSale",
}


def cache_key(store_ids: str, days_threshold: int) -> str:
    return f"{CACHE_PREFIX}:{store_ids}:{days_threshold}"


def build_dusty_inventory(store_ids: str, days_threshold: int) -> dict:
    """Run the heavy DB + ERP work once and return the full snapshot."""
    cutoff = timezone.now().date() - timedelta(days=days_threshold)
    last_sale_subq = (
        InvoiceLineItem.objects.filter(deleted=False, productId=OuterRef("pk"))
        .values("productId")
        .annotate(m=Max("insertedTimestamp"))
        .values("m")[:1]
    )
    last_received_subq = (
        PurchaseHistory.objects.filter(productId=OuterRef("pk"))
        .values("productId")
        .annotate(m=Max("purchaseOrderInsertedTimestamp"))
        .values("m")[:1]
    )

    qs = (
        Product.objects.filter(active=True, availableQuantity__gt=0)
        .annotate(
            last_sale_date=Subquery(last_sale_subq, output_field=DateTimeField()),
            last_received_date=Subquery(last_received_subq, output_field=DateTimeField()),
        )
        .filter(Q(last_sale_date__isnull=True) | Q(last_sale_date__date__lt=cutoff))
        .annotate(
            inventory_cost=ExpressionWrapper(
                Coalesce(F("availableQuantity"), Value(0)) * Coalesce(F("costPrice"), Value(0)),
                output_field=DecimalField(max_digits=20, decimal_places=2),
            ),
            retail_value=ExpressionWrapper(
                Coalesce(F("availableQuantity"), Value(0)) * Coalesce(F("standardPrice"), Value(0)),
                output_field=DecimalField(max_digits=20, decimal_places=2),
            ),
        )
    )

    totals = qs.aggregate(
        total_qty=Sum("availableQuantity"),
        total_cost=Sum("inventory_cost"),
        total_retail=Sum("retail_value"),
    )

    report_params = {"storeIds": store_ids, "startDate": "2015-01-01+04:00:00", "endDate": timezone.now().strftime("%Y-%m-%d+%H:%M:%S")}
    erp_sources = erp_fetch_many([
        {"key": "valuation", "path": "/report/inventory/valuation", "params": report_params},
    ])

    items = []
    today = timezone.now().date()
    for product in qs.iterator(chunk_size=500):
        last_sale = product.last_sale_date
        days_since = (today - last_sale.date()).days if last_sale else None
        items.append({
            "productId": product.productId,
            "productName": product.productName,
            "sku": product.sku,
            "upc": product.upc,
            "availableQuantity": product.availableQuantity,
            "costPrice": float(product.costPrice or 0),
            "standardPrice": float(product.standardPrice or 0),
            "inventoryCost": float(product.inventory_cost or 0),
            "retailValue": float(product.retail_value or 0),
            "lastSaleDate": last_sale.isoformat() if last_sale else None,
            "daysSinceLastSale": days_since,
            "lastReceivedDate": product.last_received_date.isoformat() if product.last_received_date else None,
            "imageUrl": product.imageUrl,
            "riskLevel": "critical" if days_since is None or days_since > 180 else "high" if days_since > 90 else "moderate",
        })

    return {
        "cachedAt": timezone.now().isoformat(),
        "storeIds": store_ids,
        "daysThreshold": days_threshold,
        "items": items,
        "summary": {
            "dustySkuCount": len(items),
            "totalQuantity": safe_int(totals.get("total_qty")),
            "totalInventoryCost": safe_float(totals.get("total_cost")),
            "totalRetailValue": safe_float(totals.get("total_retail")),
            "daysThreshold": days_threshold,
        },
        "erpValuation": erp_sources.get("valuation", {}),
        "erpErrors": {k: v["error"] for k, v in erp_sources.items() if v.get("error")},
    }


def sort_items(items: list, sort_by: str, reverse: bool) -> list:
    field = SORT_FIELDS.get(sort_by, "daysSinceLastSale")

    def key(row):
        val = row.get(field)
        if field == "daysSinceLastSale" and val is None:
            return float("inf") if reverse else -1
        if val is None:
            return ""
        return val

    return sorted(items, key=key, reverse=reverse)


def filter_items(items: list, search: str) -> list:
    query = (search or "").strip().lower()
    if not query:
        return items

    def matches(row):
        for field in ("productName", "sku", "upc"):
            val = row.get(field)
            if val and query in str(val).lower():
                return True
        return query in str(row.get("productId", "")).lower()

    return [row for row in items if matches(row)]


def summarize_items(items: list, days_threshold: int) -> dict:
    return {
        "dustySkuCount": len(items),
        "totalQuantity": sum(safe_int(r.get("availableQuantity")) for r in items),
        "totalInventoryCost": round(sum(safe_float(r.get("inventoryCost")) for r in items), 2),
        "totalRetailValue": round(sum(safe_float(r.get("retailValue")) for r in items), 2),
        "daysThreshold": days_threshold,
    }


def paginate_items(items: list, page: int, page_size: int) -> tuple[list, dict]:
    total = len(items)
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    page = max(1, min(page, total_pages))
    start = (page - 1) * page_size
    return items[start : start + page_size], {
        "page": page,
        "pageSize": page_size,
        "totalItems": total,
        "totalPages": total_pages,
    }


def get_dusty_inventory(
    *,
    store_ids: str,
    days_threshold: int,
    page: int,
    page_size: int,
    sort_by: str,
    reverse: bool,
    force_refresh: bool = False,
    search: str = "",
) -> dict:
    key = cache_key(store_ids, days_threshold)
    snapshot = None if force_refresh else cache.get(key)
    from_cache = snapshot is not None

    if snapshot is None:
        snapshot = build_dusty_inventory(store_ids, days_threshold)
        cache.set(key, snapshot, CACHE_TTL)
        from_cache = False

    filtered_items = filter_items(list(snapshot["items"]), search)
    sorted_items = sort_items(filtered_items, sort_by, reverse)
    page_items, pagination = paginate_items(sorted_items, page, page_size)
    summary = summarize_items(filtered_items, days_threshold) if search.strip() else snapshot["summary"]

    return {
        "items": page_items,
        "pagination": pagination,
        "summary": summary,
        "erpValuation": snapshot.get("erpValuation"),
        "erpErrors": snapshot.get("erpErrors", {}),
        "cache": {
            "hit": from_cache,
            "cachedAt": snapshot.get("cachedAt"),
            "ttlDays": 7,
        },
    }


def refresh_dusty_inventory_cache(store_ids: str = "1,2", days_thresholds: list[int] | None = None) -> list[dict]:
    """Pre-warm cache for scheduled weekend refresh."""
    thresholds = days_thresholds or [60, 90, 120, 180]
    results = []
    for days in thresholds:
        snapshot = build_dusty_inventory(store_ids, days)
        cache.set(cache_key(store_ids, days), snapshot, CACHE_TTL)
        results.append({
            "storeIds": store_ids,
            "daysThreshold": days,
            "itemCount": len(snapshot["items"]),
            "cachedAt": snapshot["cachedAt"],
        })
    return results
