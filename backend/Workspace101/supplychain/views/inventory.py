"""Inventory & warehousing analytics (modules 1–3)."""

from api.models import Product

from supplychain.erp_client import erp_fetch_many, safe_float, safe_int
from supplychain.views.base import SupplyChainBaseView


def _enrich_low_stock_rows(rows: list[dict]) -> list[dict]:
    """Fill product names/images from local sync when ERP low-stock rows only have sku/upc."""
    skus = {r["sku"] for r in rows if r.get("sku")}
    ids = {r["productId"] for r in rows if r.get("productId")}
    by_sku = {p.sku: p for p in Product.objects.filter(sku__in=skus)} if skus else {}
    by_id = {p.productId: p for p in Product.objects.filter(productId__in=ids)} if ids else {}

    for row in rows:
        product = by_id.get(row.get("productId")) or by_sku.get(row.get("sku"))
        if not product:
            continue
        row.setdefault("productName", product.productName)
        row.setdefault("productId", product.productId)
        row.setdefault("imageUrl", product.imageUrl)
    return rows


class DustyInventoryView(SupplyChainBaseView):
    """Slow-moving & obsolete inventory using local sync + ERP valuation enrichment."""

    def get(self, request):
        from supplychain.dusty_cache import get_dusty_inventory

        store_ids = self.get_store_ids(request)
        days_threshold = self.get_int_param(request, "daysThreshold", 90)
        page = self.get_int_param(request, "page", 1)
        page_size = min(self.get_int_param(request, "pageSize", 20), 500)
        sort_by = request.GET.get("sortBy", "daysSinceLastSale")
        reverse = request.GET.get("reverse", "true").lower() == "true"
        force_refresh = request.GET.get("refresh", "").lower() in ("1", "true", "yes")
        search = request.GET.get("search", "").strip()

        return self.ok(get_dusty_inventory(
            store_ids=store_ids,
            days_threshold=days_threshold,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            reverse=reverse,
            force_refresh=force_refresh,
            search=search,
        ))


class ShrinkageAuditView(SupplyChainBaseView):
    """Inventory shrinkage from adjustment list; use ?detail=true&productId= for per-product log/audit."""

    def get(self, request):
        product_id = self.get_int_param(request, "productId")
        if request.GET.get("detail", "").lower() in ("1", "true", "yes"):
            from supplychain.shrinkage_cache import get_product_detail

            if not product_id:
                return self.fail("productId is required for detail view", status=400)
            force_refresh = request.GET.get("refresh", "").lower() in ("1", "true", "yes")
            return self.ok(get_product_detail(
                store_ids=self.get_store_ids(request),
                product_id=product_id,
                force_refresh=force_refresh,
            ))

        store_ids = self.get_store_ids(request)
        page = self.get_int_param(request, "page", 0)
        size = min(self.get_int_param(request, "size", 50), 200)

        sources = erp_fetch_many([
            {"key": "adjustments", "path": "/inventory/adjustment/list", "params": {"storeIds": store_ids, "page": page, "size": size}, "timeout": 30},
        ])

        adjustments = sources["adjustments"].get("data") or []
        if isinstance(adjustments, dict):
            adjustments = adjustments.get("content") or adjustments.get("data") or []

        shrinkage_events = []
        total_variance = 0.0
        for row in adjustments if isinstance(adjustments, list) else []:
            reduced = safe_float(row.get("totalReducedQuantity"))
            added = safe_float(row.get("totalAddedQuantity"))
            qty = -reduced if reduced else added
            total_variance += abs(qty) if qty else abs(reduced) + abs(added)
            shrinkage_events.append({
                "id": row.get("id"),
                "productId": row.get("productId"),
                "productName": row.get("wareHouseName") or row.get("description") or row.get("createdByName") or "Adjustment",
                "quantity": qty,
                "reason": row.get("notes") or row.get("description") or "Inventory adjustment",
                "date": row.get("insertedTimestamp") or row.get("createdAt"),
                "type": "adjustment",
            })

        return self.ok({
            "shrinkageEvents": shrinkage_events[:100],
            "adjustments": adjustments if isinstance(adjustments, list) else [],
            "summary": {
                "totalVarianceUnits": round(total_variance, 2),
                "adjustmentCount": len(adjustments) if isinstance(adjustments, list) else 0,
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
            "productFilter": product_id,
        })


class ShrinkageProductDetailView(SupplyChainBaseView):
    """Per-product inventory log + audit trail, cached weekly with shorter ERP timeout."""

    def get(self, request):
        from supplychain.shrinkage_cache import get_product_detail

        store_ids = self.get_store_ids(request)
        product_id = self.get_int_param(request, "productId")
        if not product_id:
            return self.fail("productId is required", status=400)

        force_refresh = request.GET.get("refresh", "").lower() in ("1", "true", "yes")
        return self.ok(get_product_detail(
            store_ids=store_ids,
            product_id=product_id,
            force_refresh=force_refresh,
        ))


class DemandForecastView(SupplyChainBaseView):
    """Demand forecasting & stockout risk."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        product_id = self.get_int_param(request, "productId")
        search = request.GET.get("search", "").strip()
        from_warehouse_id = self.get_int_param(request, "fromWareHouseId")
        to_warehouse_id = self.get_int_param(request, "toWareHouseId")

        specs = [
            {"key": "lowStock", "path": "/report/inventory/lowStockReportDetails", "params": self.get_report_params(request), "timeout": 45},
        ]
        if search and from_warehouse_id:
            transfer_params = {
                "storeIds": store_ids,
                "search": search,
                "fromWareHouseId": from_warehouse_id,
            }
            if to_warehouse_id:
                transfer_params["toWareHouseId"] = to_warehouse_id
            specs.append({
                "key": "transferSearch",
                "path": "/product/searchForTransferOrder",
                "params": transfer_params,
                "timeout": 25,
            })
        if product_id:
            specs.extend([
                {"key": "committed", "path": f"/inventory/committedQuantity/{product_id}", "params": {"storeIds": store_ids}},
                {"key": "incomingPO", "path": f"/inventory/incomingFromPO/{product_id}", "params": {"storeIds": store_ids}},
            ])

        sources = erp_fetch_many(specs)
        low_stock = sources["lowStock"].get("data") or []
        if isinstance(low_stock, dict):
            low_stock = low_stock.get("content") or low_stock.get("data") or low_stock.get("result") or []

        at_risk = []
        for row in low_stock if isinstance(low_stock, list) else []:
            pid = row.get("productId") or row.get("id")
            on_hand = safe_float(row.get("availableQuantity") or row.get("onHand") or row.get("currentStock"))
            reorder = safe_float(row.get("reorderPoint") or row.get("minQuantity") or row.get("reorderQuantity"))
            committed = safe_float(row.get("committedQuantity"))
            incoming = safe_float(row.get("incomingQuantity") or row.get("poQuantity") or row.get("expectedQuantity"))
            net_available = on_hand - committed + incoming
            days_cover = None
            avg_daily = safe_float(row.get("avgDailySales") or row.get("averageDailySale"))
            if avg_daily > 0:
                days_cover = round(net_available / avg_daily, 1)
            risk = "critical" if net_available <= 0 else "high" if days_cover is not None and days_cover < 7 else "moderate" if days_cover is not None and days_cover < 14 else "low"
            at_risk.append({
                "productId": pid,
                "productName": row.get("productName") or row.get("name"),
                "sku": row.get("sku"),
                "upc": row.get("upc"),
                "categoryName": row.get("categoryName"),
                "onHand": on_hand,
                "committed": committed,
                "incoming": incoming,
                "netAvailable": round(net_available, 2),
                "reorderPoint": reorder,
                "daysOfCover": days_cover,
                "stockoutRisk": risk,
            })

        at_risk = _enrich_low_stock_rows(at_risk)
        for row in at_risk:
            if not row.get("productName"):
                row["productName"] = row.get("sku") or row.get("upc") or f"Product #{row.get('productId') or '?'}"

        at_risk.sort(key=lambda x: ({"critical": 0, "high": 1, "moderate": 2, "low": 3}.get(x["stockoutRisk"], 4), x.get("daysOfCover") or 999))

        return self.ok({
            "atRiskProducts": at_risk,
            "productDetail": {
                "committed": sources.get("committed", {}).get("data"),
                "incomingPO": sources.get("incomingPO", {}).get("data"),
            } if product_id else None,
            "transferCandidates": sources.get("transferSearch", {}).get("data"),
            "summary": {
                "totalAtRisk": len([r for r in at_risk if r["stockoutRisk"] in ("critical", "high")]),
                "criticalCount": len([r for r in at_risk if r["stockoutRisk"] == "critical"]),
                "moderateCount": len([r for r in at_risk if r["stockoutRisk"] == "moderate"]),
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })
