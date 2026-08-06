"""Supply chain & procurement analytics (modules 4–5)."""

from api.models import Vendor
from supplychain.erp_client import erp_fetch_many, erp_get, safe_float, safe_int
from supplychain.views.base import SupplyChainBaseView


class VendorScorecardView(SupplyChainBaseView):
    """Vendor performance scorecard."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        vendor_id = self.get_int_param(request, "vendorId")
        product_id = self.get_int_param(request, "productId")
        po_id = self.get_int_param(request, "poId")
        report_params = self.get_report_params(request)

        specs = [
            {"key": "byVendor", "path": "/report/purchase/byVendor", "params": report_params, "timeout": 45},
        ]
        if po_id:
            specs.append({"key": "purchaseOrder", "path": f"/purchaseOrder/{po_id}", "params": {"storeIds": store_ids}})
        if product_id:
            specs.extend([
                {"key": "incomingPO", "path": f"/inventory/incomingFromPO/{product_id}", "params": {"storeIds": store_ids}},
                {"key": "recentCost", "path": f"/inventory/recentCostPrice/{product_id}", "params": {"storeIds": store_ids}},
            ])
        if vendor_id:
            specs.append({"key": "vendorPO", "path": f"/purchaseOrder/{vendor_id}", "params": {"storeIds": store_ids}})

        sources = erp_fetch_many(specs)
        by_vendor = self.normalize_erp_list(
            sources["byVendor"].get("data"),
            "purchaseByVendorDtoList",
        )

        scorecards = []
        for row in by_vendor:
            vid = row.get("vendorId") or row.get("id")
            if vendor_id and safe_int(vid) != vendor_id:
                continue
            total_spend = safe_float(
                row.get("totalAmount") or row.get("purchaseAmount") or row.get("totalPurchaseAmount") or row.get("amount")
            )
            order_count = safe_int(row.get("orderCount") or row.get("totalOrders") or row.get("poCount") or row.get("count"))
            on_time = safe_float(row.get("onTimeDeliveryRate") or row.get("onTimePercent"), default=85.0)
            quality = safe_float(row.get("qualityScore"), default=90.0)
            avg_lead = safe_float(row.get("avgLeadTimeDays") or row.get("leadTime"), default=14.0)
            composite = round((on_time * 0.4 + quality * 0.35 + min(100, 100 - avg_lead) * 0.25), 1)
            grade = "A" if composite >= 90 else "B" if composite >= 80 else "C" if composite >= 70 else "D"
            scorecards.append({
                "vendorId": vid,
                "vendorName": row.get("vendorName") or row.get("name"),
                "totalSpend": total_spend,
                "orderCount": order_count,
                "onTimeRate": on_time,
                "qualityScore": quality,
                "avgLeadTimeDays": avg_lead,
                "compositeScore": composite,
                "grade": grade,
            })

        scorecards.sort(key=lambda x: x["compositeScore"], reverse=True)

        return self.ok({
            "scorecards": scorecards,
            "purchaseOrder": sources.get("purchaseOrder", {}).get("data"),
            "recentCost": sources.get("recentCost", {}).get("data"),
            "incomingPO": sources.get("incomingPO", {}).get("data"),
            "summary": {
                "vendorCount": len(scorecards),
                "avgScore": round(sum(s["compositeScore"] for s in scorecards) / len(scorecards), 1) if scorecards else 0,
                "topVendor": scorecards[0]["vendorName"] if scorecards else None,
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })


class APAgingView(SupplyChainBaseView):
    """AP cash-flow & aging analysis."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        vendor_id = self.get_int_param(request, "vendorId")
        report_params = self.get_report_params(
            request,
            agingPeriod=30,
            noOfPeriod=5,
            size=500,
        )

        specs = [
            {"key": "aging", "path": "/report/vendor/dueBalance/byAging", "params": report_params},
        ]
        if vendor_id:
            specs.extend([
                {"key": "negativeBalance", "path": f"/bill/negativeBalance/vendorId/{vendor_id}", "params": {"storeIds": store_ids}},
                {"key": "accountSummary", "path": f"/vendor/{vendor_id}/accountSummary", "params": {"storeIds": store_ids}},
            ])

        sources = erp_fetch_many(specs)
        aging_raw = sources["aging"].get("data") or {}
        aging_rows = self.normalize_erp_list(aging_raw, "vendorDueAmountReportDtoList")

        vendor_names = {}
        vendor_ids = [safe_int(r.get("vendorId") or r.get("id")) for r in aging_rows if isinstance(r, dict)]
        if vendor_ids:
            for v in Vendor.objects.filter(id__in=vendor_ids).only("id", "name", "company", "dbaName"):
                vendor_names[v.id] = v.name or v.company or v.dbaName

        buckets = {"current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        vendors = []

        for row in aging_rows:
            if not isinstance(row, dict):
                continue
            vid = row.get("vendorId") or row.get("id")
            if vendor_id and safe_int(vid) != vendor_id:
                continue
            amounts = self.parse_due_aging_row(row)
            current = amounts["current"]
            d30 = amounts["days1To30"]
            d60 = amounts["days31To60"]
            d90 = amounts["days61To90"]
            over90 = amounts["over90"]
            total = amounts["totalDue"]
            buckets["current"] += current
            buckets["1-30"] += d30
            buckets["31-60"] += d60
            buckets["61-90"] += d90
            buckets["90+"] += over90
            vendors.append({
                "vendorId": vid,
                "vendorName": (
                    row.get("vendorName")
                    or row.get("company")
                    or row.get("dbaName")
                    or row.get("name")
                    or vendor_names.get(safe_int(vid))
                ),
                "current": current,
                "days1To30": d30,
                "days31To60": d60,
                "days61To90": d90,
                "over90": over90,
                "totalDue": total,
                "riskLevel": "critical" if over90 > total * 0.5 else "high" if d90 + over90 > total * 0.3 else "moderate",
            })

        vendors.sort(key=lambda x: x["totalDue"], reverse=True)
        total_dto = aging_raw.get("totalVendorDueAmountReportDto") or {} if isinstance(aging_raw, dict) else {}
        total_ap = safe_float(total_dto.get("totalDueAmount")) or sum(buckets.values())

        return self.ok({
            "agingBuckets": buckets,
            "vendors": vendors,
            "vendorDetail": {
                "negativeBalance": sources.get("negativeBalance", {}).get("data"),
                "accountSummary": sources.get("accountSummary", {}).get("data"),
            } if vendor_id else None,
            "summary": {
                "totalAP": round(total_ap, 2),
                "vendorCount": len(vendors),
                "over90Percent": round(buckets["90+"] / total_ap * 100, 1) if total_ap else 0,
                "criticalVendors": len([v for v in vendors if v["riskLevel"] == "critical"]),
            },
            "cashFlowOutlook": {
                "dueNext30Days": round(buckets["current"] + buckets["1-30"], 2),
                "dueNext60Days": round(buckets["31-60"], 2),
                "dueBeyond90Days": round(buckets["90+"], 2),
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })
