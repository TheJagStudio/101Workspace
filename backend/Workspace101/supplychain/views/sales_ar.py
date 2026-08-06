"""Sales operations & AR analytics (modules 6–8)."""

from django.db.models import Count

from api.models import Customer, Product
from supplychain.erp_client import erp_fetch_many, safe_float, safe_int
from supplychain.views.base import SupplyChainBaseView


class QuotationPipelineView(SupplyChainBaseView):
    """Quotation pipeline velocity."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        quotation_id = self.get_int_param(request, "quotationId")
        report_type = request.GET.get("reportType", "ALL")

        report_params = self.get_report_params(request, reportType=report_type)
        specs = [
            {"key": "lostSales", "path": "/report/sales/lostSalesReportByReportType", "params": report_params},
        ]
        if quotation_id:
            specs.append({"key": "quotation", "path": f"/quotation/{quotation_id}/withCustomer", "params": {"storeIds": store_ids}})

        sources = erp_fetch_many(specs)
        lost = sources["lostSales"].get("data") or []
        if isinstance(lost, dict):
            lost = lost.get("content") or lost.get("data") or []

        pipeline = []
        total_lost = 0.0
        for row in lost if isinstance(lost, list) else []:
            amount = safe_float(row.get("lostAmount") or row.get("amount") or row.get("totalAmount"))
            total_lost += amount
            created = row.get("createdAt") or row.get("insertedTimestamp")
            converted = row.get("convertedAt") or row.get("orderDate")
            days_open = safe_int(row.get("daysOpen") or row.get("ageInDays"))
            pipeline.append({
                "quotationId": row.get("quotationId") or row.get("id"),
                "customerName": row.get("customerName") or row.get("company"),
                "salesRep": row.get("salesRep") or row.get("salesRepresentativeName"),
                "amount": amount,
                "status": row.get("status") or row.get("quotationStatus"),
                "createdAt": created,
                "convertedAt": converted,
                "daysOpen": days_open,
                "velocity": "fast" if days_open and days_open <= 3 else "normal" if days_open and days_open <= 7 else "slow",
            })

        pipeline.sort(key=lambda x: x.get("daysOpen") or 0, reverse=True)

        return self.ok({
            "pipeline": pipeline,
            "quotationDetail": sources.get("quotation", {}).get("data"),
            "summary": {
                "openQuotations": len(pipeline),
                "totalPipelineValue": round(total_lost, 2),
                "slowMoving": len([p for p in pipeline if p["velocity"] == "slow"]),
                "avgDaysOpen": round(sum(p.get("daysOpen") or 0 for p in pipeline) / len(pipeline), 1) if pipeline else 0,
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })


class MarginPricingView(SupplyChainBaseView):
    """Margin leakage & customer tier pricing diagnostics."""

    DEFAULT_TARGET_MARGIN = 25.0

    def _target_margin(self, request):
        return self.get_float_param(request, "targetMargin", self.DEFAULT_TARGET_MARGIN)

    def _margin_threshold(self, request):
        # ERP report filter: products with profit margin less than this value.
        return self.get_float_param(request, "marginThreshold", 100)

    def _local_customer_tiers(self):
        rows = (
            Customer.objects.filter(active=True)
            .exclude(tier__isnull=True)
            .exclude(tier="")
            .values("tier")
            .annotate(customerCount=Count("id"))
            .order_by("-customerCount")
        )
        return [{"tier": row["tier"], "customerCount": row["customerCount"]} for row in rows]

    def _enrich_margin_rows(self, rows):
        ids = {safe_int(row.get("productId") or row.get("id")) for row in rows if isinstance(row, dict)}
        ids.discard(0)
        by_id = {
            p.productId: p
            for p in Product.objects.filter(productId__in=ids).only("productId", "productName", "sku")
        } if ids else {}

        for row in rows:
            if not isinstance(row, dict):
                continue
            product = by_id.get(safe_int(row.get("productId") or row.get("id")))
            if product and not row.get("productName"):
                row["productName"] = product.productName
            if product and not row.get("productId"):
                row["productId"] = product.productId
        return rows

    def _build_leakage_from_rows(self, rows, target_margin):
        leakage = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            expected = safe_float(
                row.get("expectedMargin") or row.get("targetMarginPercent"),
                default=target_margin,
            )
            actual = safe_float(
                row.get("profitMargin")
                or row.get("marginPercent")
                or row.get("grossMarginPercent")
                or row.get("grossMarginPercentage")
            )
            if actual <= 0:
                continue
            gap = expected - actual
            if gap <= 2:
                continue
            revenue = safe_float(
                row.get("revenue")
                or row.get("salesAmount")
                or row.get("totalSales")
                or row.get("totalAmount")
                or row.get("totalSaleAmount")
            )
            leakage.append({
                "productId": row.get("productId") or row.get("id"),
                "productName": row.get("productName") or row.get("name") or row.get("sku"),
                "expectedMargin": expected,
                "actualMargin": actual,
                "marginGap": round(gap, 2),
                "revenue": revenue,
                "leakageAmount": round(revenue * gap / 100, 2),
                "severity": "critical" if gap > 10 else "high" if gap > 5 else "moderate",
            })
        leakage.sort(key=lambda x: x["leakageAmount"], reverse=True)
        return leakage

    def _build_leakage_from_local(self, target_margin, limit=200):
        products = (
            Product.objects.filter(active=True, TotalGrossMarginPrecentage__isnull=False)
            .exclude(TotalSaleAmount__isnull=True)
            .order_by("TotalGrossMarginPrecentage")[:500]
        )
        rows = [{
            "productId": p.productId,
            "productName": p.productName,
            "profitMargin": safe_float(p.TotalGrossMarginPrecentage),
            "revenue": safe_float(p.TotalSaleAmount or p.TotalRevenue),
            "expectedMargin": target_margin,
        } for p in products]
        return self._build_leakage_from_rows(rows, target_margin)[:limit]

    def get(self, request):
        store_ids = self.get_store_ids(request)
        customer_id = self.get_int_param(request, "customerId")
        order_id = self.get_int_param(request, "orderId")
        target_margin = self._target_margin(request)
        report_params = self.get_report_params(
            request,
            profitMargin=self._margin_threshold(request),
        )

        specs = [
            {
                "key": "profitMargin",
                "path": "/report/sales/product/profitMargin",
                "params": report_params,
                "referer": "/report/sales/product/profitMargin",
            },
        ]
        if customer_id:
            specs.append({"key": "priceMap", "path": f"/customer/productPriceMap/customerId/{customer_id}", "params": {"storeIds": store_ids}})
        if order_id:
            specs.append({"key": "orderProfit", "path": f"/order/profitDetailOnOrderAndLineItem/{order_id}", "params": {"storeIds": store_ids}})

        sources = erp_fetch_many(specs)
        margin_rows = self.normalize_erp_list(
            sources["profitMargin"].get("data"),
            "productProfitMarginReportDtoList",
            "productProfitMarginDtoList",
            "profitMarginReportDtoList",
        )
        margin_rows = self._enrich_margin_rows(margin_rows)
        leakage = self._build_leakage_from_rows(margin_rows, target_margin)

        erp_errors = {k: v["error"] for k, v in sources.items() if v.get("error")}
        if not leakage:
            local_leakage = self._build_leakage_from_local(target_margin)
            if local_leakage:
                leakage = local_leakage
                erp_errors.pop("profitMargin", None)

        total_leakage = sum(l["leakageAmount"] for l in leakage)

        return self.ok({
            "customerTiers": self._local_customer_tiers(),
            "priceMap": sources.get("priceMap", {}).get("data"),
            "orderProfit": sources.get("orderProfit", {}).get("data"),
            "marginLeakage": leakage,
            "summary": {
                "productsWithLeakage": len(leakage),
                "estimatedLeakage": round(total_leakage, 2),
                "avgMarginGap": round(sum(l["marginGap"] for l in leakage) / len(leakage), 2) if leakage else 0,
            },
            "erpErrors": erp_errors,
        })


class ARRiskView(SupplyChainBaseView):
    """AR risk & credit exposure."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        customer_id = self.get_int_param(request, "customerId")
        report_params = self.get_report_params(
            request,
            agingPeriod=30,
            noOfPeriod=5,
            size=500,
        )

        specs = [
            {"key": "aging", "path": "/report/customer/dueBalance/byAging", "params": report_params},
        ]
        if customer_id:
            specs.extend([
                {"key": "storeCredit", "path": f"/customer/storeCredit/list/{customer_id}", "params": {"storeIds": store_ids}},
                {
                    "key": "accountSummary",
                    "path": "/customer/accountSummary",
                    "params": {"storeIds": store_ids, "customerIds": str(customer_id)},
                },
            ])

        sources = erp_fetch_many(specs)
        aging_raw = sources["aging"].get("data") or {}
        aging_rows = self.normalize_erp_list(aging_raw, "customerDueAmountReportDtoList")

        customer_names = {}
        customer_ids = [safe_int(r.get("customerId") or r.get("id")) for r in aging_rows if isinstance(r, dict)]
        if customer_ids:
            for c in Customer.objects.filter(id__in=customer_ids).only("id", "name", "company"):
                customer_names[c.id] = c.name or c.company

        buckets = {"current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        customers = []

        for row in aging_rows:
            if not isinstance(row, dict):
                continue
            cid = row.get("customerId") or row.get("id")
            if customer_id and safe_int(cid) != customer_id:
                continue
            amounts = self.parse_due_aging_row(row)
            current = amounts["current"]
            d30 = amounts["days1To30"]
            d60 = amounts["days31To60"]
            d90 = amounts["days61To90"]
            over90 = amounts["over90"]
            total = amounts["totalDue"]
            credit_limit = safe_float(row.get("creditLimit"), default=0)
            exposure_ratio = round(total / credit_limit * 100, 1) if credit_limit else None
            buckets["current"] += current
            buckets["1-30"] += d30
            buckets["31-60"] += d60
            buckets["61-90"] += d90
            buckets["90+"] += over90
            customers.append({
                "customerId": cid,
                "customerName": (
                    row.get("customerName")
                    or row.get("company")
                    or row.get("dba")
                    or customer_names.get(safe_int(cid))
                ),
                "current": current,
                "days1To30": d30,
                "days31To60": d60,
                "days61To90": d90,
                "over90": over90,
                "totalDue": total,
                "creditLimit": credit_limit,
                "exposureRatio": exposure_ratio,
                "riskLevel": "critical" if over90 > 0 and over90 >= total * 0.4 else "high" if total > credit_limit > 0 else "moderate" if d60 + d90 + over90 > total * 0.3 else "low",
            })

        customers.sort(key=lambda x: x["totalDue"], reverse=True)
        total_dto = aging_raw.get("totalCustomerDueAmountReportDto") or {} if isinstance(aging_raw, dict) else {}
        total_ar = safe_float(total_dto.get("totalDueAmount")) or sum(buckets.values())

        return self.ok({
            "agingBuckets": buckets,
            "customers": customers,
            "customerDetail": {
                "storeCredit": sources.get("storeCredit", {}).get("data"),
            } if customer_id else None,
            "accountSummary": sources.get("accountSummary", {}).get("data"),
            "summary": {
                "totalAR": round(total_ar, 2),
                "customerCount": len(customers),
                "highRiskCount": len([c for c in customers if c["riskLevel"] in ("critical", "high")]),
                "over90Percent": round(buckets["90+"] / total_ar * 100, 1) if total_ar else 0,
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })
