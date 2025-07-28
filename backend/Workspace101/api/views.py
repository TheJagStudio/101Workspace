import os
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
import typesense
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import (
    Product,
    Category,
    BusinessType,
    InventoryData,
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
from ollama import Client as OllamaClient
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
ollamaClient = OllamaClient(host="http://217.196.49.245:11434")
ai_agent = DjangoAIAgent()

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



class SearchProductsView(APIView):
    def get(self, request):
        """
        Search products based on query parameters.
        """
        query = request.GET.get("query", "")
        search_parameters = {"q": query, "query_by": "productName,sku,upc"}
        try:
            data = client.collections["101"].documents.search(search_parameters)
            return JsonResponse(data["hits"], safe=False)
        except typesense.exceptions.ObjectNotFound:
            notifyMe("Search Error: Typesense collection not found.", "101-error")
            return JsonResponse({"error": "Typesense collection not found."}, status=404)

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


class SyncSalesgentTokenView(APIView):
    permission_classes = []

    def post(self, request):
        """
        Sync Salesgent token with the database.
        """
        username = request.data.get("username")
        password = request.data.get("password")
        # authenticate the user
        if not username or not password:
            return JsonResponse({"error": "Username and password are required.", "status": "failed"}, status=400)
        user = User.objects.filter(username=username).first()
        if not user or not user.check_password(password):
            return JsonResponse({"error": "Invalid username or password.", "status": "failed"}, status=401)

        entry = SalesgentToken.objects.first()
        if not entry:
            return JsonResponse({"error": "No Salesgent token found.", "status": "failed"}, status=404)
        refresh_token = entry.refreshToken
        headers = {
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
            "refreshToken": refresh_token,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Pragma": "no-cache",
            "Referer": "https://erp.101distributorsga.com/product",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "device-id": "07b17521-b821-41fd-beea-22679d5ef98f",
            "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }

        response = requests.post("https://erp.101distributorsga.com/api/refreshToken", headers=headers)
        data = response.json()["result"]
        entry.accessToken = data.get("access")
        entry.refreshToken = data.get("refresh")
        entry.save()
        return JsonResponse({"message": "Token synced successfully.", "status": "success"}, status=200)


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

# class InventoryReplenishmentView(APIView):
#     """
#     API View to provide inventory replenishment data.

#     This view calculates various inventory metrics such as:
#     - Closing Inventory: Amount of inventory at the end of the reporting period.
#     - Items Sold per Day (Average): Average number of items sold daily within the period.
#     - Items Sold: Total items sold minus returns within the reporting period.
#     - Days Cover: Estimated days current inventory will last based on average daily sales.
#     - Average Cost: Weighted average cost of available inventory at the end of the period.
#     - Inbound Inventory: Total incoming inventory from purchase orders and transfers.

#     Parameters:
#     - report_type (str, default='product'): 'product' for per-product data, 'category' for aggregated category data.
#     - start_date (str, optional): Start date for the reporting period (YYYY-MM-DD). Defaults to 30 days ago if not provided.
#     - end_date (str, optional): End date for the reporting period (YYYY-MM-DD). Defaults to today if not provided.
#     - sort_by (str, default='closing_inventory'): Field to sort the results by.
#       Options: 'closing_inventory', 'items_sold_per_day', 'items_sold', 'days_cover', 'average_cost', 'inbound_inventory', 'name'.
#     - page (int, default=1): The page number for pagination.
#     - page_size (int, default=20): The number of items per page.
#     - reverse_sort (str, default='true'): 'true' for descending order, 'False' for ascending.
#     - loadSubcategories (str, default='False'): Only applicable for 'category' report_type.
#       'true' to load subcategories, 'False' to load top-level categories.
#     """

#     permission_classes = [IsAuthenticated]

#     def get(self, request):
#         # 1. Parse and validate request parameters
#         report_type = request.GET.get("report_type", "product")
#         start_date_str = request.GET.get("start_date", None)
#         end_date_str = request.GET.get("end_date", None)
#         sort_by = request.GET.get("sort_by", "closing_inventory")
#         page = int(request.GET.get("page", 1))
#         page_size = int(request.GET.get("page_size", 20))
#         reverse_sort = request.GET.get("reverse_sort", "true").lower() == "true"
#         load_subcategories = request.GET.get("loadSubcategories", "False").lower() == "true"

#         # 2. Convert date strings to timezone-aware datetime objects
#         start_date = None
#         end_date = None
#         current_timezone = timezone.get_current_timezone()

#         if end_date_str:
#             try:
#                 # Set end_date to the very end of the specified day
#                 end_date = timezone.make_aware(datetime.datetime.strptime(end_date_str, "%Y-%m-%d"), current_timezone) + timedelta(days=1, microseconds=-1)
#             except ValueError:
#                 return JsonResponse({"error": "Invalid end_date format. Use YYYY-MM-DD."}, status=400)
#         else:
#             # Default end_date to current time
#             end_date = timezone.now()

#         if start_date_str:
#             try:
#                 # Set start_date to the beginning of the specified day
#                 start_date = timezone.make_aware(datetime.datetime.strptime(start_date_str, "%Y-%m-%d"), current_timezone)
#             except ValueError:
#                 return JsonResponse({"error": "Invalid start_date format. Use YYYY-MM-DD."}, status=400)
#         else:
#             # Default start_date to 30 days before end_date
#             start_date = end_date - timedelta(days=30)

#         # Ensure start_date is not after end_date
#         if start_date and end_date and start_date > end_date:
#             return JsonResponse({"error": "start_date cannot be after end_date"}, status=400)

#         # Calculate the number of full days in the reporting period
#         # Handle cases where start_date and end_date might be the same day, resulting in 0 days difference.
#         # Adding 1 to include both start and end days.
#         days_in_period = (end_date.date() - start_date.date()).days + 1 if start_date and end_date else 1
#         if days_in_period <= 0:  # Ensure days_in_period is at least 1 for division
#             days_in_period = 1

#         # 3. Define common filters for sales and returns based on the date range
#         # Sales are tracked via InvoiceLineItem related to Product
#         sales_filter = Q(invoice_line_items__orderId__dueDate__range=(start_date, end_date))
#         # Returns are assumed to be recorded in InventoryData with actionType='RETURN'
#         returns_filter = Q(inventory_records__insertedTimestamp__range=(start_date, end_date), inventory_records__actionType="RETURN")
#         # Inbound from Purchase Orders are from PurchaseHistory
#         po_inbound_filter = Q(purchase_history__purchaseOrderInsertedTimestamp__range=(start_date, end_date))
#         # Inbound from Transfers are assumed to be recorded in InventoryData with actionType='TRANSFER_IN'
#         transfer_inbound_filter = Q(inventory_records__insertedTimestamp__range=(start_date, end_date), inventory_records__actionType="TRANSFER_IN")

#         # Filter for available inventory for average cost calculation
#         available_inventory_filter = Q(inventory_records__availableQuantity__gt=0)

#         if report_type == "product":
#             # Start with all products
#             products_queryset = Product.objects.filter(active=True)
#             # Annotate each product with the required aggregated data for the period
#             products_data = products_queryset.annotate(
#                 # total_sales_quantity: Sum of quantities from all sales within the period
#                 total_sales_quantity=Sum(F("invoice_line_items__quantity"), filter=sales_filter, output_field=DecimalField()),
#                 # total_returned_quantity: Sum of quantities from all returns within the period
#                 total_returned_quantity=Sum(F("inventory_records__quantity"), filter=returns_filter, output_field=DecimalField()),
#                 # total_inbound_from_po: Sum of purchased quantities from purchase orders within the period
#                 total_inbound_from_po=Sum(F("purchase_history__purchasedQuantity"), filter=po_inbound_filter, output_field=DecimalField()),
#                 # total_inbound_from_transfer: Sum of quantities from incoming transfers within the period
#                 total_inbound_from_transfer=Sum(F("inventory_records__quantity"), filter=transfer_inbound_filter, output_field=DecimalField()),
#                 # total_available_cost_value: Sum of (availableQuantity * costPrice) for currently available items
#                 # used for calculating weighted average cost of current inventory
#                 total_available_cost_value=Sum(F("inventory_records__availableQuantity") * F("inventory_records__costPrice"), filter=available_inventory_filter, output_field=DecimalField()),
#                 # total_available_quantity_for_cost: Sum of availableQuantity for currently available items
#                 # used for calculating weighted average cost of current inventory
#                 total_available_quantity_for_cost=Sum(F("inventory_records__availableQuantity"), filter=available_inventory_filter, output_field=DecimalField()),
#             )
#             print(f"Products Data Count: {products_data.count()}")
#             final_data = []
#             for product in products_data:
#                 # Calculate Items Sold: Total sales minus total returns
#                 items_sold = product.total_sales_quantity or 0

#                 # Calculate Items Sold per Day (Average)
#                 avg_items_sold_per_day = items_sold / days_in_period

#                 # Closing Inventory: Directly from product's availableQuantity
#                 closing_inventory = product.availableQuantity if product.availableQuantity is not None else 0

#                 # Calculate Days Cover: Handle division by zero to avoid errors
#                 days_cover = closing_inventory / avg_items_sold_per_day if avg_items_sold_per_day > 0 else float("inf")  # Set to infinity if no sales

#                 # Calculate Average Cost: Weighted average of available inventory.
#                 # Fallback to product's costPrice if no specific inventory records or quantities are available.
#                 average_cost = (product.total_available_cost_value / product.total_available_quantity_for_cost) if (product.total_available_cost_value is not None and product.total_available_quantity_for_cost and product.total_available_quantity_for_cost > 0) else (product.costPrice if product.costPrice is not None else 0)

#                 # Calculate Inbound Inventory: Sum of inbound from PO and transfers
#                 inbound_inventory = (product.total_inbound_from_po or 0) + (product.total_inbound_from_transfer or 0)

#                 final_data.append(
#                     {
#                         "id": product.productId,
#                         "name": product.productName,
#                         "closingInventory": round(closing_inventory, 2),
#                         "itemsSoldPerDay": round(avg_items_sold_per_day, 2),
#                         "itemsSold": round(items_sold, 2),
#                         "daysCover": round(days_cover, 2) if days_cover != float("inf") else "N/A",  # Return "N/A" for infinity
#                         "averageCost": round(average_cost, 2),
#                         "inboundInventory": round(inbound_inventory, 2),
#                         "imageUrl": product.imageUrl,
#                         "sku": product.sku,
#                         "upc": product.upc,
#                     }
#                 )

#             # Sort the data based on the requested sort_by parameter.
#             # Sorting is done in Python because some metrics are calculated after database query.
#             if sort_by == "closing_inventory":
#                 final_data.sort(key=lambda x: x["closingInventory"], reverse=reverse_sort)
#             elif sort_by == "items_sold_per_day":
#                 final_data.sort(key=lambda x: x["itemsSoldPerDay"], reverse=reverse_sort)
#             elif sort_by == "items_sold":
#                 final_data.sort(key=lambda x: x["itemsSold"], reverse=reverse_sort)
#             elif sort_by == "days_cover":
#                 # Handle "N/A" (infinity) when sorting daysCover
#                 final_data.sort(key=lambda x: x["daysCover"] if x["daysCover"] != "N/A" else float("inf"), reverse=reverse_sort)
#             elif sort_by == "average_cost":
#                 final_data.sort(key=lambda x: x["averageCost"], reverse=reverse_sort)
#             elif sort_by == "inbound_inventory":
#                 final_data.sort(key=lambda x: x["inboundInventory"], reverse=reverse_sort)
#             else:
#                 # Default sort by product name if no valid sort_by provided
#                 final_data.sort(key=lambda x: x["name"], reverse=reverse_sort)

#             # Apply pagination to the sorted data
#             total_possible_pages = (len(final_data) + page_size - 1) // page_size
#             start_index = (page - 1) * page_size
#             end_index = start_index + page_size
#             paginated_data = final_data[start_index:end_index]

#             # Add an index to each item in the paginated data
#             for i, item in enumerate(paginated_data):
#                 item["index"] = start_index + i + 1

#             return JsonResponse({"data": paginated_data, "totalPages": total_possible_pages}, safe=False)  # Set safe=False when returning a list or dictionary containing a list

#         elif report_type == "category":
#             # Start with all categories
#             categories_queryset = Category.objects.all()
#             if not load_subcategories:
#                 # Filter for top-level categories if subcategories are not requested
#                 categories_queryset = categories_queryset.filter(parentId__isnull=True)
#             else:
#                 # Filter for subcategories if requested
#                 categories_queryset = categories_queryset.filter(parentId__isnull=False)

#             # Annotate categories with aggregated product data for the period
#             # Aggregations are done across all products linked to each category via products_m2m
#             categories_data = categories_queryset.annotate(
#                 # Sum of availableQuantity for all products within the category (Category Closing Inventory)
#                 category_closing_inventory=Sum(F("products_m2m__availableQuantity"), output_field=DecimalField()),
#                 # Aggregated sales quantity for all products in the category
#                 category_total_sales_quantity=Sum(F("products_m2m__invoice_line_items__quantity"), filter=sales_filter, output_field=DecimalField()),
#                 # Aggregated returned quantity for all products in the category
#                 category_total_returned_quantity=Sum(F("products_m2m__inventory_records__quantity"), filter=returns_filter, output_field=DecimalField()),
#                 # Aggregated inbound from PO for all products in the category
#                 category_total_inbound_from_po=Sum(F("products_m2m__purchase_history__purchasedQuantity"), filter=po_inbound_filter, output_field=DecimalField()),
#                 # Aggregated inbound from Transfers for all products in the category
#                 category_total_inbound_from_transfer=Sum(F("products_m2m__inventory_records__quantity"), filter=transfer_inbound_filter, output_field=DecimalField()),
#                 # Total value of available inventory for the category (for weighted average cost)
#                 category_total_available_cost_value=Sum(F("products_m2m__inventory_records__availableQuantity") * F("products_m2m__inventory_records__costPrice"), filter=available_inventory_filter, output_field=DecimalField()),
#                 # Total available quantity for the category (for weighted average cost)
#                 category_total_available_quantity_for_cost=Sum(F("products_m2m__inventory_records__availableQuantity"), filter=available_inventory_filter, output_field=DecimalField()),
#             )

#             final_data = []
#             for category in categories_data:
#                 # Calculate Items Sold for the category
#                 items_sold = (category.category_total_sales_quantity or 0) - (category.category_total_returned_quantity or 0)

#                 # Calculate Items Sold per Day (Average) for the category
#                 avg_items_sold_per_day = items_sold / days_in_period

#                 # Closing Inventory for the category
#                 closing_inventory = category.category_closing_inventory if category.category_closing_inventory is not None else 0

#                 # Calculate Days Cover for the category
#                 days_cover = closing_inventory / avg_items_sold_per_day if avg_items_sold_per_day > 0 else float("inf")

#                 # Calculate Average Cost for the category: Weighted average of available inventory within the category
#                 average_cost = (category.category_total_available_cost_value / category.category_total_available_quantity_for_cost) if (category.category_total_available_cost_value is not None and category.category_total_available_quantity_for_cost and category.category_total_available_quantity_for_cost > 0) else 0  # If no available inventory for cost calculation in category

#                 # Calculate Inbound Inventory for the category
#                 inbound_inventory = (category.category_total_inbound_from_po or 0) + (category.category_total_inbound_from_transfer or 0)

#                 # Get an image URL from the first product associated with the category, if available
#                 first_product_image_url = None
#                 first_product = Product.objects.filter(categories__in=[category.categoryId]).first()
#                 if first_product:
#                     first_product_image_url = first_product.imageUrl

#                 final_data.append(
#                     {
#                         "id": category.categoryId,
#                         "name": category.name,
#                         "closingInventory": round(closing_inventory, 2),
#                         "itemsSoldPerDay": round(avg_items_sold_per_day, 2),
#                         "itemsSold": round(items_sold, 2),
#                         "daysCover": round(days_cover, 2) if days_cover != float("inf") else "N/A",
#                         "averageCost": round(average_cost, 2),
#                         "inboundInventory": round(inbound_inventory, 2),
#                         "imageUrl": first_product_image_url,
#                     }
#                 )

#             # Sort the data based on the requested sort_by parameter.
#             # Sorting is done in Python because some metrics are calculated after database query.
#             if sort_by == "closing_inventory":
#                 final_data.sort(key=lambda x: x["closingInventory"], reverse=reverse_sort)
#             elif sort_by == "items_sold_per_day":
#                 final_data.sort(key=lambda x: x["itemsSoldPerDay"], reverse=reverse_sort)
#             elif sort_by == "items_sold":
#                 final_data.sort(key=lambda x: x["itemsSold"], reverse=reverse_sort)
#             elif sort_by == "days_cover":
#                 # Handle "N/A" (infinity) when sorting daysCover
#                 final_data.sort(key=lambda x: x["daysCover"] if x["daysCover"] != "N/A" else float("inf"), reverse=reverse_sort)
#             elif sort_by == "average_cost":
#                 final_data.sort(key=lambda x: x["averageCost"], reverse=reverse_sort)
#             elif sort_by == "inbound_inventory":
#                 final_data.sort(key=lambda x: x["inboundInventory"], reverse=reverse_sort)
#             else:
#                 # Default sort by category name if no valid sort_by provided
#                 final_data.sort(key=lambda x: x["name"], reverse=reverse_sort)

#             # Apply pagination to the sorted data
#             total_possible_pages = (len(final_data) + page_size - 1) // page_size
#             start_index = (page - 1) * page_size
#             end_index = start_index + page_size
#             paginated_data = final_data[start_index:end_index]

#             # Add an index to each item in the paginated data
#             for i, item in enumerate(paginated_data):
#                 item["index"] = start_index + i + 1

#             return JsonResponse({"data": paginated_data, "totalPages": total_possible_pages}, safe=False)  # Set safe=False when returning a list or dictionary containing a list

#         else:
#             return JsonResponse({"error": "Invalid report type. Must be 'product' or 'category'."}, status=400)


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



# ===========================================================================================================


class dataMaker(APIView):
    permission_classes = []

    def get(self, request):
        """
        Generate data for testing purposes by reading invoice line items from JSON files.
        """
        products  = Product.objects.all()
        # I need a mapping for these products in following columns
        # Product Category,Product Subcategory,Product Name,Product Description,Price,Cost,Barcode,Active,Attribute type,Attribute parent,Attribute 1,Attribute value 1,Image Url

        product_data = []
        master_products_cache = {p.productId: {
            "upc": p.upc,
            "singleUpc": p.singleUpc
        } for p in Product.objects.filter(masterProductId__isnull=True)}
        for product in products:
            print(product.productName)
            if "deleted" not in str(product.singleUpc).lower() and "deleted" not in str(product.upc).lower():
                deleted = False
                if product.masterProductId:
                    master_product = master_products_cache.get(product.masterProductId)
                    if master_product:
                        if "deleted" in str(master_product["upc"]).lower() or "deleted" in str(master_product["singleUpc"]).lower():
                            deleted = True

                if not deleted:
                    product_data.append({
                        "id": product.productId,
                        "Product Category": None,
                        "Product Subcategory": None,  # No direct subcategory field in Product model
                        "Product Name": product.productName,
                        "Product Description": product.shortDescription if product.shortDescription else product.fullDescription,
                        "Price": float(product.standardPrice) if product.standardPrice is not None else None,
                        "Cost": float(product.costPrice) if product.costPrice is not None else None,
                        "Barcode": product.singleUpc if product.masterProductId else product.upc,
                        "Master Product Barcode": master_product["upc"] if product.masterProductId and master_product else None,
                        "Active": product.active,
                        "Attribute type": "Child" if product.masterProductId else "Parent",
                        "Attribute parent": None,  # No direct attribute_parent field
                        "Attribute 1": None,      # No direct attribute_1 field
                        "Attribute value 1": None, # No direct attribute_value_1 field
                        "Image Url": product.imageUrl,
                    })
        # Convert to csv format
        import pandas as pd
        df = pd.DataFrame(product_data)
        csv_file_path = 'product_data.csv'
        df.to_csv(csv_file_path, index=False)
        return JsonResponse({"message": "Successfully done"})


class vacuum_sqlite_database(APIView):
    permission_classes = []

    def get(self, request):
        """
        Runs the SQLite VACUUM command to reclaim unused space and optimize the database file size.
        """
        print("Starting SQLite VACUUM operation...")
        try:
            with connection.cursor() as cursor:
                cursor.execute("VACUUM;")
            print("SQLite VACUUM completed successfully.")
            return JsonResponse({"message": "SQLite VACUUM completed successfully."})
        except Exception as e:
            print(f"Error during SQLite VACUUM: {e}")
            return JsonResponse({"error": str(e)}, status=500)


class ChatWithAIAgentView(APIView):
    permission_classes = []  # Adjust as needed (e.g., [IsAuthenticated])

    @csrf_exempt  # For demonstration; use proper CSRF protection in production
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        try:
            data = json.loads(request.body)
            user_query = data.get("query")

            if not user_query:
                return Response({"error": "No query provided"}, status=400)

            agent_response = ai_agent.query_database(user_query)
            return Response({"response": agent_response})

        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=500)


class AIReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Handle GET requests for AI reports.
        """
        reportName = request.GET.get("reportName", None)
        if not reportName:
            return Response({"error": "reportName parameter is required"}, status=400)
        try:
            report_data = AIReport.objects.filter(reportName=reportName).first().htmlContent
            return Response({"report": report_data})
        except AIReport.DoesNotExist:
            return Response({"error": "Report not found"}, status=404)
        except Exception as e:
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=500)

    def post(self, request):
        """
        Handle POST requests to create or update AI reports.
        """
        from .ai_agent.researchAgent import Orchestrator
        from django.http import StreamingHttpResponse
        import json


        def stream_response():
            try:
                report_name = request.data.get("reportName")
                theme = request.data.get("theme", "indigo")
                if not report_name:
                    yield json.dumps({"error": "reportName is required"}) + "|||"
                    return

                orchestrator = Orchestrator(theme)
                final_report = None

                for status_update in orchestrator.run():
                    if isinstance(status_update, dict):
                        if "finalReport" in status_update:
                            final_report = status_update["finalReport"]
                        yield json.dumps(status_update) + "|||"

                if final_report:
                    AIReport.objects.update_or_create(reportName=report_name, defaults={"htmlContent": final_report})
                    yield json.dumps({"message": "Report generation completed", "report": final_report}) + "|||"

            except Exception as e:
                notifyMe(f"Error generating report: {str(e)}", "101-error")
                yield json.dumps({"error": f"An unexpected error occurred: {str(e)}"}) + "|||"

        return StreamingHttpResponse(streaming_content=stream_response(), content_type="application/json")



# ===========================================================================================================
