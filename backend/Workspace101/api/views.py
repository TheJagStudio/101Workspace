from django.shortcuts import render
from django.http import JsonResponse
import typesense
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import Product, Category, BusinessType, InventoryData, Invoice, InvoiceLineItem, Vendor, PurchaseHistory, SalesgentToken
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, connection
import json
from django.db import models
from django.db.models import F, Sum, DecimalField, OuterRef, Subquery, Q
from django.utils import timezone
from datetime import datetime
from django.db.models.functions import TruncDate, Abs, Cast
from api.ai_agent.agent import DjangoAIAgent
import requests
from django.contrib.auth.models import User

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
            return JsonResponse({"error": "Username and password are required.","status": "failed"}, status=400)
        user = User.objects.filter(username=username).first()
        if not user or not user.check_password(password):
            return JsonResponse({"error": "Invalid username or password.","status": "failed"}, status=401)

        entry = SalesgentToken.objects.first()
        if not entry:
            return JsonResponse({"error": "No Salesgent token found.","status": "failed"}, status=404)
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
        loadSubcategories = request.GET.get("loadSubcategories", "false").lower() == "true"

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


class DustyInventoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Retrieve dusty inventory items.
        """
        dusty_inventory = Product.objects.filter(availableQuantity__lt=5)
        return JsonResponse({"data": dusty_inventory}, status=200)


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
                "history": [
                    {
                        "timestamp": str(history.orderId.insertedTimestamp),
                        "quantity": history.quantity,
                        "availableQuantity": history.availableQuantity,
                        "costPrice": history.costPrice,
                        "retailPrice": history.retailPrice,
                    }
                    for history in InvoiceLineItem.objects.filter(productId=product).order_by("orderId__insertedTimestamp")
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
        Fetch all categories and their subcategories.
        """
        categories = Category.objects.filter(parentId__isnull=True)
        category_data = [
            {
                "categoryId": category.categoryId,
                "name": category.name,
                "parentId": category.parentId if category.parentId else None,
                "subcategories": [
                    {
                        "categoryId": subcategory.categoryId,
                        "name": subcategory.name,
                        "parentId": subcategory.parentId if subcategory.parentId else None,
                        "subcategories": [
                            {
                                "categoryId": level2.categoryId,
                                "name": level2.name,
                                "parentId": level2.parentId if level2.parentId else None,
                            }
                            for level2 in Category.objects.filter(parentId=subcategory.categoryId)
                        ],
                    }
                    for subcategory in Category.objects.filter(parentId=category.categoryId)
                ],
            }
            for category in categories
        ]
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

        products = Product.objects.filter(categories=category)
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
        data = []
        for product in products:
            vendors = {}
            history = PurchaseHistory.objects.filter(productId=product).all()
            for record in history:
                if record.vendorId:
                    if record.vendorId.id not in vendors:
                        vendors[record.vendorId.id] = {
                            "name": record.vendorId.name,
                            "prices": [],
                            "dates": [],
                        }
                    if record.costPrice not in vendors[record.vendorId.id]["prices"]:
                        vendors[record.vendorId.id]["prices"].append(record.costPrice)
                        vendors[record.vendorId.id]["dates"].append(record.purchaseOrderInsertedTimestamp)

            product_data = {
                "index": i,
                "id": product.productId,
                "name": product.productName,
                "sku": product.sku,
                "costPrice": product.costPrice,
                "standardPrice": product.standardPrice,
                "profitPercentage": (product.standardPrice - product.costPrice) * 100 / product.standardPrice if product.standardPrice > 0 else 0,
                "imageUrl": product.imageUrl,
                "vendors": [
                    {
                        "id": key,
                        "name": vendors[key]["name"],
                        "prices": [{"price": price, "date": date.strftime("%m-%d-%Y")} for price, date in zip(vendors[key]["prices"], vendors[key]["dates"])],
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


# class dataMaker(APIView):
#     permission_classes = []

#     def get(self, request):
#         """
#         Generate data for testing purposes.
#         """
#         with open("./extra/PurchaseHistorydata.json", "r") as file:
#             data = json.load(file)
#         with open("./extra/invalid_products.log", "r") as log_file:
#             erroLines = log_file.readlines()
#         print(len(erroLines))
#         erroLines = [int(erroLine.replace("\n", "")) for erroLine in erroLines if erroLine.strip() != ""]
#         print(erroLines)
#         historys = []
#         productObj = {}
#         vendorObj = {}
#         for product in Product.objects.all():
#             productObj[product.productId] = product
#         for vendor in Vendor.objects.all():
#             vendorObj[vendor.id] = vendor
#         for history in data:
#             if int(history["productId"]) not in erroLines:
#                 try:
#                     historyObj = PurchaseHistory(
#                         purchaseOrderId=history["purchaseOrderId"],
#                         productId=productObj[history["productId"]],
#                         upc=history["upc"],
#                         sku=history["sku"],
#                         name=history["name"],
#                         purchasedQuantity=history["purchasedQuantity"],
#                         passedQuantity=history["passedQuantity"],
#                         failedQuantity=history["failedQuantity"],
#                         costPrice=history["costPrice"],
#                         totalCostPrice=history["totalCostPrice"],
#                         vendorId=vendorObj[history["vendorId"]],
#                         purchaseOrderInsertedTimestamp=timezone.make_aware(datetime.strptime(history["purchaseOrderInsertedTimestamp"], "%Y-%m-%d %H:%M:%S")) if history.get("purchaseOrderInsertedTimestamp") else None,
#                         billInsertedTimestamp=timezone.make_aware(datetime.strptime(history["billInsertedTimestamp"], "%Y-%m-%d %H:%M:%S")) if history.get("billInsertedTimestamp") else None,
#                     )
#                     historys.append(historyObj)
#                 except Exception as e:
#                     with open("./extra/invalid_products.log", "a") as log_file:
#                         log_file.write(f"{history['productId']}:{history['purchaseOrderId']}:{history['vendorId']} | {str(e)}\n")
#             if len(historys) >= 5000:
#                 PurchaseHistory.objects.bulk_create(historys)
#                 print(f"Inserted {len(historys)} records")
#                 historys = []
#         if historys:
#             PurchaseHistory.objects.bulk_create(historys)
#             print(f"Inserted remaining {len(historys)}")
#         return JsonResponse({"message": "Data generation completed."})


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
