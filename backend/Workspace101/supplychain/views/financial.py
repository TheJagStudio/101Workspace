"""Financial integrity analytics (modules 9–10)."""

from django.db.models import Sum

from api.models import Product
from supplychain.erp_client import erp_get, safe_float, safe_int
from supplychain.tax_compliance_cache import DEFAULT_TAX_STATE_IDS, get_tax_compliance
from supplychain.views.base import SupplyChainBaseView


class FinancialPLView(SupplyChainBaseView):
    """Segmented P&L and balance sheet."""

    PNL_SKIP_ACCOUNTS = {
        "Total Operating Income",
        "Total Cost Of Goods Sold",
        "Total Operating Expense",
        "Gross Profit",
        "Net Profit",
    }

    def _pnl_sections(self, pnl_data):
        if isinstance(pnl_data, list) and pnl_data:
            return pnl_data[0] if isinstance(pnl_data[0], dict) else {}
        if isinstance(pnl_data, dict):
            return pnl_data
        return {}

    def _pnl_account_amount(self, sections, section_name, account_name):
        for row in sections.get(section_name) or []:
            if isinstance(row, dict) and row.get("ACCOUNT") == account_name:
                return safe_float(row.get("AMOUNT"))
        return 0.0

    def _build_segments(self, pnl_data):
        sections = self._pnl_sections(pnl_data)
        if not sections:
            return []

        revenue = self._pnl_account_amount(sections, "Operating Income", "Sales Amount")
        if not revenue:
            revenue = self._pnl_account_amount(sections, "Operating Income", "Total Operating Income")
        cogs = self._pnl_account_amount(sections, "Cost of Good Sold", "Total Cost Of Goods Sold")
        gross = self._pnl_account_amount(sections, "Cost of Good Sold", "Gross Profit") or (revenue - cogs)
        expenses = self._pnl_account_amount(sections, "Operating Expense", "Total Operating Expense")
        net = self._pnl_account_amount(sections, "Operating Expense", "Net Profit") or (gross - expenses)

        return [
            {"segment": "Revenue", "amount": revenue, "percent": 100 if revenue else 0},
            {"segment": "COGS", "amount": cogs, "percent": round(cogs / revenue * 100, 1) if revenue else 0},
            {"segment": "Gross Profit", "amount": gross, "percent": round(gross / revenue * 100, 1) if revenue else 0},
            {"segment": "Operating Expenses", "amount": expenses, "percent": round(expenses / revenue * 100, 1) if revenue else 0},
            {"segment": "Net Profit", "amount": net, "percent": round(net / revenue * 100, 1) if revenue else 0},
        ]

    def _build_segments_from_local(self):
        totals = Product.objects.filter(active=True).aggregate(
            revenue=Sum("TotalSaleAmount"),
            gross=Sum("TotalGrossMargin"),
        )
        revenue = safe_float(totals["revenue"])
        gross = safe_float(totals["gross"])
        cogs = max(revenue - gross, 0)
        net = gross
        return [
            {"segment": "Revenue", "amount": revenue, "percent": 100 if revenue else 0},
            {"segment": "COGS", "amount": cogs, "percent": round(cogs / revenue * 100, 1) if revenue else 0},
            {"segment": "Gross Profit", "amount": gross, "percent": round(gross / revenue * 100, 1) if revenue else 0},
            {"segment": "Operating Expenses", "amount": 0.0, "percent": 0},
            {"segment": "Net Profit", "amount": net, "percent": round(net / revenue * 100, 1) if revenue else 0},
        ]

    def _build_expenses_from_pnl(self, pnl_data):
        sections = self._pnl_sections(pnl_data)
        expenses = []
        for row in sections.get("Operating Expense") or []:
            if not isinstance(row, dict):
                continue
            account = row.get("ACCOUNT")
            amount = safe_float(row.get("AMOUNT"))
            if not account or account in self.PNL_SKIP_ACCOUNTS or amount == 0:
                continue
            expenses.append({
                "category": account,
                "amount": abs(amount),
                "date": None,
            })
        expenses.sort(key=lambda x: x["amount"], reverse=True)
        return expenses

    def _normalize_chart_accounts(self, chart_data):
        if isinstance(chart_data, list):
            return chart_data
        if isinstance(chart_data, dict):
            return self.normalize_erp_list(chart_data, "content", "data", "result")
        return []

    def _build_expenses_from_chart(self, chart_accounts):
        expenses = []
        for row in chart_accounts:
            if not isinstance(row, dict):
                continue
            type_name = (row.get("typeName") or "").lower()
            if "expense" not in type_name:
                continue
            amount = safe_float(row.get("salesgentBalance") or row.get("bankBalance"))
            expenses.append({
                "category": row.get("name") or row.get("detailTypeName") or "Expense",
                "amount": abs(amount),
                "date": row.get("updatedTimestamp") or row.get("openingBalanceDate"),
            })
        expenses.sort(key=lambda x: x["amount"], reverse=True)
        non_zero = [row for row in expenses if row["amount"] > 0]
        return non_zero or expenses

    def _build_balance_sheet_summary(self, chart_accounts):
        summary = {}
        for row in chart_accounts:
            if not isinstance(row, dict):
                continue
            type_name = row.get("typeName") or "Other"
            amount = safe_float(row.get("salesgentBalance") or row.get("bankBalance"))
            bucket = summary.setdefault(type_name, {"typeName": type_name, "total": 0.0, "accounts": []})
            bucket["total"] += amount
            bucket["accounts"].append({
                "name": row.get("name"),
                "amount": amount,
            })
        return sorted(summary.values(), key=lambda x: x["total"], reverse=True)

    def get(self, request):
        store_ids = self.get_store_ids(request)
        params = self.get_financial_report_params(request)

        chart_data, chart_err = erp_get(
            "/chartOfAccount/byTypes",
            params={"storeIds": store_ids},
        )
        chart_accounts = self._normalize_chart_accounts(chart_data)

        pnl_data, pnl_err = erp_get("/report/profitAndLoss", params=params, timeout=120)
        balance_sheet_data, balance_sheet_err = erp_get("/balanceSheet", params=params, timeout=120)

        segments = self._build_segments(pnl_data)
        if not segments:
            segments = self._build_segments_from_local()

        expense_breakdown = self._build_expenses_from_pnl(pnl_data)
        if not expense_breakdown:
            expense_breakdown = self._build_expenses_from_chart(chart_accounts)

        balance_sheet = balance_sheet_data
        if not balance_sheet and chart_accounts:
            balance_sheet = self._build_balance_sheet_summary(chart_accounts)

        erp_errors = {}
        if pnl_err and not self._pnl_sections(pnl_data) and not any(s["amount"] for s in segments):
            erp_errors["pnl"] = pnl_err
        if balance_sheet_err and not balance_sheet:
            erp_errors["balanceSheet"] = balance_sheet_err
        if chart_err and not chart_accounts:
            erp_errors["chartAccounts"] = chart_err

        return self.ok({
            "profitAndLoss": pnl_data,
            "segments": segments,
            "balanceSheet": balance_sheet,
            "chartOfAccounts": chart_accounts,
            "expenses": expense_breakdown[:50],
            "summary": {
                "netProfit": segments[4]["amount"] if len(segments) > 4 else 0,
                "grossMarginPercent": segments[2]["percent"] if len(segments) > 2 else 0,
                "expenseCategories": len(expense_breakdown),
            },
            "erpErrors": erp_errors,
        })


class TaxComplianceView(SupplyChainBaseView):
    """Multi-state taxation compliance (weekly-cached ERP snapshot)."""

    def _parse_state_ids(self, request, primary_state_id):
        raw = request.GET.get("stateIds")
        if raw:
            ids = [safe_int(part) for part in raw.split(",") if part.strip()]
            ids = [sid for sid in ids if sid]
        else:
            ids = list(DEFAULT_TAX_STATE_IDS)
        if primary_state_id and primary_state_id not in ids:
            ids.insert(0, primary_state_id)
        return ids

    def get(self, request):
        store_ids = self.get_store_ids(request)
        tax_type_id = self.get_int_param(request, "taxTypeId", 1)
        state_id = self.get_int_param(request, "stateId", 10)
        state_ids = self._parse_state_ids(request, state_id)
        force_refresh = request.GET.get("refresh", "").lower() in ("1", "true", "yes")
        custom_dates = bool(request.GET.get("startDate") or request.GET.get("endDate"))

        payload = get_tax_compliance(
            store_ids=store_ids,
            tax_type_id=tax_type_id,
            state_id=state_id,
            state_ids=state_ids,
            force_refresh=force_refresh,
            use_cache=not custom_dates,
        )
        return self.ok(payload)
