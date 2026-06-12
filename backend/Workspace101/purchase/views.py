import os
from django.shortcuts import render
from django.http import StreamingHttpResponse
import typesense
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from api.models import (
    Product,
    Category,
    BusinessType,
    Invoice,
    InvoiceLineItem,
    Vendor,
    PurchaseHistory,
    SalesgentToken,
    ProductHistory,
    Customer,
    AIReport,
    POLocal,
    POLocalLineItem,
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, connection
import json
from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta
import datetime
from django.db.models.functions import TruncDate, Abs, Cast, Coalesce
from api.ai_agent.agent import DjangoAIAgent
import requests
from django.contrib.auth.models import User
from collections import defaultdict
from django.core.paginator import Paginator, EmptyPage
from django.db.models import Sum, F, Avg, Q, Count, When, Case, Value, DecimalField, CharField, OuterRef, Subquery, Max, Min, DateTimeField, Prefetch, ExpressionWrapper, FloatField
from rest_framework import status
from django.shortcuts import redirect
from django.utils.dateparse import parse_date
import decimal

client = typesense.Client(
    {
        "api_key": settings.TYPESENSE_API_KEY,
        "nodes": [
            {
                "host": "purityai-typesense.hf.space",
                "port": "443",
                "protocol": "https",
            }
        ],
        "connection_timeout_seconds": 2,
    }
)


def notifyMe(message, channel):
    try:
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }
        data = message
        response = requests.post(f"https://thejagstudio-ntfy.hf.space/{channel}", headers=headers, data=data)
        print(response.text)
    except Exception as e:
        print(f"Error notifying: {e}")
    return


def _parse_inventory_date_range(start_date_str, end_date_str, default_days=30):
    """Return (start_date, end_date) as timezone-aware datetimes; end is inclusive through end of day."""
    tz = timezone.get_current_timezone()
    end_date = timezone.now()
    if end_date_str:
        end_date = timezone.make_aware(datetime.datetime.strptime(end_date_str, "%Y-%m-%d"), tz) + timedelta(days=1, microseconds=-1)
    start_date = end_date - timedelta(days=default_days)
    if start_date_str:
        start_date = timezone.make_aware(datetime.datetime.strptime(start_date_str, "%Y-%m-%d"), tz)
    return start_date, end_date


def _product_measure_filter(measure):
    if measure == "all":
        return Q()
    if measure == "hand":
        return Q(availableQuantity__gt=0)
    if measure == "low":
        return Q(availableQuantity__lt=10, availableQuantity__gt=0)
    if measure == "out":
        return Q(availableQuantity=0)
    return None


def _category_measure_filter(measure):
    if measure == "all":
        return Q()
    if measure == "hand":
        return Q(products_m2m__availableQuantity__gt=0)
    if measure == "low":
        return Q(products_m2m__availableQuantity__lt=10, products_m2m__availableQuantity__gt=0)
    if measure == "out":
        return Q(products_m2m__availableQuantity=0)
    return None


def _dusty_cutoff_date(days_threshold):
    return timezone.now().date() - timedelta(days=int(days_threshold))


def _dusty_product_ids(cutoff_date):
    """Products with on-hand stock and no sale since cutoff (all-time last sale from line items)."""
    last_sales = (
        InvoiceLineItem.objects.filter(deleted=False)
        .values("productId")
        .annotate(last_sale=Max("insertedTimestamp"))
    )
    stale_ids = [row["productId"] for row in last_sales if row["last_sale"] and row["last_sale"].date() < cutoff_date]
    never_sold = (
        Product.objects.filter(active=True, availableQuantity__gt=0)
        .exclude(productId__in=InvoiceLineItem.objects.filter(deleted=False).values("productId"))
        .values_list("productId", flat=True)
    )
    return set(stale_ids) | set(never_sold)


class ProductListingView(APIView):
    def get(self, request):
        """
        List products with optional filtering and sorting.
        """
        query = request.GET.get("search", "")
        order_by = request.GET.get("order", "productName")
        direction = request.GET.get("dir", "asc")
        limit = int(request.GET.get("limit", 10))
        offset = int(request.GET.get("offset", 0))

        products = Product.objects.filter(active=True)

        if query:
            products = products.filter(productName__icontains=query)

        if order_by == "productName":
            products = products.order_by(order_by if direction == "asc" else f"-{order_by}")
        elif order_by == "availableQuantity":
            products = products.order_by(order_by if direction == "asc" else f"-{order_by}")
        elif order_by == "standardPrice":
            products = products.order_by(order_by if direction == "asc" else f"-{order_by}")
        elif order_by == "insertedTimestamp":
            products = products.order_by("lastSyncTimestamp" if direction == "asc" else f"-lastSyncTimestamp")
        elif order_by == "upc":
            products = products.order_by(order_by if direction == "asc" else f"-{order_by}")
        else:
            return Response({"error": "Invalid order parameter"}, status=400)

        total_count = products.count()
        products = products[offset : offset + limit]

        data = {
            "products": list(products.values()),
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
        }
        return Response(data)


def _summary_measure_q(measure, prefix=""):
    """Build Q filter for inventory measure on Product fields."""
    field = f"{prefix}availableQuantity" if prefix else "availableQuantity"
    if measure == "all":
        return Q()
    if measure == "hand":
        return Q(**{f"{field}__gt": 0})
    if measure == "low":
        return Q(**{f"{field}__lt": 10, f"{field}__gt": 0})
    if measure == "out":
        return Q(**{field: 0})
    return None


def _summary_category_product_filter(measure):
    """Build Q filter for category aggregates via products_m2m."""
    if measure == "all":
        return Q()
    if measure == "hand":
        return Q(products_m2m__availableQuantity__gt=0)
    if measure == "low":
        return Q(products_m2m__availableQuantity__lt=10, products_m2m__availableQuantity__gt=0)
    if measure == "out":
        return Q(products_m2m__availableQuantity=0)
    return None


def _annotate_summary_categories(categories, product_filter):
    """Annotate all summary metrics on categories in one query."""
    return categories.annotate(
        agg_closing_inventory=Coalesce(
            Sum(Abs(F("products_m2m__availableQuantity")), filter=product_filter, output_field=DecimalField()),
            Value(0),
            output_field=DecimalField(),
        ),
        agg_revenue=Coalesce(
            Sum(Abs(F("products_m2m__TotalRevenue")), filter=product_filter, output_field=DecimalField()),
            Value(0),
            output_field=DecimalField(),
        ),
        agg_gross_margin=Coalesce(
            Sum(Abs(F("products_m2m__TotalGrossMargin")), filter=product_filter, output_field=DecimalField()),
            Value(0),
            output_field=DecimalField(),
        ),
        agg_inventory_cost=Coalesce(
            Sum(
                Abs(F("products_m2m__availableQuantity") * F("products_m2m__costPrice")),
                filter=product_filter,
                output_field=DecimalField(),
            ),
            Value(0),
            output_field=DecimalField(),
        ),
    )


def _category_image_map(category_ids):
    """One image URL per category (PostgreSQL DISTINCT ON)."""
    if not category_ids:
        return {}
    rows = (
        Product.objects.filter(categories__categoryId__in=category_ids, imageUrl__isnull=False)
        .exclude(imageUrl="")
        .order_by("categories__categoryId", "productId")
        .distinct("categories__categoryId")
        .values_list("categories__categoryId", "imageUrl")
    )
    return dict(rows)


class InventorySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.GET.get("report_type", "product")
        measure = request.GET.get("measure", "all")
        sort_by = request.GET.get("sort_by", "closing_inventory")
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 20))
        data_type = request.GET.get("dataType", "total")
        reverse_sort = request.GET.get("reverse_sort", "true").lower() == "true"
        load_subcategories = request.GET.get("loadSubcategories", "False").lower() == "true"
        search_term = request.GET.get("searchTerm", "").strip()
        typesense_pages = 1

        measure_q = _summary_measure_q(measure)
        if measure_q is None:
            return Response({"error": "Invalid measure type"}, status=400)

        products = Product.objects.filter(active=True)
        if search_term:
            products_typesense = client.collections["101"].documents.search(
                {
                    "q": search_term,
                    "query_by": "productName,sku,upc",
                    "filter_by": "active:=true",
                    "per_page": 250,
                }
            )
            product_ids = [hit["document"]["id"] for hit in products_typesense["hits"]]
            products = products.filter(productId__in=product_ids)
        products = products.filter(measure_q)

        if load_subcategories:
            categories = Category.objects.filter(parentId__isnull=False).exclude(deleted=True)
        else:
            categories = Category.objects.filter(parentId__isnull=True).exclude(deleted=True)

        category_filter = _summary_category_product_filter(measure)
        if category_filter is None:
            return Response({"error": "Invalid measure type"}, status=400)

        sort_field_map = {
            "closing_inventory": "agg_closing_inventory",
            "gross_margin": "agg_gross_margin",
            "revenue": "agg_revenue",
            "inventory_cost": "agg_inventory_cost",
        }

        if report_type == "product":
            if sort_by == "revenue":
                products = products.order_by("TotalRevenue")
            elif sort_by == "inventory_cost":
                products = products.annotate(
                    inventory_cost=Abs(F("availableQuantity") * F("standardPrice"))
                ).order_by("inventory_cost")
            elif sort_by == "gross_margin":
                products = products.order_by("TotalGrossMargin")
            elif sort_by == "closing_inventory":
                products = products.order_by("availableQuantity")
            else:
                products = products.order_by("productId")
            if reverse_sort:
                products = products.reverse()
        elif report_type == "category":
            categories = _annotate_summary_categories(categories, category_filter)
            order_field = sort_field_map.get(sort_by, "agg_closing_inventory")
            categories = categories.order_by(order_field if not reverse_sort else f"-{order_field}")
        elif report_type not in ("product", "category"):
            return Response({"error": "Invalid report type"}, status=400)

        if data_type == "total":
            total_closing = (
                products.aggregate(
                    total=Sum(
                        Case(
                            When(availableQuantity__lt=9999999, then=Abs(F("availableQuantity"))),
                            default=Value(0),
                            output_field=DecimalField(),
                        )
                    )
                )["total"]
                or 0
            )
            totals = Product.objects.filter(active=True).aggregate(
                total_gross_margin=Sum(Abs(F("TotalGrossMargin")), output_field=DecimalField()),
                total_revenue=Sum(Abs(F("TotalRevenue")), output_field=DecimalField()),
            )
            total_inventory_cost = (
                products.aggregate(
                    total=Sum(Abs(F("availableQuantity") * F("costPrice")), output_field=DecimalField())
                )["total"]
                or 0
            )
            return Response(
                {
                    "totalClosingInventory": total_closing,
                    "totalGrossMargin": totals["total_gross_margin"],
                    "totalInventoryCost": total_inventory_cost,
                    "totalRevenue": totals["total_revenue"],
                }
            )

        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        row_index = start_index + 1

        if report_type == "product":
            total_pages = (products.count() + page_size - 1) // page_size
            page_products = products[start_index:end_index]
            final_data = []
            for product in page_products:
                qty = product.availableQuantity or 0
                closing = qty if qty > 0 else 0
                final_data.append(
                    {
                        "id": product.productId,
                        "index": row_index,
                        "name": product.productName,
                        "closingInventory": closing,
                        "revenue": product.TotalRevenue,
                        "grossProfit": product.TotalGrossMargin,
                        "inventoryCost": (qty * (product.standardPrice or 0)) if qty > 0 else 0,
                        "imageUrl": product.imageUrl,
                    }
                )
                row_index += 1
            return Response(
                {"data": final_data, "totalPages": typesense_pages if search_term else total_pages}
            )

        total_pages = (categories.count() + page_size - 1) // page_size
        page_categories = list(categories[start_index:end_index])
        image_map = _category_image_map([c.categoryId for c in page_categories])
        final_data = []
        for category in page_categories:
            final_data.append(
                {
                    "id": category.categoryId,
                    "index": row_index,
                    "name": category.name,
                    "closingInventory": category.agg_closing_inventory,
                    "revenue": category.agg_revenue,
                    "grossProfit": category.agg_gross_margin,
                    "inventoryCost": category.agg_inventory_cost,
                    "imageUrl": image_map.get(category.categoryId),
                }
            )
            row_index += 1
        return Response(
            {"data": final_data, "totalPages": typesense_pages if search_term else total_pages}
        )


class InventoryReplenishmentView(APIView):
    """Inventory replenishment by product or category with paginated DB-level sorting."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            report_type = request.GET.get("report_type", "product")
            measure = request.GET.get("measure", "all")
            sort_by = request.GET.get("sort_by", "closing_inventory")
            page = int(request.GET.get("page", 1))
            page_size = int(request.GET.get("page_size", 20))
            reverse_sort = request.GET.get("reverse_sort", "true").lower() == "true"
            load_subcategories = request.GET.get("loadSubcategories", "False").lower() == "true"
            start_date, end_date = _parse_inventory_date_range(
                request.GET.get("start_date"),
                request.GET.get("end_date"),
            )
        except (ValueError, TypeError):
            return Response({"error": "Invalid parameter type for page or page_size."}, status=400)

        if start_date > end_date:
            return Response({"error": "start_date cannot be after end_date"}, status=400)

        days_in_period = max(1, (end_date.date() - start_date.date()).days + 1)
        sales_filter = Q(
            invoice_line_items__insertedTimestamp__range=(start_date, end_date),
            invoice_line_items__deleted=False,
        )
        po_inbound_filter = Q(purchase_history__purchaseOrderInsertedTimestamp__range=(start_date, end_date))
        measure_q = _summary_measure_q(measure)
        if measure_q is None:
            return Response({"error": "Invalid measure type"}, status=400)

        final_data = []
        paginator = None

        if report_type == "product":
            base_queryset = Product.objects.filter(active=True).filter(measure_q).annotate(
                items_sold_val=Coalesce(
                    Sum("invoice_line_items__quantity", filter=sales_filter),
                    Value(0),
                    output_field=DecimalField(),
                ),
                inbound_val=Coalesce(
                    Sum("purchase_history__purchasedQuantity", filter=po_inbound_filter),
                    Value(0),
                    output_field=DecimalField(),
                ),
            )
            if sort_by == "items_sold":
                sort_expression = F("items_sold_val")
            elif sort_by == "inbound_inventory":
                sort_expression = F("inbound_val")
            elif sort_by == "items_sold_per_day":
                sort_expression = ExpressionWrapper(
                    F("items_sold_val") / Value(days_in_period),
                    output_field=DecimalField(),
                )
            elif sort_by == "days_cover":
                sort_expression = Case(
                    When(items_sold_val=0, then=Value(999999999)),
                    default=ExpressionWrapper(
                        Coalesce(F("availableQuantity"), Value(0))
                        * Value(days_in_period)
                        / F("items_sold_val"),
                        output_field=FloatField(),
                    ),
                    output_field=FloatField(),
                )
            elif sort_by == "closing_inventory":
                sort_expression = Coalesce(F("availableQuantity"), Value(0))
            elif sort_by == "average_cost":
                sort_expression = Coalesce(F("avgCostPrice"), F("costPrice"), Value(0))
            else:
                sort_expression = F("productName")

            order = sort_expression.desc(nulls_last=True) if reverse_sort else sort_expression.asc(nulls_first=True)
            paginator = Paginator(base_queryset.order_by(order), page_size)
            try:
                page_objects = paginator.page(page)
            except EmptyPage:
                return Response({"data": [], "totalPages": paginator.num_pages})

            for product in page_objects.object_list:
                items_sold = float(product.items_sold_val or 0)
                avg_per_day = items_sold / days_in_period
                closing_inventory = float(product.availableQuantity or 0)
                days_cover = closing_inventory / avg_per_day if avg_per_day > 0 else float("inf")
                average_cost = float(product.avgCostPrice or product.costPrice or 0)
                final_data.append(
                    {
                        "id": product.productId,
                        "name": product.productName,
                        "closingInventory": round(closing_inventory, 2),
                        "itemsSold": round(items_sold, 2),
                        "itemsSoldPerDay": round(avg_per_day, 2),
                        "daysCover": round(days_cover, 2) if days_cover != float("inf") else "0",
                        "averageCost": round(average_cost, 2),
                        "inboundInventory": round(float(product.inbound_val or 0), 2),
                        "imageUrl": product.imageUrl,
                        "sku": product.sku,
                        "upc": product.upc,
                    }
                )

        elif report_type == "category":
            base_queryset = Category.objects.filter(
                parentId__isnull=not load_subcategories,
            ).filter(Q(deleted=False) | Q(deleted__isnull=True)).annotate(
                items_sold_val=Coalesce(
                    Sum("products_m2m__invoice_line_items__quantity", filter=sales_filter),
                    Value(0),
                    output_field=DecimalField(),
                ),
                inbound_val=Coalesce(
                    Sum("products_m2m__purchase_history__purchasedQuantity", filter=po_inbound_filter),
                    Value(0),
                    output_field=DecimalField(),
                ),
                closing_val=Coalesce(
                    Sum("products_m2m__availableQuantity"),
                    Value(0),
                    output_field=DecimalField(),
                ),
                avg_cost_val=Coalesce(
                    Avg("products_m2m__avgCostPrice"),
                    Avg("products_m2m__costPrice"),
                    Value(0),
                    output_field=DecimalField(),
                ),
            )
            if sort_by == "items_sold":
                sort_expression = F("items_sold_val")
            elif sort_by == "inbound_inventory":
                sort_expression = F("inbound_val")
            elif sort_by == "items_sold_per_day":
                sort_expression = ExpressionWrapper(
                    F("items_sold_val") / Value(days_in_period),
                    output_field=DecimalField(),
                )
            elif sort_by == "days_cover":
                sort_expression = Case(
                    When(items_sold_val=0, then=Value(999999999)),
                    default=ExpressionWrapper(
                        F("closing_val") * Value(days_in_period) / F("items_sold_val"),
                        output_field=FloatField(),
                    ),
                    output_field=FloatField(),
                )
            elif sort_by == "closing_inventory":
                sort_expression = F("closing_val")
            elif sort_by == "average_cost":
                sort_expression = F("avg_cost_val")
            else:
                sort_expression = F("name")

            order = sort_expression.desc(nulls_last=True) if reverse_sort else sort_expression.asc(nulls_first=True)
            paginator = Paginator(base_queryset.order_by(order), page_size)
            try:
                page_objects = paginator.page(page)
            except EmptyPage:
                return Response({"data": [], "totalPages": paginator.num_pages})

            image_map = _category_image_map([c.categoryId for c in page_objects.object_list])
            for i, category in enumerate(page_objects.object_list):
                items_sold = float(category.items_sold_val or 0)
                avg_per_day = items_sold / days_in_period
                closing_inventory = float(category.closing_val or 0)
                days_cover = closing_inventory / avg_per_day if avg_per_day > 0 else float("inf")
                final_data.append(
                    {
                        "id": category.categoryId,
                        "index": page_objects.start_index() + i,
                        "name": category.name,
                        "closingInventory": round(closing_inventory, 2),
                        "itemsSold": round(items_sold, 2),
                        "itemsSoldPerDay": round(avg_per_day, 2),
                        "daysCover": round(days_cover, 2) if days_cover != float("inf") else "0",
                        "averageCost": round(float(category.avg_cost_val or 0), 2),
                        "inboundInventory": round(float(category.inbound_val or 0), 2),
                        "imageUrl": image_map.get(category.categoryId),
                    }
                )
        else:
            return Response({"error": "Invalid report type. Must be 'product' or 'category'."}, status=400)

        return Response({"data": final_data, "totalPages": paginator.num_pages})


class DustyInventoryView(APIView):
    """Dusty / slow-moving inventory using Django ORM (replaces Supabase RPC)."""

    permission_classes = [IsAuthenticated]

    SORT_FIELDS = {
        "closingInventory": "closing_inventory",
        "closing_inventory": "closing_inventory",
        "sellThroughRate": "sell_through_rate",
        "inventoryCost": "inventory_cost",
        "retailValue": "retail_value",
        "lastSale": "last_sale_date",
        "last_sale": "last_sale_date",
    }

    def _period_bounds(self, start_str, end_str):
        try:
            start_date, end_date = _parse_inventory_date_range(start_str, end_str, default_days=90)
        except ValueError:
            return None, None
        return start_date, end_date

    def _dusty_product_queryset(self, cutoff_date, measure, start_date, end_date):
        period_filter = Q(
            invoice_line_items__insertedTimestamp__range=(start_date, end_date),
            invoice_line_items__deleted=False,
        )
        last_sale_subq = (
            InvoiceLineItem.objects.filter(deleted=False, productId=OuterRef("pk"))
            .values("productId")
            .annotate(m=Max("insertedTimestamp"))
            .values("m")[:1]
        )
        sold_period_subq = (
            InvoiceLineItem.objects.filter(
                deleted=False,
                productId=OuterRef("pk"),
                insertedTimestamp__range=(start_date, end_date),
            )
            .values("productId")
            .annotate(t=Sum("quantity"))
            .values("t")[:1]
        )
        last_received_subq = (
            PurchaseHistory.objects.filter(productId=OuterRef("pk"))
            .values("productId")
            .annotate(m=Max("purchaseOrderInsertedTimestamp"))
            .values("m")[:1]
        )

        qs = (
            Product.objects.filter(active=True)
            .annotate(
                last_sale_date=Subquery(last_sale_subq, output_field=DateTimeField()),
                quantity_sold=Coalesce(Subquery(sold_period_subq), Value(0)),
                last_received_date=Subquery(last_received_subq, output_field=DateTimeField()),
            )
            .annotate(
                closing_inventory=Coalesce(F("availableQuantity"), Value(0)),
                inventory_cost=ExpressionWrapper(
                    Coalesce(F("availableQuantity"), Value(0)) * Coalesce(F("costPrice"), Value(0)),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
                retail_value=ExpressionWrapper(
                    Coalesce(F("availableQuantity"), Value(0)) * Coalesce(F("standardPrice"), Value(0)),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
                sell_through_rate=Case(
                    When(
                        Q(availableQuantity__gt=0) | Q(quantity_sold__gt=0),
                        then=ExpressionWrapper(
                            F("quantity_sold") * Value(100.0)
                            / (Coalesce(F("availableQuantity"), Value(0)) + F("quantity_sold")),
                            output_field=DecimalField(max_digits=10, decimal_places=2),
                        ),
                    ),
                    default=Value(0),
                    output_field=DecimalField(max_digits=10, decimal_places=2),
                ),
            )
        )

        if measure == "dusty":
            qs = qs.filter(availableQuantity__gt=0).filter(
                Q(last_sale_date__isnull=True) | Q(last_sale_date__date__lt=cutoff_date)
            )
        else:
            measure_q = _summary_measure_q(measure)
            if measure_q is None:
                return None
            qs = qs.filter(measure_q)
        return qs

    def _format_last_sale(self, dt):
        if not dt:
            return None, None
        sale_date = dt.date() if hasattr(dt, "date") else dt
        days_since = (timezone.now().date() - sale_date).days
        return sale_date.isoformat(), days_since

    def _product_rows(self, queryset, page, page_size, sort_by, reverse_sort):
        order_field = self.SORT_FIELDS.get(sort_by, "last_sale_date")
        order_prefix = "-" if reverse_sort else ""
        if order_field == "last_sale_date":
            queryset = queryset.order_by(f"{order_prefix}{order_field}", f"{order_prefix}productId")
        else:
            queryset = queryset.order_by(f"{order_prefix}{order_field}")

        paginator = Paginator(queryset, page_size)
        try:
            page_obj = paginator.page(page)
        except EmptyPage:
            return [], paginator.count

        rows = []
        for product in page_obj.object_list:
            last_sale, days_since = self._format_last_sale(product.last_sale_date)
            last_received = product.last_received_date.date().isoformat() if product.last_received_date else None
            rows.append(
                {
                    "id": product.productId,
                    "name": product.productName,
                    "sku": product.sku,
                    "closingInventory": int(product.closing_inventory or 0),
                    "sellThroughRate": round(float(product.sell_through_rate or 0), 2),
                    "quantitySold": int(product.quantity_sold or 0),
                    "inventoryCost": float(product.inventory_cost or 0),
                    "retailValue": float(product.retail_value or 0),
                    "lastSale": last_sale,
                    "days_since_last_sale": days_since,
                    "lastReceived": last_received,
                    "imageUrl": product.imageUrl,
                }
            )
        return rows, paginator.count

    def _category_rows(self, load_subcategory, measure, cutoff_date, start_date, end_date, page, page_size, sort_by, reverse_sort):
        categories = Category.objects.filter(parentId__isnull=not load_subcategory).filter(
            Q(deleted=False) | Q(deleted__isnull=True)
        )
        dusty_ids = _dusty_product_ids(cutoff_date) if measure == "dusty" else None
        cat_measure = _summary_category_product_filter(measure)
        if measure == "dusty" and cat_measure is None:
            cat_measure = Q()
        elif cat_measure is None:
            return [], 0
        product_filter = Q(products_m2m__active=True) & cat_measure
        if dusty_ids is not None:
            product_filter &= Q(products_m2m__productId__in=dusty_ids)

        period_q = Q(
            products_m2m__invoice_line_items__insertedTimestamp__range=(start_date, end_date),
            products_m2m__invoice_line_items__deleted=False,
        )
        categories = categories.annotate(
            closing_inventory=Coalesce(
                Sum("products_m2m__availableQuantity", filter=product_filter),
                Value(0),
                output_field=DecimalField(),
            ),
            inventory_cost=Coalesce(
                Sum(
                    Abs(F("products_m2m__availableQuantity") * F("products_m2m__costPrice")),
                    filter=product_filter,
                    output_field=DecimalField(),
                ),
                Value(0),
                output_field=DecimalField(),
            ),
            retail_value=Coalesce(
                Sum(
                    Abs(F("products_m2m__availableQuantity") * F("products_m2m__standardPrice")),
                    filter=product_filter,
                    output_field=DecimalField(),
                ),
                Value(0),
                output_field=DecimalField(),
            ),
            quantity_sold=Coalesce(
                Sum("products_m2m__invoice_line_items__quantity", filter=product_filter & period_q),
                Value(0),
                output_field=DecimalField(),
            ),
            last_sale_date=Max("products_m2m__invoice_line_items__insertedTimestamp", filter=product_filter),
            last_received_date=Max("products_m2m__purchase_history__purchaseOrderInsertedTimestamp", filter=product_filter),
        ).annotate(
            sell_through_rate=Case(
                When(
                    Q(closing_inventory__gt=0) | Q(quantity_sold__gt=0),
                    then=ExpressionWrapper(
                        F("quantity_sold") * Value(100.0) / (F("closing_inventory") + F("quantity_sold")),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    ),
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=10, decimal_places=2),
            ),
        )

        order_field = self.SORT_FIELDS.get(sort_by, "last_sale_date")
        order_prefix = "-" if reverse_sort else ""
        categories = categories.order_by(f"{order_prefix}{order_field}")

        paginator = Paginator(categories, page_size)
        try:
            page_obj = paginator.page(page)
        except EmptyPage:
            return [], paginator.count

        image_map = _category_image_map([c.categoryId for c in page_obj.object_list])
        rows = []
        for category in page_obj.object_list:
            last_sale, days_since = self._format_last_sale(category.last_sale_date)
            last_received = (
                category.last_received_date.date().isoformat() if category.last_received_date else None
            )
            rows.append(
                {
                    "id": category.categoryId,
                    "name": category.name,
                    "sku": None,
                    "closingInventory": int(category.closing_inventory or 0),
                    "sellThroughRate": round(float(category.sell_through_rate or 0), 2),
                    "quantitySold": int(category.quantity_sold or 0),
                    "inventoryCost": float(category.inventory_cost or 0),
                    "retailValue": float(category.retail_value or 0),
                    "lastSale": last_sale,
                    "days_since_last_sale": days_since,
                    "lastReceived": last_received,
                    "imageUrl": image_map.get(category.categoryId),
                }
            )
        return rows, paginator.count

    def get(self, request):
        try:
            page = int(request.GET.get("_page_num", 1))
            page_size = int(request.GET.get("_page_size", 20))
        except (TypeError, ValueError):
            return Response({"error": "Invalid page parameters"}, status=400)

        start_str = request.GET.get("_start_date")
        end_str = request.GET.get("_end_date")
        start_date, end_date = self._period_bounds(start_str, end_str)
        if start_date is None:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        if start_str and end_str:
            days_threshold = max(1, (end_date.date() - start_date.date()).days + 1)
        else:
            days_threshold = int(request.GET.get("_days_threshold", 90))

        cutoff_date = _dusty_cutoff_date(days_threshold)
        measure = request.GET.get("_measure", "dusty")
        report_type = request.GET.get("_report_type", "product")
        sort_by = request.GET.get("_sort_by", "lastSale")
        reverse_sort = request.GET.get("_reverse_sort", "true").lower() == "true"
        load_subcategory = request.GET.get("_load_subcategory", "False").lower() == "true"
        data_type = request.GET.get("_dataType", "child")

        if data_type == "total":
            if report_type == "product":
                qs = self._dusty_product_queryset(cutoff_date, measure, start_date, end_date)
                if qs is None:
                    return Response({"error": "Invalid measure type"}, status=400)
                agg = qs.aggregate(
                    total_closing=Sum("closing_inventory"),
                    total_cost=Sum("inventory_cost"),
                    total_retail=Sum("retail_value"),
                    total_sold=Sum("quantity_sold"),
                )
                closing = float(agg["total_closing"] or 0)
                sold = float(agg["total_sold"] or 0)
                rate = (sold * 100.0 / (closing + sold)) if (closing + sold) > 0 else 0
                return Response(
                    {
                        "totalClosingInventory": closing,
                        "totalInventoryCost": float(agg["total_cost"] or 0),
                        "totalRetailValue": float(agg["total_retail"] or 0),
                        "overallSellThroughRate": round(rate, 2),
                        "totalSoldInPeriod": sold,
                        "analysisThresholdDays": days_threshold,
                    }
                )
            return Response({"error": "Totals are only supported for product report type"}, status=400)

        if report_type == "product":
            qs = self._dusty_product_queryset(cutoff_date, measure, start_date, end_date)
            if qs is None:
                return Response({"error": "Invalid measure type"}, status=400)
            data, total_records = self._product_rows(qs, page, page_size, sort_by, reverse_sort)
        elif report_type == "category":
            data, total_records = self._category_rows(
                load_subcategory, measure, cutoff_date, start_date, end_date, page, page_size, sort_by, reverse_sort
            )
        else:
            return Response({"error": "Invalid report type"}, status=400)

        return Response({"data": data, "totalPages": total_records})


class ProductHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        product = Product.objects.filter(productId=product_id).first()
        if not product:
            return Response({"error": "Product not found", "status": "error"}, status=404)

        sales_history = list(
            ProductHistory.objects.filter(productId=product)
            .order_by("date")
            .values("date", "quantity", "costPrice", "retailPrice")
        )
        purchase_rows = list(
            PurchaseHistory.objects.filter(productId=product)
            .select_related("vendorId")
            .order_by("purchaseOrderInsertedTimestamp")
            .values(
                "purchaseOrderId",
                "purchasedQuantity",
                "costPrice",
                "totalCostPrice",
                "purchaseOrderInsertedTimestamp",
                "vendorId__name",
            )
        )

        payload = {
            "id": product.productId,
            "productName": product.productName,
            "sku": product.sku,
            "upc": product.upc,
            "imageUrl": product.imageUrl,
            "availableQuantity": product.availableQuantity,
            "history": [
                {
                    "timestamp": row["date"].strftime("%m-%d-%Y") if row["date"] else None,
                    "quantity": row["quantity"],
                    "costPrice": row["costPrice"],
                    "retailPrice": row["retailPrice"],
                }
                for row in sales_history
            ],
            "purchaseHistory": [
                {
                    "purchaseOrderId": row["purchaseOrderId"],
                    "purchasedQuantity": row["purchasedQuantity"],
                    "costPrice": row["costPrice"],
                    "totalCostPrice": row["totalCostPrice"],
                    "vendorName": row["vendorId__name"],
                    "timestamp": (
                        str(row["purchaseOrderInsertedTimestamp"])
                        if row["purchaseOrderInsertedTimestamp"]
                        else None
                    ),
                }
                for row in purchase_rows
            ],
        }
        return Response({"data": payload, "status": "success"}, status=200)


class FetchCategoriesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Fetch all categories and their subcategories using prefetch_related.
        """
        # Fetch all categories in a single query
        all_categories = Category.objects.all()

        # Create a dictionary for quick lookup by parentId
        categories_by_parent = {}
        for cat in all_categories:
            parent_id = cat.parentId if cat.parentId else None
            if parent_id not in categories_by_parent:
                categories_by_parent[parent_id] = []
            categories_by_parent[parent_id].append(cat)

        def build_category_tree(parent_id=None):
            categories = categories_by_parent.get(parent_id, [])
            tree = []
            for category in categories:
                category_data = {
                    "categoryId": category.categoryId,
                    "name": category.name,
                    "parentId": category.parentId if category.parentId else None,
                    "subcategories": build_category_tree(category.categoryId),
                }
                tree.append(category_data)
            return tree

        category_data = build_category_tree(parent_id=None)  # Start with top-level categories
        return Response({"data": category_data}, status=200)


class FetchVendorsByCategoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, category_id):
        """
        Fetch vendors by category ID.
        """
        vendors = Vendor.objects.filter(purchase_history__productId__categories__categoryId=category_id).distinct()
        vendor_data = [
            {
                "id": vendor.id,
                "name": vendor.name,
            }
            for vendor in vendors
        ]
        return Response({"data": vendor_data}, status=200)


class POMakerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Generate a Purchase Order based on the provided parameters.
        """
        categoryId = request.GET.get("categoryId", None)
        vendorId = request.GET.get("vendorId", None)
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 20))
        loadAll = request.GET.get("loadAll", "false").lower() == "true"

        if categoryId is None or categoryId == "":
            return Response({"error": "Category ID is required."}, status=400)
        category = Category.objects.filter(categoryId=int(categoryId)).first()
        if vendorId is not None and vendorId != "":
            vendor = Vendor.objects.filter(id=vendorId).first()

        def get_all_child_categories(parent_id):
            all_categories = Category.objects.all().iterator()

            children_map = defaultdict(list)
            for cat in all_categories:
                if cat.parentId:
                    children_map[cat.parentId].append(cat)

            all_descendants = []
            nodes_to_visit = list(children_map.get(parent_id, []))

            while nodes_to_visit:
                node = nodes_to_visit.pop()
                all_descendants.append(node)
                children = children_map.get(node.categoryId, [])
                nodes_to_visit.extend(children)

            return all_descendants

        categoryChildList = get_all_child_categories(category.categoryId)
        if not categoryChildList:
            categoryChildList = [category]
        products = Product.objects.filter(categories__in=categoryChildList, availableQuantity__lt=F("minQuantity"), active=True, availableQuantity__gt=0, minQuantity__gt=0).distinct()
        if loadAll:
            products = Product.objects.filter(categories__in=categoryChildList, active=True, availableQuantity__gte=F("minQuantity"), minQuantity=0).distinct()

        if not products.exists():
            return Response({"error": "No products found for the given category."}, status=404)
        if vendorId is not None and vendorId != "":
            products = products.filter(vendorId=vendorId)
        if not products.exists():
            return Response({"error": "No products found for the given vendor."}, status=404)

        # Handle pagination
        totalPages = (products.count() + page_size - 1) // page_size
        products = products[(page - 1) * page_size : page * page_size]
        i = (int(page) - 1) * int(page_size) + 1

        products = products.prefetch_related(Prefetch("purchase_history", queryset=PurchaseHistory.objects.select_related("vendorId").order_by("costPrice", "purchaseOrderInsertedTimestamp"), to_attr="history_records"))

        data = []
        for product in products:
            vendors = {}
            for record in product.history_records:
                if record.vendorId:
                    vendor_key = record.vendorId.id
                    if vendor_key not in vendors:
                        vendors[vendor_key] = {
                            "id": vendor_key,
                            "name": record.vendorId.name,
                            "prices": [],
                            "dates": [],
                        }
                    vendors[vendor_key]["prices"].append(record.costPrice)
                    vendors[vendor_key]["dates"].append(record.purchaseOrderInsertedTimestamp.strftime("%m-%d-%Y"))

            product_data = {
                "index": i,
                "id": product.productId,
                "name": product.productName,
                "sku": product.sku,
                "costPrice": product.costPrice,
                "availableQuantity": product.availableQuantity,
                "minQuantity": product.minQuantity,
                "standardPrice": product.standardPrice,
                "profitPercentage": (product.standardPrice - product.costPrice) * 100 / product.standardPrice if product.standardPrice > 0 else 0,
                "imageUrl": product.imageUrl,
                "vendors": [
                    {
                        "id": key,
                        "name": vendors[key]["name"],
                        "prices": [{"price": price, "date": date} for price, date in zip(vendors[key]["prices"], vendors[key]["dates"])],
                    }
                    for key in vendors.keys()
                ],
            }
            for vendor in product_data["vendors"]:
                if len(vendor["prices"]) > 1:
                    vendor["prices"].sort(key=lambda p: p["price"])

            product_data["vendors"].sort(key=lambda v: v["prices"][0]["price"] if v.get("prices") else float("inf"))
            data.append(product_data)
            i += 1

        return Response({"data": data, "totalPages": totalPages}, status=200)

    def post(self, request):
        """
        Create Purchase Orders based on selected products and vendors.
        Each vendor gets its own PO with corresponding line items.
        """
        try:
            data = json.loads(request.body)
            selected_products = data.get("selected_products", [])

            if not selected_products:
                return Response({"error": "No products selected"}, status=400)

            # Group products by vendor
            vendor_products = defaultdict(list)

            for item in selected_products:
                product_id = item.get("product_id")
                vendor_id = item.get("vendor_id")
                quantity = item.get("quantity", 1)
                unit_price = item.get("unit_price", 0)

                if not product_id or not vendor_id:
                    continue

                vendor_products[vendor_id].append({"product_id": product_id, "quantity": quantity, "unit_price": unit_price, "total_price": quantity * unit_price})

            created_pos = 0

            with transaction.atomic():
                for vendor_id, products in vendor_products.items():
                    try:
                        vendor = Vendor.objects.get(id=vendor_id)
                    except Vendor.DoesNotExist:
                        continue

                    # Check if a PO for this vendor exists for today
                    today = timezone.now().date()
                    po = POLocal.objects.filter(vendor=vendor, insertedTimestamp__date=today).first()
                    if not po:
                        # Create PO for this vendor
                        po = POLocal.objects.create(purchaseOrderId=None, vendor=vendor, status="Pending", insertedTimestamp=timezone.now())  # Auto-generated or can be set later

                    # Create line items for this PO
                    for product_data in products:
                        try:
                            product = Product.objects.get(productId=product_data["product_id"])
                            # Create or update line item for this product in this PO
                            line_item, created = POLocalLineItem.objects.update_or_create(
                                po_local=po,
                                product=product,
                                defaults={
                                    "quantity": product_data["quantity"],
                                    "unitPrice": product_data["unit_price"],
                                    "totalPrice": product_data["total_price"],
                                },
                            )
                        except Product.DoesNotExist:
                            continue
                    # recalculate total amount and quantity for the PO
                    po.totalAmount = sum(item["totalPrice"] for item in POLocalLineItem.objects.filter(po_local=po).values("totalPrice"))
                    po.totalQuantity = sum(item["quantity"] for item in POLocalLineItem.objects.filter(po_local=po).values("quantity"))
                    po.save()
                    created_pos += 1

            return Response({"success": True, "message": f"Successfully created {created_pos} Purchase Orders"}, status=201)

        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON data"}, status=400)
        except Exception as e:
            notifyMe(f"Error creating Purchase Orders: {str(e)}", "101-error")
            return Response({"error": str(e)}, status=500)


class POView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        List Purchase Orders with optional search, status filter, and time period filter.
        Query params:
            - search: search by vendor name (case-insensitive, partial match)
            - status: filter by PO status (exact match)
            - start: filter insertedTimestamp >= start (YYYY-MM-DD)
            - end: filter insertedTimestamp <= end (YYYY-MM-DD)
        """
        poObjs = POLocal.objects.all().order_by("-insertedTimestamp")

        # Search by vendor name
        search = request.GET.get("search")
        if search:
            poObjs = poObjs.filter(vendor__name__icontains=search)

        # Filter by status
        status = request.GET.get("status")
        if status:
            poObjs = poObjs.filter(status=status)

        # Filter by insertedTimestamp (start/end)
        start = request.GET.get("start")
        end = request.GET.get("end")
        if start:
            try:
                start_date = parse_date(start)
                if start_date:
                    poObjs = poObjs.filter(insertedTimestamp__date__gte=start_date)
            except Exception:
                pass
        if end:
            try:
                end_date = parse_date(end)
                if end_date:
                    poObjs = poObjs.filter(insertedTimestamp__date__lte=end_date)
            except Exception:
                pass

        poData = []
        for po in poObjs:
            poData.append({"id": po.id, "vendorId": po.vendor.id, "vendor": po.vendor.name, "status": po.status, "totalAmount": po.totalAmount, "totalQuantity": po.totalQuantity, "insertedTimestamp": po.insertedTimestamp})
        return Response({"purchase_orders": poData}, status=200)

    def post(self, request):
        action = request.data.get("action", "export")
        if action == "export":
            poIds = request.data.get("poIds", [])
            data = []
            for poId in poIds:
                try:
                    po = POLocal.objects.get(id=poId)
                    poItemList = POLocalLineItem.objects.filter(po_local=po).select_related("product")
                    poItems = []
                    for item in poItemList:
                        poItems.append(
                            {
                                "id": item.id,
                                "productId": item.product.productId,
                                "productName": item.product.productName,
                                "sku": item.product.sku,
                                "quantity": item.quantity,
                                "unitPrice": float(item.unitPrice),
                                "totalPrice": float(item.totalPrice),
                            }
                        )
                    data.append(
                        {
                            "id": po.id,
                            "vendorId": po.vendor.id,
                            "vendor": po.vendor.name,
                            "status": po.status,
                            "totalAmount": po.totalAmount,
                            "totalQuantity": po.totalQuantity,
                            "insertedTimestamp": po.insertedTimestamp,
                            "items": poItems,
                        }
                    )
                except POLocal.DoesNotExist:
                    continue
            return Response({"purchase_orders": data}, status=200)
        elif action == "push":
            return Response({"message": "Pushing Purchase Orders..."})
        else:
            return Response({"error": "Invalid action"}, status=400)

    def delete(self, request):
        """
        Delete a Purchase Order by ID.
        """
        po_id = request.GET.get("po_id")
        if not po_id:
            return Response({"error": "Purchase Order ID is required"}, status=400)

        try:
            po = POLocal.objects.get(id=po_id)
            po.delete()
            return Response({"message": "Purchase Order deleted successfully"}, status=200)
        except POLocal.DoesNotExist:
            return Response({"error": "Purchase Order not found"}, status=404)
        except Exception as e:
            notifyMe(f"Error deleting Purchase Order: {str(e)}", "101-error")
            return Response({"error": str(e)}, status=500)


class POLineItemView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, po_id):
        """
        Retrieve line items for a specific Purchase Order.
        """
        try:
            po = POLocal.objects.get(id=po_id)
            line_items = POLocalLineItem.objects.filter(po_local=po).select_related("product")
            data = []
            for item in line_items:
                data.append(
                    {
                        "id": item.id,
                        "productId": item.product.productId,
                        "productName": item.product.productName,
                        "imageUrl": item.product.imageUrl if item.product.imageUrl else None,
                        "sku": item.product.sku,
                        "quantity": item.quantity,
                        "unitPrice": float(item.unitPrice),
                        "totalPrice": float(item.totalPrice),
                    }
                )
            return Response({"line_items": data}, status=200)
        except POLocal.DoesNotExist:
            return Response({"error": "Purchase Order not found"}, status=404)


class HotProductView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categoryId = request.GET.get("categoryId", None)
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 20))

        products = []

        if categoryId is None or categoryId == "":
            products = Product.objects.filter(active=True, isHotProduct=True).distinct()
        else:
            category = Category.objects.filter(categoryId=int(categoryId)).first()

            def get_all_child_categories(parent_id):
                all_categories = Category.objects.all().iterator()

                children_map = defaultdict(list)
                for cat in all_categories:
                    if cat.parentId:
                        children_map[cat.parentId].append(cat)

                all_descendants = []
                nodes_to_visit = list(children_map.get(parent_id, []))

                while nodes_to_visit:
                    node = nodes_to_visit.pop()
                    all_descendants.append(node)
                    children = children_map.get(node.categoryId, [])
                    nodes_to_visit.extend(children)

                return all_descendants

            categoryChildList = get_all_child_categories(category.categoryId)
            if not categoryChildList:
                categoryChildList = [category]

            products = Product.objects.filter(categories__in=categoryChildList, active=True, isHotProduct=True).distinct()

        # Handle pagination
        totalPages = (products.count() + page_size - 1) // page_size
        products = products[(page - 1) * page_size : page * page_size]
        i = (int(page) - 1) * int(page_size) + 1

        data = []

        for product in products:
            temp = {"id": product.productId, "name": product.productName, "imageUrl": product.imageUrl if product.imageUrl else None, "upc": product.upc if product.upc else None, "sku": product.sku if product.sku else None, "quantity": product.availableQuantity if product.availableQuantity else None, "costPrice": float(product.costPrice) if product.costPrice else None, "retailPrice": float(product.stdPrice) if product.stdPrice else None, "masterProductId": product.masterProductId if product.masterProductId else None, "masterProductName": product.masterProductName if product.masterProductName else None}
            data.append(temp)
            i += 1

        return Response({"totalPages": totalPages, "currentPage": page, "pageSize": page_size, "products": data}, status=200)

    def post(self, request):
        upcs = request.data.get("upcs", [])
        # Find products with the given UPCs
        found_products = Product.objects.filter(upc__in=upcs)
        found_upcs = set(found_products.values_list("upc", flat=True))
        not_found_upcs = [upc for upc in upcs if upc not in found_upcs]

        # Update hot products for found UPCs
        found_products.update(isHotProduct=True)

        if not_found_upcs:
            return Response({"message": "Some UPCs not found.", "notFoundUPCs": not_found_upcs}, status=200)
        return Response({"message": "Hot products updated successfully."}, status=200)

    def delete(self, request):
        upcs = request.data.get("upcs", [])
        # Find products with the given UPCs
        found_products = Product.objects.filter(upc__in=upcs)
        found_upcs = set(found_products.values_list("upc", flat=True))
        not_found_upcs = [upc for upc in upcs if upc not in found_upcs]

        # Update hot products for found UPCs
        found_products.update(isHotProduct=False)

        if not_found_upcs:
            return Response({"message": "Some UPCs not found.", "notFoundUPCs": not_found_upcs}, status=200)
        return Response({"message": "Hot products removed successfully."}, status=200)


class ClearanceLossReportView(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            startDate = request.GET.get("startDate")
            if not startDate:
                return Response({"error": "startDate parameter is required."}, status=400)
            try:
                # Convert startDate to datetime object in correct format
                startDate_dt = datetime.datetime.strptime(startDate, "%m/%d/%Y")
                startDate = timezone.make_aware(startDate_dt)
            except Exception as e:
                return Response({"error": f"Invalid startDate format: {e}. Use MM/DD/YYYY."}, status=400)
            endDate = request.GET.get("endDate") or timezone.now()
            if isinstance(endDate, str):
                try:
                    endDate_dt = datetime.datetime.strptime(endDate, "%m/%d/%Y")
                    endDate = timezone.make_aware(endDate_dt)
                except Exception as e:
                    return Response({"error": f"Invalid endDate format: {e}. Use MM/DD/YYYY."}, status=400)
        except Exception as e:
            return Response({"error": f"Invalid date format: {e}"}, status=400)

        try:
            with open("./data/clearance_loss.json", "r") as f:
                monthly_original_costs = json.load(f)
        except FileNotFoundError:
            return Response({"error": "Original cost data file not found."}, status=500)
        except json.JSONDecodeError:
            return Response({"error": "Error decoding original cost data file."}, status=500)

        clearance_products = Product.objects.filter(isClearanceProduct=True).exclude(childProductList=[])
        product_map = {p.productId: p for p in clearance_products}

        product_history = ProductHistory.objects.filter(productId__in=clearance_products.values_list("productId", flat=True), date__range=[startDate, endDate]).select_related("productId").order_by("date")

        monthly_breakdown = defaultdict(lambda: {"totalLoss": 0.0, "productLoss": defaultdict(lambda: {"loss": 0.0, "quantitySoldAtLoss": 0, "name": "", "productId": "", "imageUrl": "", "originalCostMax": 0, "originalCostMin": 10000, "currentCostMax": 0, "currentCostMin": 10000})})

        for entry in product_history:
            if not entry.quantity or not entry.retailPrice:
                continue

            product_id_str = str(entry.productId.productId)
            month_key = entry.date.strftime("%B, %Y")
            original_cost = monthly_original_costs.get(product_id_str, {}).get(month_key, entry.costPrice or entry.productId.standardPrice or 0)
            original_cost = float(original_cost) if entry.costPrice < original_cost else float(entry.costPrice)
            retail_price = float(entry.retailPrice)

            transaction_loss = round(entry.quantity * (retail_price - original_cost), 2)

            if transaction_loss < 0:
                product_id = entry.productId.productId

                monthly_breakdown[month_key]["totalLoss"] += transaction_loss
                product_details = monthly_breakdown[month_key]["productLoss"][product_id]
                product_details["loss"] = round(product_details["loss"] + transaction_loss, 2)
                product_details["quantitySoldAtLoss"] += entry.quantity
                product_details["name"] = entry.productId.productName
                product_details["productId"] = product_id
                product_details["imageUrl"] = entry.productId.imageUrl if entry.productId.imageUrl else None
                product_details["originalCostMax"] = max(product_details["originalCostMax"], original_cost)
                product_details["originalCostMin"] = min(product_details["originalCostMin"], original_cost)
                current_cost = retail_price if retail_price else None
                if current_cost is not None:
                    product_details["currentCostMax"] = max(product_details["currentCostMax"], current_cost)
                    product_details["currentCostMin"] = min(product_details["currentCostMin"], current_cost)

        monthly_breakdown = {month: {"totalLoss": data["totalLoss"], "productLoss": list(data["productLoss"].values())} for month, data in monthly_breakdown.items()}

        overall_total_loss = sum(month["totalLoss"] for month in monthly_breakdown.values())

        return Response({"message": "Monthly Clearance Loss Report", "overallTotalLoss": overall_total_loss, "monthlyBreakdown": monthly_breakdown}, status=200)


class ParLevelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        dataType = request.query_params.get("dataType", "category")

        if dataType == "category":
            par_levels = Category.objects.values("categoryId", "name", "parValueDays", "parentId")
        else:
            par_levels = Product.objects.filter(parValueDays__isnull=False).values("productId", "productName", "parValueDays")

        return Response({"message": "Success", "data": list(par_levels)}, status=200)

    def _get_period_days(self, period_str):
        """Helper function to convert period string to days."""
        periods = {
            "week": 7,
            "month": 30,
            "3month": 90,
            "6month": 180,
            "year": 365,
        }
        return periods.get(period_str, 90)

    @transaction.atomic
    def _handle_product_update(self, changes, period_days):
        """Optimized handler for updating individual product parValueDays."""
        products_to_update = []
        products_to_update_to_none = []
        for change in changes:
            product_id = change.get("productId")
            # CORRECTED: Use parValueDays to match the model field
            par_days = change.get("parValueDays", 0)
            if par_days != 0 and par_days is not None:
                product = Product(productId=product_id, parValueDays=par_days)
                # add logic for calculating minQuantity
                sales_data = ProductHistory.objects.filter(productId=product_id).aggregate(total_quantity=Sum("quantity"))
                total_quantity_sold = sales_data.get("total_quantity", 0)
                if total_quantity_sold is None:
                    total_quantity_sold = 0
                avg_daily_sale = total_quantity_sold / period_days if period_days > 0 else 0
                product.minQuantity = int(avg_daily_sale * par_days)
                products_to_update.append(product)
            else:
                product = Product(productId=product_id)
                product.parValueDays = None
                products_to_update_to_none.append(product)
        if products_to_update:
            Product.objects.bulk_update(products_to_update, ["parValueDays", "minQuantity"])
        if products_to_update_to_none:
            Product.objects.bulk_update(products_to_update_to_none, ["parValueDays"])

    @transaction.atomic
    def _handle_category_update(self, changes, period_days):
        """
        UPDATED: Handler for updating category par levels and recalculating product minQuantities.
        This logic now prioritizes product-specific parValueDays.
        """
        if not changes:
            return

        # Update categories with new parValueDays
        categories_to_update = []
        category_par_map = {}
        for change in changes:
            category_id = change.get("categoryId")
            par_days = change.get("parValueDays")
            if category_id is not None and par_days is not None:
                categories_to_update.append(Category(categoryId=category_id, parValueDays=par_days))
                category_par_map[category_id] = par_days

        if categories_to_update:
            Category.objects.bulk_update(categories_to_update, ["parValueDays"])

        # Fetch sales data for all products in the affected categories
        category_ids = list(category_par_map.keys())
        start_date = timezone.now() - datetime.timedelta(days=period_days)

        sales_data = ProductHistory.objects.filter(productId__categories__categoryId__in=category_ids, date__range=[start_date, timezone.now()]).values("productId").annotate(total_quantity=Sum("quantity"))

        sales_map = {item["productId"]: item["total_quantity"] for item in sales_data}

        # Fetch all products to recalculate their minQuantity
        products_to_recalculate = Product.objects.filter(categories__categoryId__in=category_ids).prefetch_related("categories").distinct()

        products_for_bulk_update = []
        for product in products_to_recalculate:
            effective_par_days = product.parValueDays

            if effective_par_days is None:
                effective_par_days = 10
                for cat in product.categories.all():
                    if cat.categoryId in category_par_map:
                        effective_par_days = category_par_map[cat.categoryId]
                        break

            total_quantity_sold = sales_map.get(product.productId, 0)
            avg_daily_sale = total_quantity_sold / period_days if period_days > 0 else 0
            product.minQuantity = int(avg_daily_sale * effective_par_days)
            products_for_bulk_update.append(product)

        if products_for_bulk_update:
            Product.objects.bulk_update(products_for_bulk_update, ["minQuantity"])

    def post(self, request):
        changes = request.data.get("changes", [])
        dataType = request.data.get("dataType", "category")
        period = request.data.get("period", "3month")
        period_days = self._get_period_days(period)

        if dataType == "category":
            self._handle_category_update(changes, period_days)
        else:  # dataType == 'product'
            self._handle_product_update(changes, period_days)

        return Response({"message": "Parlevel and Minimum Quantity updated successfully"}, status=200)
