"""Customer behavior analytics (modules 14–15)."""

from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from api.models import Customer

from supplychain.erp_client import erp_fetch_many, erp_put, safe_float, safe_int
from supplychain.views.base import SupplyChainBaseView


class RMAAnalysisView(SupplyChainBaseView):
    """RMA reason analysis."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        customer_id = self.get_int_param(request, "customerId")

        report_params = self.get_report_params(request)
        specs = [
            {"key": "returnOrders", "path": "/returnOrder/list", "params": {"storeIds": store_ids, "page": 0, "size": 100}},
            {"key": "lineSummary", "path": "/report/returns/lineItem/summary", "params": report_params},
            {"key": "byCustomer", "path": "/report/returns/byCustomer", "params": report_params},
        ]
        if customer_id:
            specs.append({"key": "rmaQty", "path": f"/inventory/customerRmaQuantity/{customer_id}", "params": {"storeIds": store_ids}})

        sources = erp_fetch_many(specs)
        line_summary = sources["lineSummary"].get("data") or []
        if isinstance(line_summary, dict):
            line_summary = line_summary.get("content") or line_summary.get("data") or []

        reasons = {}
        for row in line_summary if isinstance(line_summary, list) else []:
            reason = row.get("returnReason") or row.get("reason") or row.get("rmaReason") or "Unspecified"
            qty = safe_int(row.get("quantity") or row.get("returnQuantity"))
            amount = safe_float(row.get("amount") or row.get("returnAmount"))
            if reason not in reasons:
                reasons[reason] = {"reason": reason, "quantity": 0, "amount": 0, "count": 0}
            reasons[reason]["quantity"] += qty
            reasons[reason]["amount"] += amount
            reasons[reason]["count"] += 1

        reason_list = sorted(reasons.values(), key=lambda x: x["amount"], reverse=True)

        return self.ok({
            "reasonBreakdown": reason_list,
            "returnOrders": sources["returnOrders"].get("data"),
            "byCustomer": sources["byCustomer"].get("data"),
            "customerRmaQty": sources.get("rmaQty", {}).get("data"),
            "summary": {
                "totalReturnReasons": len(reason_list),
                "topReason": reason_list[0]["reason"] if reason_list else None,
                "totalReturnAmount": round(sum(r["amount"] for r in reason_list), 2),
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })


class CustomerChurnView(SupplyChainBaseView):
    """Customer churn risk analysis."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        inactive_days = self.get_int_param(request, "inactiveDays", 90)
        page = self.get_int_param(request, "page", 0)
        size = min(self.get_int_param(request, "size", 50), 200)

        cutoff = timezone.now() - timedelta(days=inactive_days)

        sources = erp_fetch_many([
            {"key": "neverOrdered", "path": "/report/customer/products/neverOrdered", "params": self.get_report_params(request)},
        ])

        local_at_risk = []
        customers = Customer.objects.filter(active=True).annotate(
            last_order=Max("invoice_set__insertedTimestamp"),
        )
        for c in customers[:500]:
            last = c.last_order
            if last is None or last < cutoff:
                days_inactive = (timezone.now() - last).days if last else None
                local_at_risk.append({
                    "customerId": c.id,
                    "customerName": c.company or c.dbaName or c.name,
                    "lastOrderDate": last.isoformat() if last else None,
                    "daysInactive": days_inactive,
                    "riskLevel": "critical" if days_inactive is None or days_inactive > 180 else "high" if days_inactive > 90 else "moderate",
                })

        local_at_risk.sort(key=lambda x: x.get("daysInactive") or 9999, reverse=True)

        return self.ok({
            "atRiskCustomers": local_at_risk[:size],
            "neverOrderedProducts": sources["neverOrdered"].get("data"),
            "summary": {
                "atRiskCount": len(local_at_risk),
                "criticalCount": len([c for c in local_at_risk if c["riskLevel"] == "critical"]),
                "inactiveDaysThreshold": inactive_days,
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })

    def post(self, request):
        """Proxy PUT /customer/list and PUT /order/list for filtered churn analysis."""
        store_ids = request.data.get("storeIds", "1,2")
        action = request.data.get("action", "customers")

        if action == "orders":
            body = request.data.get("filters", {})
            data, err = erp_put("/order/list", json_data=body, params={"storeIds": store_ids})
        else:
            body = request.data.get("filters", {})
            data, err = erp_put("/customer/list", json_data=body, params={"storeIds": store_ids})

        if err:
            return self.fail(err, erpPartial=data)
        return self.ok(data)
