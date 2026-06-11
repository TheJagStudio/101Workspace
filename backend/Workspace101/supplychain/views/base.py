from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from supplychain.erp_client import safe_float


class SupplyChainBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def ok(self, data, status=200, **extra):
        payload = {"success": True, "data": data}
        payload.update(extra)
        return Response(payload, status=status)

    def fail(self, message, status=502, **extra):
        payload = {"success": False, "error": message}
        payload.update(extra)
        return Response(payload, status=status)

    def get_int_param(self, request, name, default=None):
        raw = request.GET.get(name)
        if raw is None or raw == "":
            return default
        try:
            return int(raw)
        except ValueError:
            return default

    def get_float_param(self, request, name, default=None):
        raw = request.GET.get(name)
        if raw is None or raw == "":
            return default
        try:
            return float(raw)
        except ValueError:
            return default

    def get_store_ids(self, request):
        return request.GET.get("storeIds", "1,2")

    def get_erp_date_params(self, request, *, default_start="2015-01-01+04:00:00"):
        """ERP report endpoints require startDate/endDate query params."""
        return {
            "startDate": request.GET.get("startDate") or default_start,
            "endDate": request.GET.get("endDate") or timezone.now().strftime("%Y-%m-%d+%H:%M:%S"),
        }

    def get_ytd_date_params(self, request):
        """Year-to-date range — avoids multi-year tax report timeouts."""
        now = timezone.now()
        ytd_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        return {
            "startDate": request.GET.get("startDate") or ytd_start.strftime("%Y-%m-%d+%H:%M:%S"),
            "endDate": request.GET.get("endDate") or now.strftime("%Y-%m-%d+%H:%M:%S"),
        }

    def get_report_params(self, request, **extra):
        params = {"storeIds": self.get_store_ids(request), **self.get_erp_date_params(request)}
        params.update(extra)
        return params

    def get_warehouse_ids(self, request):
        return request.GET.get("wareHouseIdList") or request.GET.get("warehouseIds") or "1"

    def get_financial_report_params(self, request, **extra):
        return self.get_report_params(
            request,
            wareHouseIdList=self.get_warehouse_ids(request),
            **extra,
        )

    def normalize_erp_list(self, data, *extra_keys):
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

    def parse_due_aging_row(self, row):
        """Map ERP due-balance aging DTO fields to standard bucket keys."""
        aging_map = row.get("agingDurationAndAmountMap") or {}
        current = safe_float(row.get("amountDueToday") or row.get("current"))
        d30 = safe_float(aging_map.get("1-30"))
        d60 = safe_float(aging_map.get("31-60"))
        d90 = safe_float(aging_map.get("61-90"))
        over90 = sum(
            safe_float(aging_map.get(k))
            for k in ("91-120", "121-OVER", "91-180", "181-OVER")
        )
        if not any((d30, d60, d90, over90)) and aging_map:
            coarse = safe_float(aging_map.get("1-90"))
            if coarse:
                d30 = coarse
            over90 = safe_float(aging_map.get("91-180")) + safe_float(aging_map.get("181-OVER"))
        total = safe_float(
            row.get("totalDueAmount") or row.get("netDueAmount") or row.get("dueBalance")
        )
        if not total:
            total = current + d30 + d60 + d90 + over90
        return {
            "current": current,
            "days1To30": d30,
            "days31To60": d60,
            "days61To90": d90,
            "over90": over90,
            "totalDue": total,
        }
