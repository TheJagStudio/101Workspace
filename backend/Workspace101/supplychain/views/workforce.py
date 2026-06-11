"""Workforce efficiency analytics (modules 11–13)."""

from supplychain.erp_client import erp_fetch_many, erp_get, safe_float, safe_int
from supplychain.views.base import SupplyChainBaseView


class SalesRepROIView(SupplyChainBaseView):
    """Sales rep ROI & commission analysis."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        params = self.get_report_params(request)

        sources = erp_fetch_many([
            {"key": "byBrand", "path": "/report/employee/commission/byBrand", "params": params},
            {"key": "byCategory", "path": "/report/employee/commission/byCategory", "params": params},
            {"key": "dueByRep", "path": "/report/employee/dueBySalesRep", "params": params},
            {"key": "salesByRep", "path": "/report/sales/bySalesRep", "params": params},
        ])

        sales_raw = sources["salesByRep"].get("data") or []
        if isinstance(sales_raw, dict):
            sales_raw = sales_raw.get("content") or sales_raw.get("data") or []

        commission_by_rep = {}
        for key in ("byBrand", "byCategory"):
            data = sources[key].get("data") or []
            if isinstance(data, dict):
                data = data.get("content") or data.get("data") or []
            for row in data if isinstance(data, list) else []:
                rep = row.get("salesRepName") or row.get("employeeName") or row.get("salesRepresentativeName") or "Unknown"
                commission_by_rep.setdefault(rep, 0)
                commission_by_rep[rep] += safe_float(row.get("commission") or row.get("commissionAmount"))

        reps = []
        for row in sales_raw if isinstance(sales_raw, list) else []:
            rep_name = row.get("salesRepName") or row.get("employeeName") or row.get("name")
            sales = safe_float(row.get("totalSales") or row.get("salesAmount") or row.get("amount"))
            commission = commission_by_rep.get(rep_name, safe_float(row.get("commission")))
            roi = round(sales / commission, 2) if commission > 0 else None
            reps.append({
                "salesRep": rep_name,
                "totalSales": sales,
                "commission": round(commission, 2),
                "roi": roi,
                "orderCount": safe_int(row.get("orderCount") or row.get("count")),
                "performance": "top" if roi and roi > 20 else "average" if roi and roi > 10 else "below",
            })

        reps.sort(key=lambda x: x["totalSales"], reverse=True)

        return self.ok({
            "salesReps": reps,
            "commissionByBrand": sources["byBrand"].get("data"),
            "commissionByCategory": sources["byCategory"].get("data"),
            "dueBySalesRep": sources["dueByRep"].get("data"),
            "summary": {
                "repCount": len(reps),
                "totalSales": round(sum(r["totalSales"] for r in reps), 2),
                "totalCommission": round(sum(r["commission"] for r in reps), 2),
                "topPerformer": reps[0]["salesRep"] if reps else None,
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })


class LaborAllocationView(SupplyChainBaseView):
    """Labor resource allocation."""

    def get(self, request):
        store_ids = self.get_store_ids(request)
        employee_id = self.get_int_param(request, "employeeId")

        specs = [
            {"key": "employees", "path": "/employee/list", "params": {"storeIds": store_ids, "page": 0, "size": 200}},
        ]
        if employee_id:
            specs.append({
                "key": "clockIn",
                "path": f"/employee/clockIn/{employee_id}",
                "params": self.get_report_params(request),
            })

        sources = erp_fetch_many(specs)
        employees_raw = sources["employees"].get("data") or []
        if isinstance(employees_raw, dict):
            employees_raw = employees_raw.get("content") or employees_raw.get("data") or []

        roster = []
        for row in employees_raw if isinstance(employees_raw, list) else []:
            eid = row.get("employeeId") or row.get("id")
            roster.append({
                "employeeId": eid,
                "name": row.get("employeeName") or row.get("name") or f"{row.get('firstName', '')} {row.get('lastName', '')}".strip(),
                "role": row.get("role") or row.get("designation"),
                "department": row.get("department"),
                "active": row.get("active", True),
                "storeId": row.get("storeId"),
            })

        return self.ok({
            "roster": roster,
            "clockInDetail": sources.get("clockIn", {}).get("data"),
            "summary": {
                "totalEmployees": len(roster),
                "activeEmployees": len([e for e in roster if e.get("active")]),
                "departments": len(set(e.get("department") for e in roster if e.get("department"))),
            },
            "erpErrors": {k: v["error"] for k, v in sources.items() if v.get("error")},
        })


class EditFrictionView(SupplyChainBaseView):
    """System concurrency & edit friction."""

    def get(self, request):
        module_id = self.get_int_param(request, "moduleId", 1)
        record_id = self.get_int_param(request, "recordId", 1)

        data, err = erp_get(
            "/recordUnderEditMode",
            params={"moduleId": module_id, "recordId": record_id},
            referer="/",
        )

        locks = []
        if isinstance(data, list):
            locks = data
        elif isinstance(data, dict):
            locks = data.get("content") or data.get("data") or [data]

        return self.ok({
            "editLocks": locks,
            "query": {"moduleId": module_id, "recordId": record_id},
            "summary": {
                "activeLocks": len(locks) if isinstance(locks, list) else 0,
                "hasConflict": len(locks) > 0 if isinstance(locks, list) else bool(data),
            },
            "erpError": err,
        })
