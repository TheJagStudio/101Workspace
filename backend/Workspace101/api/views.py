from django.http import JsonResponse
import typesense
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import Product, SalesgentToken, AIReport,Category
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
import json
from django.db import transaction
from api.ai_agent.agent import DjangoAIAgent
import requests
from django.contrib.auth.models import User
from .ai_agent.researchAgent import Orchestrator
from django.http import StreamingHttpResponse
import json
from django.utils import timezone
import concurrent.futures
from datetime import timedelta

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
ai_agent = DjangoAIAgent(use_copilot=True)


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


# class dataMaker(APIView):
#     permission_classes = []

#     # It's better to define constants outside the request method
#     API_BASE_URL = 'https://erp.101distributorsga.com/api/product/'
    
#     # WARNING: Hardcoding tokens is insecure and not recommended for production.
#     # The token will expire. Consider using environment variables or a secure vault.
#     API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzU1MzM3Mzk5LCJ1c2VySWQiOjIwLCJpYXQiOjE3NTUyMTczOTksInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.HdpgYFJJUBnmcazaqQrr005tEyepg6JTWCrnMRfuPm0'

#     def get(self, request):
#         """
#         Fetches detailed data for each product from an external API and updates the database.
#         """
#         # To update all products, use Product.objects.all(). 
#         # The user's original filter is retained here.
#         # Only sync products that are active and have not been synced recently (e.g., in the last 24 hours)

#         cutoff_time = timezone.now() - timedelta(hours=24)
#         products_to_sync = Product.objects.filter(active=True).filter(lastSyncTimestamp__lt=cutoff_time)
        
#         updated_count = 0
#         failed_products = []

#         for product in products_to_sync:
#             try:
#                 # Use a database transaction to ensure that all updates for a single 
#                 # product either succeed or fail together.
#                 with transaction.atomic():
#                     # 1. Prepare and send the API request
#                     api_url = f"{self.API_BASE_URL}{product.productId}?storeIds=1,2"
#                     headers = {
#                         'Authorization': f'Bearer {self.API_TOKEN}',
#                         'Accept': 'application/json, text/plain',
#                         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
#                         'Referer': f'https://erp.101distributorsga.com/product/{product.productId}/edit',
#                     }

#                     response = requests.get(api_url, headers=headers)
#                     response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)

#                     data = response.json()["result"]

#                     # 2. Map API data to the Product model instance
#                     product.sku = data.get('sku')
#                     product.upc = data.get('upc')
#                     product.productName = data.get('name')
#                     product.availableQuantity = data.get('availableQuantity')
#                     product.masterProductId = data.get('masterProductId')
#                     product.masterProductName = data.get('masterProductName')
                    
#                     # Prices
#                     product.standardPrice = data.get('stdPrice')
#                     product.tierPrice = data.get('tier1Price') # Example: using tier1 as the default tier price
#                     product.costPrice = data.get('costPrice')
#                     product.minimumSellingPrice = data.get('minimumSellingPrice')
#                     product.avgCostPrice = data.get('avgCostPrice')
#                     product.latestCostPrice = data.get('latestCostPrice')
#                     product.stdPrice = data.get('stdPrice')
#                     product.tier1Price = data.get('tier1Price')
#                     product.tier2Price = data.get('tier2Price')
#                     product.tier3Price = data.get('tier3Price')
#                     product.tier4Price = data.get('tier4Price')
#                     product.tier5Price = data.get('tier5Price')

#                     # Booleans and Flags
#                     product.ecommerce = data.get('ecommerce')
#                     product.active = data.get('active')
#                     product.compositeProduct = data.get('compositeProduct')
#                     product.trackInventory = data.get('trackInventory')
#                     product.trackInventoryByImei = data.get('trackInventoryByImei')
#                     product.returnable = data.get('returnable')

#                     # Descriptions and Metadata
#                     product.urlAlias = data.get('urlAlias')
#                     product.shortDescription = data.get('shortDescription')
#                     product.fullDescription = data.get('fullDescription')
#                     product.metaKeyword = data.get('metaKeyword')

#                     # Other Identifiers and Quantities
#                     product.upc1 = data.get('upc1')
#                     product.upc2 = data.get('upc2')
#                     product.singleUpc = data.get('singleUpc')
#                     product.vendorUpc = data.get('vendorUpc')
#                     product.size = data.get('size')
#                     product.quantity = data.get('quantity')
#                     product.reorderQuantity = data.get('reorderQuantity')
#                     product.minQuantity = data.get('minQuantity')
#                     product.caseQuantity = data.get('caseQuantity')
#                     product.boxQuantity = data.get('boxQuantity')

#                     # JSON Field
#                     product.childProductList = data.get('childProductList')

#                     # Handle Image URL (from a list in the API response)
#                     image_list = data.get('productImageAttachmentList', [])
#                     if image_list and isinstance(image_list, list) and image_list[0].get('imageConfigUrl'):
#                         product.imageUrl = image_list[0]['imageConfigUrl']

#                     # 3. Handle ManyToMany Relationship for Categories
#                     category_pks = []
#                     is_clearance = False
#                     api_categories = data.get('productCategories', [])
                    
#                     if api_categories and isinstance(api_categories, list):
#                         for cat_data in api_categories:
#                             # Skip if category data is incomplete
#                             if 'categoryId' not in cat_data or 'name' not in cat_data:
#                                 continue

#                             # Check for clearance category
#                             if cat_data.get('name', '').upper() == 'CLEARANCE':
#                                 is_clearance = True

#                             # Create or update the category in your database
#                             category, created = Category.objects.update_or_create(
#                                 categoryId=cat_data['categoryId'],
#                                 defaults={
#                                     'name': cat_data.get('name'),
#                                     'alias': cat_data.get('alias'),
#                                     'parentId': cat_data.get('parentId'),
#                                     'description': cat_data.get('description'),
#                                     'ecommerce': cat_data.get('ecommerce'),
#                                 }
#                             )
#                             category_pks.append(category.pk)
                    
#                     # Update the isClearanceProduct boolean flag based on category
#                     product.isClearanceProduct = is_clearance
                    
#                     # Efficiently set the M2M relationship
#                     product.categories.set(category_pks)

#                     # 4. Save the updated product instance
#                     # The 'lastSyncTimestamp' field will be updated automatically because of 'auto_now=True'
#                     product.save()
                    
#                     updated_count += 1
#                     print(f"Successfully updated Product ID: {product.productId} , {updated_count}")

#             except requests.exceptions.RequestException as e:
#                 error_message = f"Network error for Product ID {product.productId}: {e}"
#                 print(error_message)
#                 failed_products.append({"productId": product.productId, "error": str(e)})
#             except Exception as e:
#                 # Catch any other errors (e.g., JSON decoding, database errors)
#                 error_message = f"An unexpected error occurred for Product ID {product.productId}: {e}"
#                 print(error_message)
#                 failed_products.append({"productId": product.productId, "error": str(e)})

#         # 5. Return a summary of the operation
#         return JsonResponse({
#             "status": "Completed",
#             "total_products_scanned": products_to_sync.count(),
#             "successfully_updated": updated_count,
#             "failed_updates": len(failed_products),
#             "failed_products": failed_products
#         })

class dataMaker(APIView):
    def get(self, request):
        categories = Category.objects.all()
        for cat in categories:
            cat.parValueDays = 10
            cat.save()
            print(f"Updated category {cat.name} with parValueDays = 10")
        return JsonResponse({
            "status": "Completed",
            "total_categories_updated": categories.count()
        })

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
