"""Dashboard summary aggregating key supply chain KPIs."""

from supplychain.erp_client import erp_fetch_many, safe_float
from supplychain.views.base import SupplyChainBaseView


class DashboardView(SupplyChainBaseView):
    """Landing dashboard with high-level KPIs from key ERP reports."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        report_params = self.get_report_params(request)

        sources = erp_fetch_many([
            {"key": "inventoryValuation", "path": "/report/inventory/valuation", "params": report_params},
            {"key": "vendorAging", "path": "/report/vendor/dueBalance/byAging", "params": report_params},
            {"key": "customerAging", "path": "/report/customer/dueBalance/byAging", "params": report_params},
            {"key": "lowStock", "path": "/report/inventory/lowStockReportDetails", "params": report_params},
        ])

        valuation = sources["inventoryValuation"].get("data") or {}
        inv_value = safe_float(
            valuation.get("totalRetailValue") or valuation.get("retailValue") or valuation.get("totalValue")
            if isinstance(valuation, dict) else 0
        )

        def _total_due(data, total_key):
            if isinstance(data, dict):
                total_dto = data.get(total_key) or {}
                if isinstance(total_dto, dict) and total_dto.get("totalDueAmount") is not None:
                    return safe_float(total_dto.get("totalDueAmount"))
            rows = self.normalize_erp_list(
                data,
                "vendorDueAmountReportDtoList" if "vendor" in total_key.lower() else "customerDueAmountReportDtoList",
            )
            return sum(
                safe_float(row.get("totalDueAmount") or row.get("netDueAmount") or row.get("dueBalance"))
                for row in rows
                if isinstance(row, dict)
            )

        ap_total = _total_due(sources["vendorAging"].get("data"), "totalVendorDueAmountReportDto")
        ar_total = _total_due(sources["customerAging"].get("data"), "totalCustomerDueAmountReportDto")

        low_stock = sources["lowStock"].get("data") or []
        if isinstance(low_stock, dict):
            low_stock = low_stock.get("content") or low_stock.get("data") or []
        stockout_count = len(low_stock) if isinstance(low_stock, list) else 0

        modules = [
            {"id": "dusty-inventory", "name": "Dusty Inventory", "category": "Inventory", "phase": 1, "path": "/supply-chain/dusty-inventory"},
            {"id": "shrinkage-audit", "name": "Shrinkage & Audit", "category": "Inventory", "phase": 3, "path": "/supply-chain/shrinkage-audit"},
            {"id": "demand-forecast", "name": "Demand Forecast", "category": "Inventory", "phase": 3, "path": "/supply-chain/demand-forecast"},
            {"id": "vendor-scorecard", "name": "Vendor Scorecard", "category": "Procurement", "phase": 2, "path": "/supply-chain/vendor-scorecard"},
            {"id": "ap-aging", "name": "AP Cash-Flow Aging", "category": "Procurement", "phase": 1, "path": "/supply-chain/ap-aging"},
            {"id": "quotation-pipeline", "name": "Quotation Pipeline", "category": "Sales", "phase": 3, "path": "/supply-chain/quotation-pipeline"},
            {"id": "margin-pricing", "name": "Margin & Pricing", "category": "Sales", "phase": 2, "path": "/supply-chain/margin-pricing"},
            {"id": "ar-risk", "name": "AR Risk Control", "category": "Sales", "phase": 1, "path": "/supply-chain/ar-risk"},
            {"id": "financial-pl", "name": "Segmented P&L", "category": "Financial", "phase": 3, "path": "/supply-chain/financial-pl"},
            {"id": "tax-compliance", "name": "Tax Compliance", "category": "Financial", "phase": 3, "path": "/supply-chain/tax-compliance"},
            {"id": "sales-rep-roi", "name": "Sales Rep ROI", "category": "Workforce", "phase": 3, "path": "/supply-chain/sales-rep-roi"},
            {"id": "labor-allocation", "name": "Labor Allocation", "category": "Workforce", "phase": 3, "path": "/supply-chain/labor-allocation"},
            {"id": "edit-friction", "name": "Edit Friction", "category": "Workforce", "phase": 3, "path": "/supply-chain/edit-friction"},
            {"id": "rma-analysis", "name": "RMA Analysis", "category": "Customer", "phase": 2, "path": "/supply-chain/rma-analysis"},
            {"id": "customer-churn", "name": "Customer Churn", "category": "Customer", "phase": 3, "path": "/supply-chain/customer-churn"},
        ]

        return self.ok({
            "kpis": {
                "inventoryRetailValue": inv_value,
                "totalAP": round(ap_total, 2),
                "totalAR": round(ar_total, 2),
                "lowStockSkus": stockout_count,
            },
            "modules": modules,
            "phase1Modules": [m for m in modules if m["phase"] == 1],
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })
