import os
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
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
from django.db.models import Sum, F, Avg, Q, Count, When, Case, Value, DecimalField, CharField, OuterRef, Subquery, Max, DateTimeField, Prefetch,ExpressionWrapper
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
            },
        ],
        "connection_timeout_seconds": 2,
    }
)
def notifyMe(message, channel):
    try:
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        data = message
        response = requests.post(f'https://thejagstudio-ntfy.hf.space/{channel}', headers=headers, data=data)
        print(response.text)
    except Exception as e:
        print(f"Error notifying: {e}")
    return



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
            return JsonResponse({"error": "Invalid order parameter"}, status=400)

        total_count = products.count()
        products = products[offset:offset + limit]

        data = {
            "products": list(products.values()),
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
        }
        return JsonResponse(data, safe=False)


class InventorySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.GET.get("report_type", "product")
        measure = request.GET.get("measure", "all")
        start_date = request.GET.get("start_date", None)
        end_date = request.GET.get("end_date", None)
        sort_by = request.GET.get("sort_by", "closing_inventory")
        page = request.GET.get("page", 1)
        page_size = request.GET.get("page_size", 20)
        dataType = request.GET.get("dataType", "total")
        reverse_sort = request.GET.get("reverse_sort", "true").lower() == "true"
        loadSubcategories = request.GET.get("loadSubcategories", "False").lower() == "true"

        products = Product.objects.all()
        if loadSubcategories:
            categories = Category.objects.filter(parentId__isnull=False)
        else:
            categories = Category.objects.filter(parentId__isnull=True)

        if sort_by == "closing_inventory":
            order_by = "availableQuantity"
        elif sort_by == "gross_margin":
            order_by = "TotalGrossMargin"
        elif sort_by == "revenue":
            order_by = "total_revenue"
        elif sort_by == "inventory_cost":
            order_by = "inventory_cost"
        else:
            order_by = "productId"

        if measure == "all":
            pass
        elif measure == "hand":
            products = products.filter(availableQuantity__gt=0)
        elif measure == "low":
            products = products.filter(availableQuantity__lt=10).filter(availableQuantity__gt=0)
        elif measure == "out":
            products = products.filter(availableQuantity=0)
        else:
            return JsonResponse({"error": "Invalid measure type"}, status=400)

        if report_type == "product":
            if sort_by == "revenue":
                products = products.order_by("TotalRevenue")
            elif sort_by == "inventory_cost":
                products = products.annotate(inventory_cost=Abs(F("availableQuantity") * F("standardPrice"))).order_by("inventory_cost")
            else:
                products = products.order_by(order_by)
            if reverse_sort:
                products = products.reverse()
        elif report_type == "category":
            product_aggregation_filter = None

            if measure == "all":
                pass
            elif measure == "hand":
                product_aggregation_filter = Q(products_m2m__availableQuantity__gt=0)
            elif measure == "low":
                product_aggregation_filter = Q(products_m2m__availableQuantity__lt=10, products_m2m__availableQuantity__gt=0)
            elif measure == "out":
                product_aggregation_filter = Q(products_m2m__availableQuantity=0)
            else:
                return JsonResponse({"error": "Invalid measure type"}, status=400)

            if sort_by == "revenue":
                categories = categories.annotate(
                    total_revenue=Sum(
                        Abs(F("products_m2m__TotalRevenue")),
                        filter=product_aggregation_filter,
                        output_field=models.DecimalField(),
                    )
                ).order_by("total_revenue")
            elif sort_by == "inventory_cost":
                categories = categories.annotate(
                    inventory_cost=Sum(
                        Abs(F("products_m2m__availableQuantity") * F("products_m2m__costPrice")),
                        filter=product_aggregation_filter,
                        output_field=models.DecimalField(),
                    )
                ).order_by("inventory_cost")
            elif sort_by == "gross_margin":
                categories = categories.annotate(
                    total_gross_margin=Sum(
                        Abs(F("products_m2m__TotalGrossMargin")),
                        filter=product_aggregation_filter,
                        output_field=models.DecimalField(),
                    )
                ).order_by("total_gross_margin")
            elif sort_by == "closing_inventory":
                categories = categories.annotate(
                    closing_inventory=Sum(
                        Abs(F("products_m2m__availableQuantity")),
                        filter=product_aggregation_filter,
                        output_field=models.DecimalField(),
                    )
                ).order_by("closing_inventory")
            else:
                categories = categories.order_by(order_by)
            if reverse_sort:
                categories = categories.reverse()

        if dataType == "total":
            # calculations
            TotalClosingInventory = (
                products.aggregate(
                    total_closing_inventory=models.Sum(
                        models.Case(
                            models.When(
                                availableQuantity__lt=9999999,
                                then=Abs(F("availableQuantity")),
                            ),
                            default=0,
                            output_field=DecimalField(),
                        )
                    )
                )["total_closing_inventory"]
                or 0
            )
            TotalGrossMargin = Product.objects.aggregate(
                total_gross_margin=Sum(
                    Abs(F("TotalGrossMargin")),
                    output_field=models.DecimalField(),
                )
            )["total_gross_margin"]
            TotalRevenue = Product.objects.aggregate(
                total_revenue=Sum(
                    Abs(F("TotalRevenue")),
                    output_field=models.DecimalField(),
                )
            )["total_revenue"]

            TotalInventoryCost = (
                products.aggregate(
                    total_inventory_cost=models.Sum(
                        Abs(F("availableQuantity") * F("costPrice")),
                        output_field=DecimalField(),
                    )
                )["total_inventory_cost"]
                or 0
            )
            return JsonResponse(
                {
                    "totalClosingInventory": TotalClosingInventory,
                    "totalGrossMargin": TotalGrossMargin,
                    "totalInventoryCost": TotalInventoryCost,
                    "totalRevenue": TotalRevenue,
                }
            )
        else:
            # handle pagination
            start_index = (int(page) - 1) * int(page_size)
            end_index = start_index + int(page_size)
            copyProducts = products

            finalData = []
            i = (int(page) - 1) * int(page_size) + 1

            if report_type == "product":
                totalPossiblePages = (products.count() + int(page_size) - 1) // int(page_size)
                products = products[start_index:end_index]
                for product in products:
                    tempData = {}
                    tempData["id"] = product.productId
                    tempData["index"] = i
                    tempData["name"] = product.productName
                    tempData["closingInventory"] = product.availableQuantity if product.availableQuantity > 0 else 0
                    tempData["revenue"] = product.TotalRevenue
                    tempData["grossProfit"] = product.TotalGrossMargin
                    tempData["inventoryCost"] = (product.availableQuantity * product.standardPrice) if product.availableQuantity > 0 else 0
                    tempData["imageUrl"] = product.imageUrl
                    finalData.append(tempData)
                    i += 1
                return JsonResponse(
                    {"data": finalData, "totalPages": totalPossiblePages},
                )
            elif report_type == "category":
                totalPossiblePages = (categories.count() + int(page_size) - 1) // int(page_size)
                categories = categories[start_index:end_index]
                for category in categories:
                    tempData = {}
                    tempData["id"] = category.categoryId
                    tempData["index"] = i
                    tempData["name"] = category.name
                    tempData["closingInventory"] = (
                        copyProducts.filter(categories__in=[category.categoryId]).aggregate(
                            closingInventory=Sum(
                                Abs(F("availableQuantity")),
                                output_field=models.DecimalField(),
                            )
                        )["closingInventory"]
                        or 0
                    )
                    # Optimize per-category revenue calculation by filtering products first
                    per_category_revenue = (
                        copyProducts.filter(categories__in=[category.categoryId]).aggregate(
                            total_revenue=Sum(
                                Abs(F("TotalRevenue")),
                                output_field=models.DecimalField(),
                            )
                        )["total_revenue"]
                        or 0
                    )

                    tempData["revenue"] = per_category_revenue
                    # Optimize grossProfit calculation by filtering products first
                    per_category_gross_profit = (
                        copyProducts.filter(categories__in=[category.categoryId]).aggregate(
                            total_gross_margin=Sum(
                                Abs(F("TotalGrossMargin")),
                                output_field=models.DecimalField(),
                            )
                        )["total_gross_margin"]
                        or 0
                    )
                    tempData["grossProfit"] = per_category_gross_profit
                    # Optimize inventoryCost calculation by filtering products first
                    per_category_inventory_cost = (
                        copyProducts.filter(categories__in=[category.categoryId]).aggregate(
                            total_inventory_cost=Sum(
                                Abs(F("availableQuantity") * F("costPrice")),
                                output_field=models.DecimalField(),
                            )
                        )["total_inventory_cost"]
                        or 0
                    )
                    tempData["inventoryCost"] = per_category_inventory_cost
                    firstProduct = Product.objects.filter(categories__in=[category.categoryId]).first()
                    if firstProduct:
                        tempData["imageUrl"] = firstProduct.imageUrl
                    else:
                        tempData["imageUrl"] = None
                    finalData.append(tempData)
                    i += 1
                return JsonResponse(
                    {"data": finalData, "totalPages": totalPossiblePages},
                )
            else:
                return JsonResponse({"error": "Invalid report type"}, status=400)

class InventoryReplenishmentView(APIView):
    """
    API View to provide inventory replenishment data.

    This view is optimized to handle large datasets by paginating first
    and then performing expensive calculations only on the data for the
    current page. It supports both product-level and category-level reports.

    Parameters:
    - report_type (str, default='product'): 'product' or 'category'.
    - start_date (str, optional): YYYY-MM-DD. Defaults to 30 days ago.
    - end_date (str, optional): YYYY-MM-DD. Defaults to today.
    - sort_by (str, default='closing_inventory'): Options: 'name', 'closing_inventory', 
      'items_sold_per_day', 'items_sold', 'days_cover', 'average_cost', 'inbound_inventory'.
    - page (int, default=1): The page number.
    - page_size (int, default=20): The number of items per page.
    - reverse_sort (str, default='true'): 'true' for descending, 'False' for ascending.
    - loadSubcategories (str, default='False'): For 'category' report_type. 'true' for subcategories.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. Parse and validate request parameters
        try:
            report_type = request.GET.get("report_type", "product")
            start_date_str = request.GET.get("start_date")
            end_date_str = request.GET.get("end_date")
            sort_by = request.GET.get("sort_by", "closing_inventory")
            page = int(request.GET.get("page", 1))
            page_size = int(request.GET.get("page_size", 20))
            reverse_sort = request.GET.get("reverse_sort", "true").lower() == "true"
            load_subcategories = request.GET.get("loadSubcategories", "False").lower() == "true"
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid parameter type for page or page_size."}, status=400)

        # 2. Date handling
        current_timezone = timezone.get_current_timezone()
        end_date = timezone.now()
        if end_date_str:
            try:
                end_date = timezone.make_aware(datetime.datetime.strptime(end_date_str, "%Y-%m-%d"), current_timezone) + timedelta(days=1, microseconds=-1)
            except ValueError:
                return JsonResponse({"error": "Invalid end_date format. Use YYYY-MM-DD."}, status=400)

        start_date = end_date - timedelta(days=30)
        if start_date_str:
            try:
                start_date = timezone.make_aware(datetime.datetime.strptime(start_date_str, "%Y-%m-%d"), current_timezone)
            except ValueError:
                return JsonResponse({"error": "Invalid start_date format. Use YYYY-MM-DD."}, status=400)

        if start_date > end_date:
            return JsonResponse({"error": "start_date cannot be after end_date"}, status=400)

        days_in_period = max(1, (end_date.date() - start_date.date()).days + 1)

        # 3. Define common query filters
        sales_filter = Q(invoice_line_items__orderId__dueDate__range=(start_date, end_date))
        returns_filter = Q(inventory_records__insertedTimestamp__range=(start_date, end_date), inventory_records__actionType="RETURN")
        po_inbound_filter = Q(purchase_history__purchaseOrderInsertedTimestamp__range=(start_date, end_date))
        transfer_inbound_filter = Q(inventory_records__insertedTimestamp__range=(start_date, end_date), inventory_records__actionType="TRANSFER_IN")
        available_inventory_filter = Q(inventory_records__availableQuantity__gt=0)


        # --- Product Report Implementation ---
        if report_type == "product":
            base_queryset = Product.objects.filter(active=True)
            
            # Annotate for DB-level sorting where efficient
            if sort_by == 'items_sold':
                base_queryset = base_queryset.annotate(
                    items_sold_sort=Coalesce(Sum('invoice_line_items__quantity', filter=sales_filter), Value(0), output_field=DecimalField()) - 
                                  Coalesce(Sum('inventory_records__quantity', filter=returns_filter), Value(0), output_field=DecimalField())
                )
                sort_expression = F('items_sold_sort')
            elif sort_by == 'inbound_inventory':
                 base_queryset = base_queryset.annotate(
                    inbound_sort=Coalesce(Sum('purchase_history__purchasedQuantity', filter=po_inbound_filter), Value(0), output_field=DecimalField()) + 
                                 Coalesce(Sum('inventory_records__quantity', filter=transfer_inbound_filter), Value(0), output_field=DecimalField())
                )
                 sort_expression = F('inbound_sort')
            elif sort_by == 'closing_inventory':
                sort_expression = Coalesce(F('availableQuantity'), Value(0))
            else: # Default to name
                sort_expression = F('productName')

            order = sort_expression.desc(nulls_last=True) if reverse_sort else sort_expression.asc(nulls_first=True)
            paginator = Paginator(base_queryset.order_by(order), page_size)

            try:
                page_objects = paginator.page(page)
            except EmptyPage:
                return JsonResponse({"data": [], "totalPages": paginator.num_pages}, safe=False)

            # Get IDs for the current page to perform batch fetches
            object_ids = [p.productId for p in page_objects.object_list]
            if not object_ids:
                return JsonResponse({"data": [], "totalPages": paginator.num_pages}, safe=False)

            # Batch fetch all required data for the page
            sales_map = {d['productId']: d['total'] for d in Product.objects.filter(productId__in=object_ids).values('productId').annotate(total=Coalesce(Sum('invoice_line_items__quantity', filter=sales_filter), Value(0), output_field=DecimalField()))}
            returns_map = {d['productId']: d['total'] for d in Product.objects.filter(productId__in=object_ids).values('productId').annotate(total=Coalesce(Sum('inventory_records__quantity', filter=returns_filter), Value(0), output_field=DecimalField()))}
            inbound_map = {d['productId']: d['po'] + d['transfer'] for d in Product.objects.filter(productId__in=object_ids).values('productId').annotate(po=Coalesce(Sum('purchase_history__purchasedQuantity', filter=po_inbound_filter), Value(0), output_field=DecimalField()), transfer=Coalesce(Sum('inventory_records__quantity', filter=transfer_inbound_filter), Value(0), output_field=DecimalField()))}
            cost_map_data = Product.objects.filter(productId__in=object_ids).values('productId').annotate(value=Coalesce(Sum(F('inventory_records__availableQuantity') * F('inventory_records__costPrice'), filter=available_inventory_filter), Value(0), output_field=DecimalField()), qty=Coalesce(Sum('inventory_records__availableQuantity', filter=available_inventory_filter), Value(0), output_field=DecimalField()))
            cost_map = {d['productId']: d['value'] / d['qty'] if d['qty'] > 0 else 0 for d in cost_map_data}
            
            final_data = []
            for i, product in enumerate(page_objects.object_list):
                items_sold = sales_map.get(product.productId, 0) - returns_map.get(product.productId, 0)
                avg_items_sold_per_day = items_sold / days_in_period
                days_cover = (product.availableQuantity or 0) / avg_items_sold_per_day if avg_items_sold_per_day > 0 else float('inf')
                
                final_data.append({
                    "id": product.productId,
                    "name": product.productName,
                    "closingInventory": round(product.availableQuantity or 0, 2),
                    "itemsSold": round(items_sold, 2),
                    "itemsSoldPerDay": round(avg_items_sold_per_day, 2),
                    "daysCover": round(days_cover, 2) if days_cover != float('inf') else "0",
                    "averageCost": round(float(cost_map.get(product.productId, product.costPrice or 0)), 2),
                    "inboundInventory": round(inbound_map.get(product.productId, 0), 2),
                    "imageUrl": product.imageUrl,
                    "sku": product.sku,
                    "upc": product.upc,
                })

        # --- Category Report Implementation ---
        elif report_type == "category":
            base_queryset = Category.objects.filter(parentId__isnull=False if load_subcategories else True)

            # Annotate for DB-level sorting
            if sort_by == 'items_sold':
                base_queryset = base_queryset.annotate(
                    sort_val=Coalesce(Sum('products_m2m__invoice_line_items__quantity', filter=sales_filter), Value(0), output_field=DecimalField()) - 
                             Coalesce(Sum('products_m2m__inventory_records__quantity', filter=returns_filter), Value(0), output_field=DecimalField())
                )
            elif sort_by == 'inbound_inventory':
                base_queryset = base_queryset.annotate(
                    sort_val=Coalesce(Sum('products_m2m__purchase_history__purchasedQuantity', filter=po_inbound_filter), Value(0), output_field=DecimalField()) + 
                             Coalesce(Sum('products_m2m__inventory_records__quantity', filter=transfer_inbound_filter), Value(0), output_field=DecimalField())
                )
            elif sort_by == 'closing_inventory':
                base_queryset = base_queryset.annotate(sort_val=Coalesce(Sum('products_m2m__availableQuantity'), Value(0), output_field=DecimalField()))
            else: # Default to name
                base_queryset = base_queryset.annotate(sort_val=F('name'))
            
            order = F('sort_val').desc(nulls_last=True) if reverse_sort else F('sort_val').asc(nulls_first=True)
            paginator = Paginator(base_queryset.order_by(order), page_size)
            
            try:
                page_objects = paginator.page(page)
            except EmptyPage:
                return JsonResponse({"data": [], "totalPages": paginator.num_pages}, safe=False)

            object_ids = [c.categoryId for c in page_objects.object_list]
            if not object_ids:
                return JsonResponse({"data": [], "totalPages": paginator.num_pages}, safe=False)

            # Batch fetch all data for categories on the page
            cat_filter = Q(products_m2m__categories__categoryId__in=object_ids)
            inv_map = {d['products_m2m__categories']: d['total'] for d in Product.objects.filter(cat_filter).values('products_m2m__categories').annotate(total=Coalesce(Sum('availableQuantity'), Value(0), output_field=DecimalField()))}
            sales_map = {d['products_m2m__categories']: d['total'] for d in Product.objects.filter(cat_filter).values('products_m2m__categories').annotate(total=Coalesce(Sum('invoice_line_items__quantity', filter=sales_filter), Value(0), output_field=DecimalField()))}
            returns_map = {d['products_m2m__categories']: d['total'] for d in Product.objects.filter(cat_filter).values('products_m2m__categories').annotate(total=Coalesce(Sum('inventory_records__quantity', filter=returns_filter), Value(0), output_field=DecimalField()))}
            inbound_map = {d['products_m2m__categories']: d['po'] + d['transfer'] for d in Product.objects.filter(cat_filter).values('products_m2m__categories').annotate(po=Coalesce(Sum('purchase_history__purchasedQuantity', filter=po_inbound_filter), Value(0), output_field=DecimalField()), transfer=Coalesce(Sum('inventory_records__quantity', filter=transfer_inbound_filter), Value(0), output_field=DecimalField()))}
            cost_map_data = Product.objects.filter(cat_filter).values('products_m2m__categories').annotate(value=Coalesce(Sum(F('inventory_records__availableQuantity') * F('inventory_records__costPrice'), filter=available_inventory_filter), Value(0), output_field=DecimalField()), qty=Coalesce(Sum('inventory_records__availableQuantity', filter=available_inventory_filter), Value(0), output_field=DecimalField()))
            cost_map = {d['products_m2m__categories']: d['value'] / d['qty'] if d['qty'] > 0 else 0 for d in cost_map_data}
            
            # Efficiently get one image per category
            image_map = {p.categories.first().categoryId: p.imageUrl for p in Product.objects.filter(categories__categoryId__in=object_ids).order_by('categories__categoryId').distinct('categories__categoryId')}

            final_data = []
            for i, category in enumerate(page_objects.object_list):
                cat_id = category.categoryId
                closing_inventory = inv_map.get(cat_id, 0)
                items_sold = sales_map.get(cat_id, 0) - returns_map.get(cat_id, 0)
                avg_items_sold_per_day = items_sold / days_in_period
                days_cover = closing_inventory / avg_items_sold_per_day if avg_items_sold_per_day > 0 else float('inf')

                final_data.append({
                    "id": cat_id, "index": page_objects.start_index() + i, "name": category.name,
                    "closingInventory": round(closing_inventory, 2),
                    "itemsSold": round(items_sold, 2),
                    "itemsSoldPerDay": round(avg_items_sold_per_day, 2),
                    "daysCover": round(days_cover, 2) if days_cover != float('inf') else "0",
                    "averageCost": round(float(cost_map.get(cat_id, 0)), 2),
                    "inboundInventory": round(inbound_map.get(cat_id, 0), 2),
                    "imageUrl": image_map.get(cat_id),
                })
        else:
            return JsonResponse({"error": "Invalid report type. Must be 'product' or 'category'."}, status=400)

        # Python-level sorting for complex calculated fields (same for both report types)
        if sort_by in ['items_sold_per_day', 'days_cover', 'average_cost']:
            def sort_key(x):
                val = x[sort_by]
                if val == "N/A":
                    return float('inf')
                # Handle cases where val might be None or not a number, default to 0
                return val if isinstance(val, (int, float)) else 0
            
            final_data.sort(key=sort_key, reverse=reverse_sort)

        return JsonResponse({"data": final_data, "totalPages": paginator.num_pages}, safe=False)
    
class DustyInventoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Handle GET requests to fetch dusty inventory report.
        """
        days_threshold = request.GET.get('_days_threshold', '90')
        end_date = request.GET.get('_end_date', None)
        load_subcategory = request.GET.get('_load_subcategory', 'False').lower() == 'true'
        measure = request.GET.get('_measure', 'dusty')
        page_num = request.GET.get('_page_num', '1')
        page_size = request.GET.get('_page_size', '20')
        report_type = request.GET.get('_report_type', 'product')
        sort_by = request.GET.get('_sort_by', 'last_sale')
        reverse_sort = request.GET.get('_reverse_sort', 'true').lower() == 'true'
        start_date = request.GET.get('_start_date', None)
        
        
        headers = {
            'Content-Type': 'application/json',
            'apikey': settings.SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + settings.SUPABASE_ANON_KEY,
        }

        json_data = {
            '_days_threshold': days_threshold,
            '_end_date': end_date,
            '_load_subcategory': load_subcategory,
            '_measure': measure,
            '_page_num': page_num,
            '_page_size': page_size,
            '_report_type': report_type,
            '_reverse_sort': reverse_sort,
            '_sort_by': sort_by,
            '_start_date': start_date,
        }
        json_data_count = {
            '_days_threshold': days_threshold,
            '_end_date': end_date,
            '_load_subcategory': load_subcategory,
            '_measure': measure,
            '_report_type': report_type,
            '_start_date': start_date,
        }
        try:
            response = requests.post(settings.SUPABASE_URL + '/rest/v1/rpc/get_dusty_inventory', headers=headers, json=json_data)
            data = response.json()
            try:
                response2 = requests.post(settings.SUPABASE_URL + '/rest/v1/rpc/get_dusty_inventory_count', headers=headers, json=json_data_count)
                total_records = response2.text
            except requests.RequestException as e:
                total_records = 0
                return JsonResponse({"error": str(e) + " : Count API error"}, status=500)
            return JsonResponse({"data": data, "totalPages": total_records}, status=200, safe=False)
        except requests.RequestException as e:
            return JsonResponse({"error": str(e) + " : List API error"}, status=500)
    
    
class ProductHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        """
        Retrieve the history of a specific product by its ID.
        """
        try:
            product = Product.objects.get(productId=product_id)
            history = {
                "id": product.productId,
                "productName": product.productName,
                "sku": product.sku,
                "upc": product.upc,
                "imageUrl": product.imageUrl,
                "availableQuantity": product.availableQuantity,
                "history": [
                    {
                        "timestamp": history.date.strftime("%m-%d-%Y"),
                        "quantity": history.quantity,
                        "costPrice": history.costPrice,
                        "retailPrice": history.retailPrice,
                    }
                    for history in ProductHistory.objects.filter(productId=product).order_by("date")
                ],
                "purchaseHistory": [
                    {
                        "purchaseOrderId": history.purchaseOrderId,
                        "purchasedQuantity": history.purchasedQuantity,
                        "costPrice": history.costPrice,
                        "totalCostPrice": history.totalCostPrice,
                        "vendorName": history.vendorId.name if history.vendorId else None,
                        "timestamp": str(history.purchaseOrderInsertedTimestamp) if history.purchaseOrderInsertedTimestamp else None,
                    }
                    for history in PurchaseHistory.objects.filter(productId=product).order_by("purchaseOrderInsertedTimestamp")
                ],
            }
            return JsonResponse({"data": history, "status": "success"}, status=200)
        except Product.DoesNotExist:
            return JsonResponse({"error": "Product not found", "status": "error"}, status=404)


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
        return JsonResponse({"data": category_data}, status=200)


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
        return JsonResponse({"data": vendor_data}, status=200)


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
            return JsonResponse({"error": "Category ID is required."}, status=400)
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
            return JsonResponse({"error": "No products found for the given category."}, status=404)
        if vendorId is not None and vendorId != "":
            products = products.filter(vendorId=vendorId)
        if not products.exists():
            return JsonResponse({"error": "No products found for the given vendor."}, status=404)

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

        return JsonResponse({"data": data, "totalPages": totalPages}, status=200)
    
    def post(self, request):
        """
        Create Purchase Orders based on selected products and vendors.
        Each vendor gets its own PO with corresponding line items.
        """
        try:
            data = json.loads(request.body)
            selected_products = data.get('selected_products', [])
            
            if not selected_products:
                return JsonResponse({'error': 'No products selected'}, status=400)
            
            # Group products by vendor
            vendor_products = defaultdict(list)
            
            for item in selected_products:
                product_id = item.get('product_id')
                vendor_id = item.get('vendor_id')
                quantity = item.get('quantity', 1)
                unit_price = item.get('unit_price', 0)
                
                if not product_id or not vendor_id:
                    continue
                    
                vendor_products[vendor_id].append({
                    'product_id': product_id,
                    'quantity': quantity,
                    'unit_price': unit_price,
                    'total_price': quantity * unit_price
                })
            
            created_pos = 0
            
            with transaction.atomic():
                for vendor_id, products in vendor_products.items():
                    try:
                        vendor = Vendor.objects.get(id=vendor_id)
                    except Vendor.DoesNotExist:
                        continue
                                        
                    # Check if a PO for this vendor exists for today
                    today = timezone.now().date()
                    po = POLocal.objects.filter(
                        vendor=vendor,
                        insertedTimestamp__date=today
                    ).first()
                    if not po:
                        # Create PO for this vendor
                        po = POLocal.objects.create(
                            purchaseOrderId=None,  # Auto-generated or can be set later
                            vendor=vendor,
                            status='Pending',
                            insertedTimestamp=timezone.now()
                        )
                    
                    # Create line items for this PO
                    for product_data in products:
                        try:
                            product = Product.objects.get(productId=product_data['product_id'])
                            # Create or update line item for this product in this PO
                            line_item, created = POLocalLineItem.objects.update_or_create(
                                po_local=po,
                                product=product,
                                defaults={
                                    'quantity': product_data['quantity'],
                                    'unitPrice': product_data['unit_price'],
                                    'totalPrice': product_data['total_price'],
                                }
                            )
                        except Product.DoesNotExist:
                            continue
                    # recalculate total amount and quantity for the PO
                    po.totalAmount = sum(item['totalPrice'] for item in POLocalLineItem.objects.filter(po_local=po).values('totalPrice'))
                    po.totalQuantity = sum(item['quantity'] for item in POLocalLineItem.objects.filter(po_local=po).values('quantity'))
                    po.save()
                    created_pos += 1
            
            return JsonResponse({
                'success': True,
                'message': f'Successfully created {created_pos} Purchase Orders'
            }, status=201)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            notifyMe(f"Error creating Purchase Orders: {str(e)}", "101-error")
            return JsonResponse({'error': str(e)}, status=500)
    

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
            poData.append({
                "id": po.id,
                "vendorId": po.vendor.id,
                "vendor": po.vendor.name,
                "status": po.status,
                "totalAmount": po.totalAmount,
                "totalQuantity": po.totalQuantity,
                "insertedTimestamp": po.insertedTimestamp
            })
        return JsonResponse({"purchase_orders": poData}, status=200)

    def post(self, request):
        action = request.data.get("action","export")
        if action == "export":
            poIds = request.data.get("poIds", [])
            data = []
            for poId in poIds:
                try:
                    po = POLocal.objects.get(id=poId)
                    poItemList = POLocalLineItem.objects.filter(po_local=po).select_related('product')
                    poItems = []
                    for item in poItemList:
                        poItems.append({
                            "id": item.id,
                            "productId": item.product.productId,
                            "productName": item.product.productName,
                            "sku": item.product.sku,
                            "quantity": item.quantity,
                            "unitPrice": float(item.unitPrice),
                            "totalPrice": float(item.totalPrice),
                        })
                    data.append({
                        "id": po.id,
                        "vendorId": po.vendor.id,
                        "vendor": po.vendor.name,
                        "status": po.status,
                        "totalAmount": po.totalAmount,
                        "totalQuantity": po.totalQuantity,
                        "insertedTimestamp": po.insertedTimestamp,
                        "items": poItems,
                    })
                except POLocal.DoesNotExist:
                    continue
            return JsonResponse({"purchase_orders": data}, status=200)
        elif action == "push":
            return JsonResponse({"message": "Pushing Purchase Orders..."})
        else:
            return JsonResponse({"error": "Invalid action"}, status=400)

    def delete(self, request):
        """
        Delete a Purchase Order by ID.
        """
        po_id = request.GET.get("po_id")
        if not po_id:
            return JsonResponse({"error": "Purchase Order ID is required"}, status=400)

        try:
            po = POLocal.objects.get(id=po_id)
            po.delete()
            return JsonResponse({"message": "Purchase Order deleted successfully"}, status=200)
        except POLocal.DoesNotExist:
            return JsonResponse({"error": "Purchase Order not found"}, status=404)
        except Exception as e:
            notifyMe(f"Error deleting Purchase Order: {str(e)}", "101-error")
            return JsonResponse({"error": str(e)}, status=500)

class POLineItemView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, po_id):
        """
        Retrieve line items for a specific Purchase Order.
        """
        try:
            po = POLocal.objects.get(id=po_id)
            line_items = POLocalLineItem.objects.filter(po_local=po).select_related('product')
            data = []
            for item in line_items:
                data.append({
                    "id": item.id,
                    "productId": item.product.productId,
                    "productName": item.product.productName,
                    'imageUrl': item.product.imageUrl if item.product.imageUrl else None,
                    "sku": item.product.sku,
                    "quantity": item.quantity,
                    "unitPrice": float(item.unitPrice),
                    "totalPrice": float(item.totalPrice),
                })
            return JsonResponse({"line_items": data}, status=200)
        except POLocal.DoesNotExist:
            return JsonResponse({"error": "Purchase Order not found"}, status=404)

