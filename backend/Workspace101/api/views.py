from django.shortcuts import render
from django.http import JsonResponse
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
from django.db.models import Sum, F, Avg, Q, Count, When, Case, Value, DecimalField, CharField, OuterRef, Subquery, Max, DateTimeField, Prefetch
from rest_framework import status
from django.shortcuts import redirect

client = typesense.Client(
    {
        "api_key": settings.TYPESENSE_API_KEY,
        "nodes": [
            {
                "host": "thejagstudio-typesense.hf.space",
                "port": "443",
                "protocol": "https",
            }
        ],
        "connection_timeout_seconds": 2,
    }
)
ai_agent = DjangoAIAgent()


class SearchProductsView(APIView):
    def get(self, request):
        """
        Search products based on query parameters.
        """
        query = request.GET.get("query", "")
        search_parameters = {"q": query, "query_by": "productName", "limit": 5}
        try:
            data = client.collections["101"].documents.search(search_parameters)
            return JsonResponse(data["hits"], safe=False)
        except typesense.exceptions.ObjectNotFound:
            return JsonResponse({"error": "Typesense collection not found."}, status=404)


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
            categories = Category.objects.filter(parentId__isNone=False)
        else:
            categories = Category.objects.filter(parentId__isNone=True)

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

    This view calculates various inventory metrics such as:
    - Closing Inventory: Amount of inventory at the end of the reporting period.
    - Items Sold per Day (Average): Average number of items sold daily within the period.
    - Items Sold: Total items sold minus returns within the reporting period.
    - Days Cover: Estimated days current inventory will last based on average daily sales.
    - Average Cost: Weighted average cost of available inventory at the end of the period.
    - Inbound Inventory: Total incoming inventory from purchase orders and transfers.

    Parameters:
    - report_type (str, default='product'): 'product' for per-product data, 'category' for aggregated category data.
    - start_date (str, optional): Start date for the reporting period (YYYY-MM-DD). Defaults to 30 days ago if not provided.
    - end_date (str, optional): End date for the reporting period (YYYY-MM-DD). Defaults to today if not provided.
    - sort_by (str, default='closing_inventory'): Field to sort the results by.
      Options: 'closing_inventory', 'items_sold_per_day', 'items_sold', 'days_cover', 'average_cost', 'inbound_inventory', 'name'.
    - page (int, default=1): The page number for pagination.
    - page_size (int, default=20): The number of items per page.
    - reverse_sort (str, default='true'): 'true' for descending order, 'False' for ascending.
    - loadSubcategories (str, default='False'): Only applicable for 'category' report_type.
      'true' to load subcategories, 'False' to load top-level categories.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. Parse and validate request parameters
        report_type = request.GET.get("report_type", "product")
        start_date_str = request.GET.get("start_date", None)
        end_date_str = request.GET.get("end_date", None)
        sort_by = request.GET.get("sort_by", "closing_inventory")
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 20))
        reverse_sort = request.GET.get("reverse_sort", "true").lower() == "true"
        load_subcategories = request.GET.get("loadSubcategories", "False").lower() == "true"

        # 2. Convert date strings to timezone-aware datetime objects
        start_date = None
        end_date = None
        current_timezone = timezone.get_current_timezone()

        if end_date_str:
            try:
                # Set end_date to the very end of the specified day
                end_date = timezone.make_aware(datetime.datetime.strptime(end_date_str, "%Y-%m-%d"), current_timezone) + timedelta(days=1, microseconds=-1)
            except ValueError:
                return JsonResponse({"error": "Invalid end_date format. Use YYYY-MM-DD."}, status=400)
        else:
            # Default end_date to current time
            end_date = timezone.now()

        if start_date_str:
            try:
                # Set start_date to the beginning of the specified day
                start_date = timezone.make_aware(datetime.datetime.strptime(start_date_str, "%Y-%m-%d"), current_timezone)
            except ValueError:
                return JsonResponse({"error": "Invalid start_date format. Use YYYY-MM-DD."}, status=400)
        else:
            # Default start_date to 30 days before end_date
            start_date = end_date - timedelta(days=30)

        # Ensure start_date is not after end_date
        if start_date and end_date and start_date > end_date:
            return JsonResponse({"error": "start_date cannot be after end_date"}, status=400)

        # Calculate the number of full days in the reporting period
        # Handle cases where start_date and end_date might be the same day, resulting in 0 days difference.
        # Adding 1 to include both start and end days.
        days_in_period = (end_date.date() - start_date.date()).days + 1 if start_date and end_date else 1
        if days_in_period <= 0:  # Ensure days_in_period is at least 1 for division
            days_in_period = 1

        # 3. Define common filters for sales and returns based on the date range
        # Sales are tracked via InvoiceLineItem related to Product
        sales_filter = Q(invoice_line_items__orderId__dueDate__range=(start_date, end_date))
        # Returns are assumed to be recorded in InventoryData with actionType='RETURN'
        returns_filter = Q(inventory_records__insertedTimestamp__range=(start_date, end_date), inventory_records__actionType="RETURN")
        # Inbound from Purchase Orders are from PurchaseHistory
        po_inbound_filter = Q(purchase_history__purchaseOrderInsertedTimestamp__range=(start_date, end_date))
        # Inbound from Transfers are assumed to be recorded in InventoryData with actionType='TRANSFER_IN'
        transfer_inbound_filter = Q(inventory_records__insertedTimestamp__range=(start_date, end_date), inventory_records__actionType="TRANSFER_IN")

        # Filter for available inventory for average cost calculation
        available_inventory_filter = Q(inventory_records__availableQuantity__gt=0)

        if report_type == "product":
            # Start with all products
            products_queryset = Product.objects.filter(active=True)
            # Annotate each product with the required aggregated data for the period
            products_data = products_queryset.annotate(
                # total_sales_quantity: Sum of quantities from all sales within the period
                total_sales_quantity=Sum(F("invoice_line_items__quantity"), filter=sales_filter, output_field=DecimalField()),
                # total_returned_quantity: Sum of quantities from all returns within the period
                total_returned_quantity=Sum(F("inventory_records__quantity"), filter=returns_filter, output_field=DecimalField()),
                # total_inbound_from_po: Sum of purchased quantities from purchase orders within the period
                total_inbound_from_po=Sum(F("purchase_history__purchasedQuantity"), filter=po_inbound_filter, output_field=DecimalField()),
                # total_inbound_from_transfer: Sum of quantities from incoming transfers within the period
                total_inbound_from_transfer=Sum(F("inventory_records__quantity"), filter=transfer_inbound_filter, output_field=DecimalField()),
                # total_available_cost_value: Sum of (availableQuantity * costPrice) for currently available items
                # used for calculating weighted average cost of current inventory
                total_available_cost_value=Sum(F("inventory_records__availableQuantity") * F("inventory_records__costPrice"), filter=available_inventory_filter, output_field=DecimalField()),
                # total_available_quantity_for_cost: Sum of availableQuantity for currently available items
                # used for calculating weighted average cost of current inventory
                total_available_quantity_for_cost=Sum(F("inventory_records__availableQuantity"), filter=available_inventory_filter, output_field=DecimalField()),
            )
            print(f"Products Data Count: {products_data.count()}")
            final_data = []
            for product in products_data:
                # Calculate Items Sold: Total sales minus total returns
                items_sold = product.total_sales_quantity or 0

                # Calculate Items Sold per Day (Average)
                avg_items_sold_per_day = items_sold / days_in_period

                # Closing Inventory: Directly from product's availableQuantity
                closing_inventory = product.availableQuantity if product.availableQuantity is not None else 0

                # Calculate Days Cover: Handle division by zero to avoid errors
                days_cover = closing_inventory / avg_items_sold_per_day if avg_items_sold_per_day > 0 else float("inf")  # Set to infinity if no sales

                # Calculate Average Cost: Weighted average of available inventory.
                # Fallback to product's costPrice if no specific inventory records or quantities are available.
                average_cost = (product.total_available_cost_value / product.total_available_quantity_for_cost) if (product.total_available_cost_value is not None and product.total_available_quantity_for_cost and product.total_available_quantity_for_cost > 0) else (product.costPrice if product.costPrice is not None else 0)

                # Calculate Inbound Inventory: Sum of inbound from PO and transfers
                inbound_inventory = (product.total_inbound_from_po or 0) + (product.total_inbound_from_transfer or 0)

                final_data.append(
                    {
                        "id": product.productId,
                        "name": product.productName,
                        "closingInventory": round(closing_inventory, 2),
                        "itemsSoldPerDay": round(avg_items_sold_per_day, 2),
                        "itemsSold": round(items_sold, 2),
                        "daysCover": round(days_cover, 2) if days_cover != float("inf") else "N/A",  # Return "N/A" for infinity
                        "averageCost": round(average_cost, 2),
                        "inboundInventory": round(inbound_inventory, 2),
                        "imageUrl": product.imageUrl,
                        "sku": product.sku,
                        "upc": product.upc,
                    }
                )

            # Sort the data based on the requested sort_by parameter.
            # Sorting is done in Python because some metrics are calculated after database query.
            if sort_by == "closing_inventory":
                final_data.sort(key=lambda x: x["closingInventory"], reverse=reverse_sort)
            elif sort_by == "items_sold_per_day":
                final_data.sort(key=lambda x: x["itemsSoldPerDay"], reverse=reverse_sort)
            elif sort_by == "items_sold":
                final_data.sort(key=lambda x: x["itemsSold"], reverse=reverse_sort)
            elif sort_by == "days_cover":
                # Handle "N/A" (infinity) when sorting daysCover
                final_data.sort(key=lambda x: x["daysCover"] if x["daysCover"] != "N/A" else float("inf"), reverse=reverse_sort)
            elif sort_by == "average_cost":
                final_data.sort(key=lambda x: x["averageCost"], reverse=reverse_sort)
            elif sort_by == "inbound_inventory":
                final_data.sort(key=lambda x: x["inboundInventory"], reverse=reverse_sort)
            else:
                # Default sort by product name if no valid sort_by provided
                final_data.sort(key=lambda x: x["name"], reverse=reverse_sort)

            # Apply pagination to the sorted data
            total_possible_pages = (len(final_data) + page_size - 1) // page_size
            start_index = (page - 1) * page_size
            end_index = start_index + page_size
            paginated_data = final_data[start_index:end_index]

            # Add an index to each item in the paginated data
            for i, item in enumerate(paginated_data):
                item["index"] = start_index + i + 1

            return JsonResponse({"data": paginated_data, "totalPages": total_possible_pages}, safe=False)  # Set safe=False when returning a list or dictionary containing a list

        elif report_type == "category":
            # Start with all categories
            categories_queryset = Category.objects.all()
            if not load_subcategories:
                # Filter for top-level categories if subcategories are not requested
                categories_queryset = categories_queryset.filter(parentId__isNone=True)
            else:
                # Filter for subcategories if requested
                categories_queryset = categories_queryset.filter(parentId__isNone=False)

            # Annotate categories with aggregated product data for the period
            # Aggregations are done across all products linked to each category via products_m2m
            categories_data = categories_queryset.annotate(
                # Sum of availableQuantity for all products within the category (Category Closing Inventory)
                category_closing_inventory=Sum(F("products_m2m__availableQuantity"), output_field=DecimalField()),
                # Aggregated sales quantity for all products in the category
                category_total_sales_quantity=Sum(F("products_m2m__invoice_line_items__quantity"), filter=sales_filter, output_field=DecimalField()),
                # Aggregated returned quantity for all products in the category
                category_total_returned_quantity=Sum(F("products_m2m__inventory_records__quantity"), filter=returns_filter, output_field=DecimalField()),
                # Aggregated inbound from PO for all products in the category
                category_total_inbound_from_po=Sum(F("products_m2m__purchase_history__purchasedQuantity"), filter=po_inbound_filter, output_field=DecimalField()),
                # Aggregated inbound from Transfers for all products in the category
                category_total_inbound_from_transfer=Sum(F("products_m2m__inventory_records__quantity"), filter=transfer_inbound_filter, output_field=DecimalField()),
                # Total value of available inventory for the category (for weighted average cost)
                category_total_available_cost_value=Sum(F("products_m2m__inventory_records__availableQuantity") * F("products_m2m__inventory_records__costPrice"), filter=available_inventory_filter, output_field=DecimalField()),
                # Total available quantity for the category (for weighted average cost)
                category_total_available_quantity_for_cost=Sum(F("products_m2m__inventory_records__availableQuantity"), filter=available_inventory_filter, output_field=DecimalField()),
            )

            final_data = []
            for category in categories_data:
                # Calculate Items Sold for the category
                items_sold = (category.category_total_sales_quantity or 0) - (category.category_total_returned_quantity or 0)

                # Calculate Items Sold per Day (Average) for the category
                avg_items_sold_per_day = items_sold / days_in_period

                # Closing Inventory for the category
                closing_inventory = category.category_closing_inventory if category.category_closing_inventory is not None else 0

                # Calculate Days Cover for the category
                days_cover = closing_inventory / avg_items_sold_per_day if avg_items_sold_per_day > 0 else float("inf")

                # Calculate Average Cost for the category: Weighted average of available inventory within the category
                average_cost = (category.category_total_available_cost_value / category.category_total_available_quantity_for_cost) if (category.category_total_available_cost_value is not None and category.category_total_available_quantity_for_cost and category.category_total_available_quantity_for_cost > 0) else 0  # If no available inventory for cost calculation in category

                # Calculate Inbound Inventory for the category
                inbound_inventory = (category.category_total_inbound_from_po or 0) + (category.category_total_inbound_from_transfer or 0)

                # Get an image URL from the first product associated with the category, if available
                first_product_image_url = None
                first_product = Product.objects.filter(categories__in=[category.categoryId]).first()
                if first_product:
                    first_product_image_url = first_product.imageUrl

                final_data.append(
                    {
                        "id": category.categoryId,
                        "name": category.name,
                        "closingInventory": round(closing_inventory, 2),
                        "itemsSoldPerDay": round(avg_items_sold_per_day, 2),
                        "itemsSold": round(items_sold, 2),
                        "daysCover": round(days_cover, 2) if days_cover != float("inf") else "N/A",
                        "averageCost": round(average_cost, 2),
                        "inboundInventory": round(inbound_inventory, 2),
                        "imageUrl": first_product_image_url,
                    }
                )

            # Sort the data based on the requested sort_by parameter.
            # Sorting is done in Python because some metrics are calculated after database query.
            if sort_by == "closing_inventory":
                final_data.sort(key=lambda x: x["closingInventory"], reverse=reverse_sort)
            elif sort_by == "items_sold_per_day":
                final_data.sort(key=lambda x: x["itemsSoldPerDay"], reverse=reverse_sort)
            elif sort_by == "items_sold":
                final_data.sort(key=lambda x: x["itemsSold"], reverse=reverse_sort)
            elif sort_by == "days_cover":
                # Handle "N/A" (infinity) when sorting daysCover
                final_data.sort(key=lambda x: x["daysCover"] if x["daysCover"] != "N/A" else float("inf"), reverse=reverse_sort)
            elif sort_by == "average_cost":
                final_data.sort(key=lambda x: x["averageCost"], reverse=reverse_sort)
            elif sort_by == "inbound_inventory":
                final_data.sort(key=lambda x: x["inboundInventory"], reverse=reverse_sort)
            else:
                # Default sort by category name if no valid sort_by provided
                final_data.sort(key=lambda x: x["name"], reverse=reverse_sort)

            # Apply pagination to the sorted data
            total_possible_pages = (len(final_data) + page_size - 1) // page_size
            start_index = (page - 1) * page_size
            end_index = start_index + page_size
            paginated_data = final_data[start_index:end_index]

            # Add an index to each item in the paginated data
            for i, item in enumerate(paginated_data):
                item["index"] = start_index + i + 1

            return JsonResponse({"data": paginated_data, "totalPages": total_possible_pages}, safe=False)  # Set safe=False when returning a list or dictionary containing a list

        else:
            return JsonResponse({"error": "Invalid report type. Must be 'product' or 'category'."}, status=400)


class DustyInventoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get query parameters
        report_type = request.GET.get("report_type", "product")
        measure = request.GET.get("measure", "all")
        start_date = request.GET.get("start_date", None)
        end_date = request.GET.get("end_date", None)
        sort_by = request.GET.get("sort_by", "last_sale")
        page = request.GET.get("page", 1)
        page_size = request.GET.get("page_size", 20)
        dataType = request.GET.get("dataType", "total")
        reverse_sort = request.GET.get("reverse_sort", "true").lower() == "true"
        loadSubcategories = request.GET.get("loadSubcategories", "False").lower() == "true"
        #

        # Parse date filters
        date_filter = {}
        if start_date:
            try:
                start_date_parsed = datetime.datetime.strptime(start_date, "%Y-%m-%d")
                date_filter["insertedTimestamp__gte"] = start_date_parsed
            except ValueError:
                return JsonResponse({"error": "Invalid start_date format. Use YYYY-MM-DD"}, status=400)

        if end_date:
            try:
                end_date_parsed = datetime.datetime.strptime(end_date, "%Y-%m-%d")
                date_filter["insertedTimestamp__lte"] = end_date_parsed
            except ValueError:
                return JsonResponse({"error": "Invalid end_date format. Use YYYY-MM-DD"}, status=400)

        # set days_threshold to be end_date - start_date
        days_threshold = end_date_parsed - start_date_parsed if start_date and end_date else 90  # Default to 90 days if not specified

        # Set default date range if not provided (last 12 months for comprehensive analysis)
        if not start_date and not end_date:
            end_date_default = timezone.now()
            start_date_default = end_date_default - timedelta(days=365)
            date_filter["insertedTimestamp__gte"] = start_date_default
            date_filter["insertedTimestamp__lte"] = end_date_default

        # fetch all products where availableQuantity is less than minQuantity
        products = Product.objects.all()

        if loadSubcategories:
            categories = Category.objects.filter(parentId__isNone=False)
        else:
            categories = Category.objects.filter(parentId__isNone=True)

        # Define sort field mapping
        if sort_by == "closing_inventory":
            order_by = "availableQuantity"
        elif sort_by == "sell_through_rate":
            order_by = "sell_through_rate"
        elif sort_by == "inventory_cost":
            order_by = "inventory_cost"
        elif sort_by == "retail_value":
            order_by = "retail_value"
        elif sort_by == "last_sale":
            order_by = "last_sale_date"
        else:
            order_by = "last_sale_date"  # Default to last sale for dusty inventory

        # Apply measure filters
        if measure == "all":
            pass
        elif measure == "hand":
            products = products.filter(availableQuantity__gt=0)
        elif measure == "low":
            products = products.filter(availableQuantity__lt=10, availableQuantity__gt=0)
        elif measure == "out":
            products = products.filter(availableQuantity=0)
        elif measure == "dusty":
            # Filter for items that haven't sold in the specified threshold days
            cutoff_date = timezone.now() - timedelta(days=days_threshold)
            dusty_product_ids = InvoiceLineItem.objects.filter(**date_filter).values("productId").annotate(last_sale=Max("insertedTimestamp")).filter(Q(last_sale__lt=cutoff_date) | Q(last_sale__isNone=True)).values_list("productId", flat=True)
            products = products.filter(productId__in=dusty_product_ids, availableQuantity__gt=0)
        else:
            return JsonResponse({"error": "Invalid measure type"}, status=400)

        if report_type == "product":
            # Annotate products with dusty inventory metrics
            products = products.annotate(
                # Last sale date
                last_sale_date=Max("invoice_line_items__insertedTimestamp", filter=Q(invoice_line_items__insertedTimestamp__range=[date_filter.get("insertedTimestamp__gte", timezone.now() - timedelta(days=365)), date_filter.get("insertedTimestamp__lte", timezone.now())])),
                # Total quantity sold in period
                total_sold=Sum("invoice_line_items__quantity", filter=Q(invoice_line_items__insertedTimestamp__range=[date_filter.get("insertedTimestamp__gte", timezone.now() - timedelta(days=365)), date_filter.get("insertedTimestamp__lte", timezone.now())])),
                # Inventory cost (available quantity * cost price)
                inventory_cost=Case(When(availableQuantity__gt=0, then=Abs(F("availableQuantity") * F("costPrice"))), default=0, output_field=DecimalField(max_digits=12, decimal_places=2)),
                # Retail value (available quantity * standard price, excluding tax)
                retail_value=Case(When(availableQuantity__gt=0, then=Abs(F("availableQuantity") * F("standardPrice"))), default=0, output_field=DecimalField(max_digits=12, decimal_places=2)),
                # Sell-through rate calculation
                sell_through_rate=Case(When(availableQuantity__gt=0, then=(F("total_sold") * 100.0) / (F("availableQuantity") + F("total_sold"))), default=0, output_field=DecimalField(max_digits=5, decimal_places=2)),
            )

            # Apply sorting
            if sort_by == "sell_through_rate":
                products = products.order_by("sell_through_rate")
            elif sort_by == "inventory_cost":
                products = products.order_by("inventory_cost")
            elif sort_by == "retail_value":
                products = products.order_by("retail_value")
            elif sort_by == "last_sale":
                products = products.order_by("last_sale_date")
            else:
                products = products.order_by(order_by)

            if reverse_sort:
                products = products.reverse()

        elif report_type == "category":
            # Category-level filtering for dusty inventory
            product_aggregation_filter = None
            if measure == "all":
                product_aggregation_filter = Q(products_m2m__availableQuantity__gte=0)
            elif measure == "hand":
                product_aggregation_filter = Q(products_m2m__availableQuantity__gt=0)
            elif measure == "low":
                product_aggregation_filter = Q(products_m2m__availableQuantity__lt=10, products_m2m__availableQuantity__gt=0)
            elif measure == "out":
                product_aggregation_filter = Q(products_m2m__availableQuantity=0)
            elif measure == "dusty":
                cutoff_date = timezone.now() - timedelta(days=days_threshold)
                dusty_product_ids = InvoiceLineItem.objects.filter(**date_filter).values("productId").annotate(last_sale=Max("insertedTimestamp")).filter(Q(last_sale__lt=cutoff_date) | Q(last_sale__isNone=True)).values_list("productId", flat=True)
                product_aggregation_filter = Q(products_m2m__productId__in=dusty_product_ids, products_m2m__availableQuantity__gt=0)

            # Annotate categories with dusty inventory metrics
            categories = categories.annotate(
                # Closing inventory
                closing_inventory=Sum(Abs(F("products_m2m__availableQuantity")), filter=product_aggregation_filter, output_field=DecimalField(max_digits=12, decimal_places=2)),
                # Inventory cost
                inventory_cost=Sum(Abs(F("products_m2m__availableQuantity") * F("products_m2m__costPrice")), filter=product_aggregation_filter, output_field=DecimalField(max_digits=12, decimal_places=2)),
                # Retail value
                retail_value=Sum(Abs(F("products_m2m__availableQuantity") * F("products_m2m__standardPrice")), filter=product_aggregation_filter, output_field=DecimalField(max_digits=12, decimal_places=2)),
                # Last sale date
                last_sale_date=Max("products_m2m__invoice_line_items__insertedTimestamp", filter=Q(products_m2m__invoice_line_items__insertedTimestamp__range=[date_filter.get("insertedTimestamp__gte", timezone.now() - timedelta(days=365)), date_filter.get("insertedTimestamp__lte", timezone.now())])),
            )

            # Apply sorting for categories
            if sort_by == "closing_inventory":
                categories = categories.order_by("closing_inventory")
            elif sort_by == "inventory_cost":
                categories = categories.order_by("inventory_cost")
            elif sort_by == "retail_value":
                categories = categories.order_by("retail_value")
            elif sort_by == "last_sale":
                categories = categories.order_by("last_sale_date")
            else:
                categories = categories.order_by("last_sale_date")

            if reverse_sort:
                categories = categories.reverse()

        # Handle total calculations
        if dataType == "total":
            # Calculate totals for dusty inventory
            filtered_products = products
            if measure == "dusty":
                cutoff_date = timezone.now() - timedelta(days=days_threshold)
                dusty_product_ids = InvoiceLineItem.objects.filter(**date_filter).values("productId").annotate(last_sale=Max("insertedTimestamp")).filter(Q(last_sale__lt=cutoff_date) | Q(last_sale__isNone=True)).values_list("productId", flat=True)
                filtered_products = Product.objects.filter(productId__in=dusty_product_ids, availableQuantity__gt=0)

            total_closing_inventory = filtered_products.aggregate(total=Sum(Case(When(availableQuantity__lt=9999999, then=Abs(F("availableQuantity"))), default=0, output_field=DecimalField())))["total"] or 0

            total_inventory_cost = filtered_products.aggregate(total=Sum(Abs(F("availableQuantity") * F("costPrice")), output_field=DecimalField()))["total"] or 0

            total_retail_value = filtered_products.aggregate(total=Sum(Abs(F("availableQuantity") * F("standardPrice")), output_field=DecimalField()))["total"] or 0

            # Calculate overall sell-through rate
            total_sold_in_period = InvoiceLineItem.objects.filter(productId__in=filtered_products.values_list("productId", flat=True), **date_filter).aggregate(total=Sum("quantity"))["total"] or 0

            overall_sell_through_rate = 0
            if total_closing_inventory > 0:
                overall_sell_through_rate = (float(total_sold_in_period) * 100.0) / (float(total_closing_inventory) + float(total_sold_in_period))

            return JsonResponse({"totalClosingInventory": total_closing_inventory, "totalInventoryCost": total_inventory_cost, "totalRetailValue": total_retail_value, "overallSellThroughRate": round(overall_sell_through_rate, 2), "totalSoldInPeriod": total_sold_in_period, "analysisThresholdDays": days_threshold})

        else:
            # Handle pagination
            start_index = (int(page) - 1) * int(page_size)
            end_index = start_index + int(page_size)
            finalData = []
            i = (int(page) - 1) * int(page_size) + 1

            if report_type == "product":
                totalPossiblePages = (products.count() + int(page_size) - 1) // int(page_size)
                paginated_products = products[start_index:end_index]

                for product in paginated_products:
                    # Calculate sell-through rate for individual product
                    total_sold = InvoiceLineItem.objects.filter(productId=product.productId, **date_filter).aggregate(total=Sum("quantity"))["total"] or 0

                    available_qty = product.availableQuantity if product.availableQuantity > 0 else 0
                    print(f"Product ID: {product.productId}, Available Qty: {available_qty}, Total Sold: {total_sold}")
                    sell_through_rate = 0
                    if available_qty > 0 or total_sold > 0:
                        sell_through_rate = (total_sold * 100.0) / (available_qty + total_sold)

                    # Get last sale date
                    last_sale = (
                        (
                            InvoiceLineItem.objects.filter(
                                productId=product.productId,
                            )
                            .select_related("orderId")  # Add select_related to optimize query
                            .order_by("-orderId__insertedTimestamp")
                            .first()
                        ).orderId.insertedTimestamp
                        if InvoiceLineItem.objects.filter(
                            productId=product.productId,
                        ).exists()
                        else None
                    )
                    if last_sale:
                        # Convert to date for display, but keep datetime for calculation
                        last_sale_display = last_sale.date()
                        last_sale_date = last_sale

                    # last recieved date
                    last_received = (PurchaseHistory.objects.filter(productId=product.productId).order_by("-purchaseOrderInsertedTimestamp").first()).purchaseOrderInsertedTimestamp if PurchaseHistory.objects.filter(productId=product.productId).exists() else None
                    if last_received:
                        last_received_date = last_received.date()

                    tempData = {"id": product.productId, "index": i, "name": product.productName, "sku": product.sku, "closingInventory": available_qty, "sellThroughRate": round(sell_through_rate, 2), "inventoryCost": float(available_qty * (product.costPrice or 0)), "retailValue": float(available_qty * (product.standardPrice or 0)), "lastSale": last_sale_display.isoformat() if last_sale else None, "imageUrl": product.imageUrl, "daysSinceLastSale": (timezone.now() - last_sale_date).days if last_sale else None, "lastReceived": last_received_date.isoformat() if last_received else None}
                    finalData.append(tempData)
                    i += 1

                return JsonResponse({"data": finalData, "totalPages": totalPossiblePages, "currentPage": int(page), "pageSize": int(page_size), "totalRecords": products.count()})

            elif report_type == "category":
                totalPossiblePages = (categories.count() + int(page_size) - 1) // int(page_size)
                paginated_categories = categories[start_index:end_index]

                for category in paginated_categories:
                    # Get products in this category for calculations
                    category_products = Product.objects.filter(categories__in=[category.categoryId])
                    if measure == "dusty":
                        cutoff_date = timezone.now() - timedelta(days=days_threshold)
                        dusty_product_ids = InvoiceLineItem.objects.filter(**date_filter).values("productId").annotate(last_sale=Max("insertedTimestamp")).filter(Q(last_sale__lt=cutoff_date) | Q(last_sale__isNone=True)).values_list("productId", flat=True)
                        category_products = category_products.filter(productId__in=dusty_product_ids, availableQuantity__gt=0)

                    # Calculate metrics for category
                    closing_inventory = category_products.aggregate(total=Sum(Abs(F("availableQuantity"))))["total"] or 0

                    inventory_cost = category_products.aggregate(total=Sum(Abs(F("availableQuantity") * F("costPrice"))))["total"] or 0

                    retail_value = category_products.aggregate(total=Sum(Abs(F("availableQuantity") * F("standardPrice"))))["total"] or 0

                    # Calculate category sell-through rate
                    total_sold = InvoiceLineItem.objects.filter(productId__in=category_products.values_list("productId", flat=True), **date_filter).aggregate(total=Sum("quantity"))["total"] or 0

                    sell_through_rate = 0
                    if closing_inventory > 0 or total_sold > 0:
                        sell_through_rate = (total_sold * 100.0) / (closing_inventory + total_sold)

                    # Get last sale date for category
                    last_sale = InvoiceLineItem.objects.filter(productId__in=category_products.values_list("productId", flat=True), **date_filter).aggregate(last_sale=Max("insertedTimestamp"))["last_sale"]

                    # Get representative image
                    first_product = category_products.first()
                    image_url = first_product.imageUrl if first_product else None

                    tempData = {"id": category.categoryId, "index": i, "name": category.name, "closingInventory": float(closing_inventory), "sellThroughRate": round(sell_through_rate, 2), "inventoryCost": float(inventory_cost), "retailValue": float(retail_value), "lastSale": last_sale.isoformat() if last_sale else None, "imageUrl": image_url, "productCount": category_products.count(), "daysSinceLastSale": (timezone.now() - last_sale).days if last_sale else None}
                    finalData.append(tempData)
                    i += 1

                return JsonResponse({"data": finalData, "totalPages": totalPossiblePages, "currentPage": int(page), "pageSize": int(page_size), "totalRecords": categories.count()})

            else:
                return JsonResponse({"error": "Invalid report type"}, status=400)


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


# ===========================================================================================================


class dataMaker(APIView):
    permission_classes = []

    def get(self, request):
        """
        Generate data for testing purposes.
        """
        path = "./extra/data/"
        # get all files in the path
        import os

        files = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]
        productArr = []
        i = 0
        for file in files:
            with open(os.path.join(path, file), "r") as f:
                data = json.load(f)
            product = Product.objects.get(productId=data["id"])
            if product:
                product.urlAlias = data["urlAlias"]
                product.shortDescription = data["shortDescription"]
                product.fullDescription = data["fullDescription"]
                product.avgCostPrice = data["avgCostPrice"]
                product.latestCostPrice = data["latestCostPrice"]
                product.stdPrice = data["stdPrice"]
                product.tier1Price = data["tier1Price"]
                product.tier2Price = data["tier2Price"]
                product.tier3Price = data["tier3Price"]
                product.tier4Price = data["tier4Price"]
                product.tier5Price = data["tier5Price"]
                product.upc1 = data["upc1"]
                product.upc2 = data["upc2"]
                product.singleUpc = data["singleUpc"]
                product.vendorUpc = data["vendorUpc"]
                product.metaKeyword = data["metaKeyword"]
                product.childProductList = data["childProductList"]
                product.quantity = data["quantity"]
                product.reorderQuantity = data["reorderQuantity"]
                product.minQuantity = data["minQuantity"]
                product.caseQuantity = data["caseQuantity"]
                product.boxQuantity = data["boxQuantity"]
                productArr.append(product)
                i += 1
            if len(productArr) == 1000:
                Product.objects.bulk_update(productArr, ["urlAlias", "shortDescription", "fullDescription", "avgCostPrice", "latestCostPrice", "stdPrice", "tier1Price", "tier2Price", "tier3Price", "tier4Price", "tier5Price", "upc1", "upc2", "singleUpc", "vendorUpc", "metaKeyword", "childProductList", "quantity", "reorderQuantity", "minQuantity", "caseQuantity", "boxQuantity"])
                productArr = []
                print(f"Updated {i} products so far...")
        if len(productArr) > 0:
            Product.objects.bulk_update(productArr, ["urlAlias", "shortDescription", "fullDescription", "avgCostPrice", "latestCostPrice", "stdPrice", "tier1Price", "tier2Price", "tier3Price", "tier4Price", "tier5Price", "upc1", "upc2", "singleUpc", "vendorUpc", "metaKeyword", "childProductList", "quantity", "reorderQuantity", "minQuantity", "caseQuantity", "boxQuantity"])
        return JsonResponse({"message": "Data generation completed."})


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
                yield json.dumps({"error": f"An unexpected error occurred: {str(e)}"}) + "|||"

        return StreamingHttpResponse(streaming_content=stream_response(), content_type="application/json")


# ===========================================================================================================


class SummerSaleUserRegistration(APIView):
    permission_classes = []

    def _get_api_headers(self):
        try:
            token_obj = SalesgentToken.objects.first()
            if not token_obj:
                raise ValueError("Access Token not found in the database.")
            access_token = token_obj.accessToken
            return {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            }
        except Exception as e:
            raise ConnectionError(f"Could not configure API headers: {e}")

    def _create_erp_customer(self, customer_data, headers):
        api_url = "https://erp.101distributorsga.com/api/customer"
        state_stateId_map = {"Alabama": "1", "Alaska": "2", "Arizona": "3", "Arkansas": "4", "California": "5", "Colorado": "6", "Connecticut": "7", "Delaware": "8", "District Of Columbia": "9", "Florida": "10", "Georgia": "11", "Hawaii": "12", "Idaho": "13", "Illinois": "14", "Indiana": "15", "Iowa": "16", "Kansas": "17", "Kentucky": "18", "Louisiana": "19", "Maine": "20", "Maryland": "21", "Massachusetts": "22", "Michigan": "23", "Minnesota": "24", "Mississippi": "25", "Missouri": "26", "Montana": "27", "Nebraska": "28", "Nevada": "29", "New Hampshire": "30", "New Jersey": "31", "New Mexico": "32", "New York": "33", "North Carolina": "34", "North Dakota": "35", "Ohio": "36", "Oklahoma": "37", "Oregon": "38", "Pennsylvania": "39", "Rhode Island": "40", "South Carolina": "41", "South Dakota": "42", "Tennessee": "43", "Texas": "44", "Utah": "45", "Vermont": "46", "Virginia": "47", "Washington": "48", "West Virginia": "49", "Wisconsin": "50", "Wyoming": "51", "American Samoa": "52", "Guam": "53", "Northern Mariana Islands": "54", "Puerto Rico": "55", "United States Minor Outlying Islands": "56", "Virgin Islands": "57"}
        state_id = state_stateId_map.get(str(customer_data.get("address_1[state]", "")).strip(), "Georgia")
        payload = {
            "customerDto": {
                "tier": 1,
                "paymentTermsId": 1,
                "taxable": 1 if state_id == "11" else 0,
                "active": True,
                "saveProductPrice": True,
                "signUpStoreId": 1,
                "countryCode": 1,
                "customerStoreAddressList": [
                    {
                        "countryId": 1,
                        "active": True,
                        "defaultAddress": True,
                        "billingAddress": True,
                        "shippingAddress": True,
                        "sameAsBillingAddress": True,
                        "address1": customer_data.get("address_1[address_line_1]"),
                        "address2": customer_data.get("address_1[address_line_2]", ""),
                        "city": customer_data.get("address_1[city]"),
                        "stateId": int(state_id, 11),
                        "state": customer_data.get("address_1[state]"),
                        "zip": customer_data.get("address_1[zip]"),
                        "county": customer_data.get("county", ""),
                    }
                ],
                "firstName": customer_data.get("names[first_name]"),
                "lastName": customer_data.get("names[last_name]"),
                "email": customer_data.get("email"),
                "phone": int(customer_data.get("phone", "").replace("-", "")),
                "taxId": customer_data.get("taxId", ""),
                "tobaccoId": customer_data.get("input_text_3", ""),
                "vaporTaxId": customer_data.get("vaporTaxId", ""),
                "salesTaxId": customer_data.get("salesTaxId", ""),
                "drivingLicenseNumber": customer_data.get("input_text_7", ""),
                "hempLicenseNumber": customer_data.get("input_text_5", ""),
                "feinNumber": customer_data.get("input_text_4", ""),
                "tobaccoLicenseExpirationDate": customer_data.get("tobaccoLicenseExpirationDate", ""),
                "vaporTaxExpirationDate": customer_data.get("vaporTaxExpirationDate", ""),
                "salesTaxIdExpirationDate": customer_data.get("salesTaxIdExpirationDate", ""),
                "voidCheckNumber": customer_data.get("input_text_6", ""),
                "hempLicenseExpirationDate": customer_data.get("hempLicenseExpirationDate", ""),
                "verified": True,
                "viewSpecificCategory": True,
                "viewSpecificProduct": True,
                "company": customer_data.get("input_text"),
                "dbaName": customer_data.get("input_text_1", ""),
                "notes": customer_data.get("notes", ""),
                "primarySalesRepresentativeId": customer_data.get("primarySalesRepresentativeId", ""),
                "primaryBusiness": customer_data.get("primaryBusiness", ""),
                "websiteReference": "Word of mouth",
                "createdBy": 20,
            }
        }
        # payload = {
        #     "customerDto": {
        #         "tier": 1,
        #         "paymentTermsId": 1,
        #         "taxable": int(customer_data.get("taxable", 1)),
        #         "active": True,
        #         "saveProductPrice": True,
        #         "signUpStoreId": 1,
        #         "countryCode": 1,
        #         "customerStoreAddressList": [
        #             {
        #                 "countryId": 1,
        #                 "active": True,
        #                 "defaultAddress": True,
        #                 "billingAddress": True,
        #                 "shippingAddress": True,
        #                 "sameAsBillingAddress": True,
        #                 "address1": customer_data.get("address1"),
        #                 "address2": customer_data.get("address2", ""),
        #                 "city": customer_data.get("city"),
        #                 "stateId": int(customer_data.get("stateId")),
        #                 "state": customer_data.get("state"),
        #                 "zip": customer_data.get("zip"),
        #                 "county": customer_data.get("county", ""),
        #             }
        #         ],
        #         "firstName": customer_data.get("firstName"),
        #         "lastName": customer_data.get("lastName"),
        #         "email": customer_data.get("email"),
        #         "phone": int(customer_data.get("phone", "")),
        #         "taxId": customer_data.get("taxId", ""),
        #         "tobaccoId": customer_data.get("tobaccoId", ""),
        #         "vaporTaxId": customer_data.get("vaporTaxId", ""),
        #         "salesTaxId": customer_data.get("salesTaxId", ""),
        #         "drivingLicenseNumber": customer_data.get("drivingLicenseNumber", ""),
        #         "hempLicenseNumber": customer_data.get("hempLicenseNumber", ""),
        #         "feinNumber": customer_data.get("feinNumber", ""),
        #         "tobaccoLicenseExpirationDate": customer_data.get("tobaccoLicenseExpirationDate", ""),
        #         "vaporTaxExpirationDate": customer_data.get("vaporTaxExpirationDate", ""),
        #         "salesTaxIdExpirationDate": customer_data.get("salesTaxIdExpirationDate", ""),
        #         "voidCheckNumber": customer_data.get("voidCheckNumber", ""),
        #         "hempLicenseExpirationDate": customer_data.get("hempLicenseExpirationDate", ""),
        #         "verified": True,
        #         "viewSpecificCategory": True,
        #         "viewSpecificProduct": True,
        #         "company": customer_data.get("company"),
        #         "dbaName": customer_data.get("dbaName", ""),
        #         "notes": customer_data.get("notes", ""),
        #         "primarySalesRepresentativeId": customer_data.get("primarySalesRepresentativeId", ""),
        #         "primaryBusiness": customer_data.get("primaryBusiness", ""),
        #         "websiteReference": "Word of mouth",
        #         "createdBy": 20,
        #     }
        # }

        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()

    def _upload_erp_document(self, customer_id, file_field_name, file_object, headers):
        DOC_TYPE_MAP = {
            "ach_form_document": {"id": 60},
            "business_license_document": {"id": 55},
            "credit_card_auth_document": {"id": 61},
            "driving_license_document": {"id": 58},
            "fein_license_document": {"id": 56},
            "hemp_license_document": {"id": 220},
            "sales_tax_certificate_document": {"id": 57},
            "tobacco_license_document": {"id": 54},
            "void_check_document": {"id": 59},
        }
        api_url = "https://erp.101distributorsga.com/api/attachment"
        doc_meta = DOC_TYPE_MAP.get(file_field_name)
        if not doc_meta:
            return {"status": "error", "message": f"Unknown document type: {file_field_name}"}

        attachment_obj_data = {
            "name": file_object["name"],
            "recordId": customer_id,
            "moduleId": 4,
            "fieldName": "customer_document",
            "fieldId": 651,
            "active": True,
            "documentTypeId": doc_meta["id"],
        }

        files_payload = {
            "attachmentObj": (None, json.dumps(attachment_obj_data), "application/json"),
            "file": (file_object["name"], file_object["content"], file_object["content_type"]),
        }

        upload_headers = headers.copy()

        response = requests.post(api_url, headers=upload_headers, files=files_payload)
        response.raise_for_status()
        return {"status": "success", "data": response.json()}

    def _validate_request_data(self, data, files):
        DOC_TYPE_MAP = {
            "ach_form_document": {"id": 60},
            "business_license_document": {"id": 55},
            "credit_card_auth_document": {"id": 61},
            "driving_license_document": {"id": 58},
            "fein_license_document": {"id": 56},
            "hemp_license_document": {"id": 220},
            "sales_tax_certificate_document": {"id": 57},
            "tobacco_license_document": {"id": 54},
            "void_check_document": {"id": 59},
        }
        errors = {}
        required_fields = ["names[first_name]", "names[last_name]", "email", "phone", "input_text", "address_1[address_line_1]", "address_1[city]", "address_1[state]", "address_1[zip]"]

        for field in required_fields:
            if not data.get(field):
                errors[field] = "This field may not be blank."

        if data.get("email") and "@" not in data.get("email"):
            errors["email"] = "Enter a valid email."

        for doc_name in DOC_TYPE_MAP.keys():
            if doc_name in files and files[doc_name]["size"] == 0:
                errors[doc_name] = "The submitted file is empty."

        return errors

    def post(self, request):
        field_DOC_map = {
                "achFormDocument": "ach_form_document",
                "file-upload": "business_license_document",
                "creditCardAuthDocument": "credit_card_auth_document",
                "file-upload_5": "driving_license_document",
                "file-upload_2": "fein_license_document",
                "file-upload_3": "hemp_license_document",
                "salesTaxCertificateDocument": "sales_tax_certificate_document",
                "file-upload_1": "tobacco_license_document",
                "file-upload_4": "void_check_document",
            }
        data = request.data
        fileUrls = [{"url":data[key],"name":key} for key in field_DOC_map.keys() if key in data]
        files = []
        # these is a list of urls which are needed to be downloaded
        for file_info in fileUrls:
            try:
                response = requests.get(file_info["url"], allow_redirects=True)
                fileExtension = response.headers["Content-Type"]
                size = response.headers.get("Content-Length", 0)
                file_info["field_name"] = field_DOC_map[file_info["name"]]
                file_info["name"] = file_info["field_name"]
                if "application/pdf" in fileExtension:
                    file_info["name"] += ".pdf"
                elif "image" in fileExtension:
                    if "png" in fileExtension:
                        file_info["name"] += ".png"
                    elif "gif" in fileExtension:
                        file_info["name"] += ".gif"
                    elif "jpeg" in fileExtension or "jpg" in fileExtension:
                        file_info["name"] += ".jpeg" if "jpeg" in fileExtension else ".jpg"
                    elif "bmp" in fileExtension:
                        file_info["name"] += ".bmp"
                    elif "webp" in fileExtension:
                        file_info["name"] += ".webp"
                    elif "svg" in fileExtension:
                        file_info["name"] += ".svg"
                    else:
                        file_info["name"] += ".jpg"
                elif "text" in fileExtension:
                    file_info["name"] += ".txt"
                elif "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in fileExtension:
                    file_info["name"] += ".docx"
                elif "application/msword" in fileExtension:
                    file_info["name"] += ".doc"
                elif "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in fileExtension:
                    file_info["name"] += ".xlsx"
                elif "application/vnd.ms-excel" in fileExtension:
                    file_info["name"] += ".xls"
                else:
                    file_info["name"] += ".bin"
                if response.status_code == 200 and response.content:
                    file = {
                        "name": file_info["name"],
                        "field_name": file_info["field_name"],
                        "content_type": response.headers.get("Content-Type", "application/octet-stream"),
                        "content": response.content,
                        "size": int(size) if size.isdigit() else 0,
                        "content_length": int(size) if size.isdigit() else 0,
                    }               
                    files.append(file)
            except requests.exceptions.RequestException as e:
                print(f"Error downloading file from {file_info['url']}: {e}")
                files.append(None)
       
        DOC_TYPE_MAP = {
            "ach_form_document": {"id": 60},
            "business_license_document": {"id": 55},
            "credit_card_auth_document": {"id": 61},
            "driving_license_document": {"id": 58},
            "fein_license_document": {"id": 56},
            "hemp_license_document": {"id": 220},
            "sales_tax_certificate_document": {"id": 57},
            "tobacco_license_document": {"id": 54},
            "void_check_document": {"id": 59},
        }

        validation_errors = self._validate_request_data(data, files)
        if validation_errors:
            return Response(validation_errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            headers = self._get_api_headers()

            created_customer_response = self._create_erp_customer(data, headers)
            customer_id = created_customer_response.get("result", {}).get("id")

            if not customer_id:
                return Response({"error": "Failed to create customer or retrieve customer ID from ERP response."}, status=status.HTTP_502_BAD_GATEWAY)
            
            upload_results = {}
            for fileObj in files:
                field_name = fileObj["field_name"]
                if field_name in DOC_TYPE_MAP:
                    try:
                        result = self._upload_erp_document(customer_id, field_name, fileObj, headers)
                        upload_results[field_name] = result
                    except Exception as e:
                        upload_results[field_name] = {"status": "error", "message": f"Upload failed for {fileObj['field_name']}: {str(e)}"}
            return redirect(to="https://101distributors.com/mega-trade-show-customer-registration/", status_code=status.HTTP_302_FOUND)

        except requests.exceptions.HTTPError as err:
            try:
                error_details = err.response.json()
            except json.JSONDecodeError:
                error_details = f"HTTP Error: {err.response.status_code} - {err.response.text}"
            return Response({"error": error_details}, status=err.response.status_code)
        except (requests.exceptions.RequestException, ConnectionError) as err:
            return Response({"error": f"API Connection Error: {err}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as err:
            return Response({"error": f"An unexpected error occurred: {err}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
