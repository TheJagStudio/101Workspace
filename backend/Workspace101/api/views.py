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
    permission_classes = []

    API_BASE_URL = 'https://erp.101distributorsga.com/api/product/'
    # WARNING: Hardcoding tokens is insecure and not recommended for production.
    # The token will expire. Consider using environment variables or a secure vault.
    API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkaGF2YWwucEAxMDFkaXN0cmlidXRvcnNnYS5jb20iLCJ1c2VyVHlwZSI6IkVtcGxveWVlIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwic3RvcmVJZCI6MSwiZXhwIjoxNzU1MzM3Mzk5LCJ1c2VySWQiOjIwLCJpYXQiOjE3NTUyMTczOTksInJlc2V0UGFzc3dvcmRSZXF1aXJlZCI6ZmFsc2V9.HdpgYFJJUBnmcazaqQrr005tEyepg6JTWCrnMRfuPm0'

    # Configuration for multithreading and bulk updates
    MAX_WORKERS = 4  # Number of concurrent threads for API calls
    BULK_UPDATE_BATCH_SIZE = 4 # Number of products to collect before a bulk update

    def _fetch_and_process_product_data(self, product_instance):
        """
        Fetches data for a single product from the API and prepares it for update.
        This function will be run in a separate thread.
        Returns the updated product instance or an error dictionary.
        """
        try:
            api_url = f"{self.API_BASE_URL}{product_instance.productId}?storeIds=1,2"
            headers = {
                'Authorization': f'Bearer {self.API_TOKEN}',
                'Accept': 'application/json, text/plain',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'Referer': f'https://erp.101distributorsga.com/product/{product_instance.productId}/edit',
            }

            response = requests.get(api_url, headers=headers) # Added timeout
            response.raise_for_status()

            data = response.json()["result"]
            if product_instance.productId == 62422:  # Example condition
                print(data)
            # Map API data to the Product model instance
            product_instance.sku = data.get('sku')
            product_instance.upc = data.get('upc')
            product_instance.productName = data.get('name')
            product_instance.availableQuantity = data.get('availableQuantity')
            product_instance.masterProductId = data.get('masterProductId')
            product_instance.masterProductName = data.get('masterProductName')
            product_instance.standardPrice = data.get('stdPrice')
            product_instance.tierPrice = data.get('tier1Price')
            product_instance.costPrice = data.get('costPrice')
            product_instance.minimumSellingPrice = data.get('minimumSellingPrice')
            product_instance.avgCostPrice = data.get('avgCostPrice')
            product_instance.latestCostPrice = data.get('latestCostPrice')
            product_instance.stdPrice = data.get('stdPrice')
            product_instance.tier1Price = data.get('tier1Price')
            product_instance.tier2Price = data.get('tier2Price')
            product_instance.tier3Price = data.get('tier3Price')
            product_instance.tier4Price = data.get('tier4Price')
            product_instance.tier5Price = data.get('tier5Price')
            product_instance.ecommerce = data.get('ecommerce')
            product_instance.active = data.get('active')
            product_instance.compositeProduct = data.get('compositeProduct')
            product_instance.trackInventory = data.get('trackInventory')
            product_instance.trackInventoryByImei = data.get('trackInventoryByImei')
            product_instance.returnable = data.get('returnable')
            product_instance.urlAlias = data.get('urlAlias')
            product_instance.shortDescription = data.get('shortDescription')
            product_instance.fullDescription = data.get('fullDescription')
            product_instance.metaKeyword = data.get('metaKeyword')
            product_instance.upc1 = data.get('upc1')
            product_instance.upc2 = data.get('upc2')
            product_instance.singleUpc = data.get('singleUpc')
            product_instance.vendorUpc = data.get('vendorUpc')
            product_instance.size = data.get('size')
            product_instance.quantity = data.get('quantity')
            product_instance.reorderQuantity = data.get('reorderQuantity')
            product_instance.minQuantity = data.get('minQuantity')
            product_instance.caseQuantity = data.get('caseQuantity')
            product_instance.boxQuantity = data.get('boxQuantity')
            product_instance.childProductList = data.get('childProductList')

            image_list = data.get('productImageAttachmentList', [])
            if image_list and isinstance(image_list, list) and image_list[0].get('imageConfigUrl'):
                product_instance.imageUrl = image_list[0]['imageConfigUrl']

            # Categories will be handled separately in the main thread to avoid M2M issues in threads
            category_data = data.get('productCategories', [])
            
            # The lastSyncTimestamp will be updated automatically on save/bulk_update
            product_instance.lastSyncTimestamp = timezone.now()

            return {
                "status": "success",
                "product_instance": product_instance,
                "category_data": category_data # Pass category data back for M2M update
            }

        except requests.exceptions.RequestException as e:
            print(f"Network error for Product ID {product_instance.productId}: {e}")
            return {
                "status": "error",
                "productId": product_instance.productId,
                "error": f"Network error: {e}"
            }
        except Exception as e:
            print(f"Network error for Product ID {product_instance.productId}: {e}")
            return {
                "status": "error",
                "productId": product_instance.productId,
                "error": f"An unexpected error occurred: {e}"
            }

    def get(self, request):
        """
        Fetches detailed data for each product from an external API and updates the database.
        Uses multithreading for API calls and bulk_update for database writes.
        """
        cutoff_time = timezone.now() - timedelta(hours=24)
        # Select related fields for efficient querying if needed later, though not directly used here
        # products_to_sync_qs = Product.objects.filter(isClearanceProduct=True)
        products_to_sync_qs = Product.objects.filter(active=True,isClearanceProduct=False).filter(lastSyncTimestamp__lt=cutoff_time)

        # Convert queryset to a list to avoid issues with concurrent access during iteration
        # if the database connection were to be closed/reopened by threads.
        # This is also necessary because futures.map consumes the iterator.
        products_to_sync_list = list(products_to_sync_qs)
        total_products_scanned = len(products_to_sync_list)

        updated_products_for_bulk = []
        failed_products = []
        categories_to_process = {} # To store product_id -> category_pks mapping for M2M update
        updated_count = 0

        # Use ThreadPoolExecutor for concurrent API requests
        # 'with' statement ensures threads are properly shut down
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
            # Map the _fetch_and_process_product_data function to each product
            # The 'future' objects are returned in the order the products were submitted.
            futures = {executor.submit(self._fetch_and_process_product_data, p): p for p in products_to_sync_list}

            for future in concurrent.futures.as_completed(futures):
                product_original_instance = futures[future] # Get the original product instance
                try:
                    result = future.result() # Get the result from the thread
                    if result["status"] == "success":
                        product_instance = result["product_instance"]
                        updated_products_for_bulk.append(product_instance)
                        
                        # Store category data for later processing (M2M)
                        categories_to_process[product_instance.pk] = result["category_data"]

                        # Perform bulk update when batch size is reached
                        if len(updated_products_for_bulk) >= self.BULK_UPDATE_BATCH_SIZE:
                            # Use a transaction for bulk update for atomicity
                            with transaction.atomic():
                                self._perform_bulk_update_and_m2m(updated_products_for_bulk, categories_to_process)
                                updated_count += len(updated_products_for_bulk)
                                print(f"Bulk updated {len(updated_products_for_bulk)} products. Total updated: {updated_count}")
                            
                            updated_products_for_bulk = [] # Reset batch
                            categories_to_process = {} # Reset category data

                    else:
                        failed_products.append({
                            "productId": result["productId"],
                            "error": result["error"]
                        })
                        print(f"Failed to process Product ID: {result['productId']}. Error: {result['error']}")

                except Exception as e:
                    # Catch exceptions that might occur during future.result() call itself
                    # (e.g., if _fetch_and_process_product_data raises an uncaught exception)
                    failed_products.append({
                        "productId": product_original_instance.productId,
                        "error": f"Error retrieving result for Product ID {product_original_instance.productId}: {e}"
                    })
                    print(f"Error retrieving result for Product ID {product_original_instance.productId}: {e}")

        # Process any remaining products that didn't fill a full batch
        if updated_products_for_bulk:
            with transaction.atomic():
                # self._perform_bulk_update_and_m2m(updated_products_for_bulk, categories_to_process)
                # just update the product without the categories
                Product.objects.bulk_update(updated_products_for_bulk, [
                    'sku', 'upc', 'productName', 'availableQuantity', 'masterProductId',
                    'masterProductName', 'standardPrice', 'tierPrice', 'costPrice',
                    'minimumSellingPrice', 'avgCostPrice', 'latestCostPrice', 'stdPrice',
                    'tier1Price', 'tier2Price', 'tier3Price', 'tier4Price', 'tier5Price',
                    'ecommerce', 'active', 'compositeProduct', 'trackInventory',
                    'trackInventoryByImei', 'returnable', 'urlAlias', 'shortDescription',
                    'fullDescription', 'metaKeyword', 'upc1', 'upc2', 'singleUpc',
                    'vendorUpc', 'size', 'quantity', 'reorderQuantity', 'minQuantity',
                    'caseQuantity', 'boxQuantity', 'childProductList', 'imageUrl',
                    'isClearanceProduct',
                    'lastSyncTimestamp'
                ])
                updated_count += len(updated_products_for_bulk)
                print(f"Final bulk update of {len(updated_products_for_bulk)} products. Total updated: {updated_count}")

        return JsonResponse({
            "status": "Completed",
            "total_products_scanned": total_products_scanned,
            "successfully_updated": updated_count,
            "failed_updates": len(failed_products),
            "failed_products": failed_products
        })

    def _perform_bulk_update_and_m2m(self, product_instances, categories_data_map):
        """
        Performs bulk_update for product fields and handles ManyToMany relationships
        for categories within a transaction.
        `product_instances`: A list of Product model instances to update.
        `categories_data_map`: A dictionary mapping product_pk to its API category data.
        """
        # 1. Prepare fields for bulk_update
        # List all fields that are being updated in the _fetch_and_process_product_data method
        update_fields = [
            'sku', 'upc', 'productName', 'availableQuantity', 'masterProductId',
            'masterProductName', 'standardPrice', 'tierPrice', 'costPrice',
            'minimumSellingPrice', 'avgCostPrice', 'latestCostPrice', 'stdPrice',
            'tier1Price', 'tier2Price', 'tier3Price', 'tier4Price', 'tier5Price',
            'ecommerce', 'active', 'compositeProduct', 'trackInventory',
            'trackInventoryByImei', 'returnable', 'urlAlias', 'shortDescription',
            'fullDescription', 'metaKeyword', 'upc1', 'upc2', 'singleUpc',
            'vendorUpc', 'size', 'quantity', 'reorderQuantity', 'minQuantity',
            'caseQuantity', 'boxQuantity', 'childProductList', 'imageUrl',
            'isClearanceProduct',
            'lastSyncTimestamp'
        ]


        # 2. Perform bulk update for Product model fields
        Product.objects.bulk_update(product_instances, update_fields)

        # 3. Handle ManyToMany relationships for categories
        # This needs to be done after the product instances are saved/updated,
        # as M2M relationships are managed by the database.
        # We also need to fetch/create categories first.

        # A set to store category PKs to be linked to products to avoid redundant lookups
        all_category_pks_to_fetch = set()
        product_to_category_ids_map = {} # Map product_id to list of category_ids from API

        # First, collect all unique category IDs from the current batch
        for product_pk, api_categories in categories_data_map.items():
            current_product_category_ids = []
            for cat_data in api_categories:
                if 'categoryId' in cat_data and 'name' in cat_data:
                    all_category_pks_to_fetch.add(cat_data['categoryId'])
                    current_product_category_ids.append(cat_data['categoryId'])
            product_to_category_ids_map[product_pk] = current_product_category_ids

        # Bulk create/update categories
        # Create a list of Category objects to create or update
        category_objects_to_create_or_update = []
        existing_categories = {cat.categoryId: cat for cat in Category.objects.filter(categoryId__in=list(all_category_pks_to_fetch))}
        
        for product_pk, api_categories in categories_data_map.items():
            for cat_data in api_categories:
                cat_id = cat_data.get('categoryId')
                if cat_id not in existing_categories:
                    # Create a new Category object
                    new_category = Category(
                        categoryId=cat_id,
                        name=cat_data.get('name'),
                        alias=cat_data.get('alias'),
                        parentId=cat_data.get('parentId'),
                        description=cat_data.get('description'),
                        ecommerce=cat_data.get('ecommerce'),
                    )
                    category_objects_to_create_or_update.append(new_category)
                    existing_categories[cat_id] = new_category # Add to our in-memory cache

        # Bulk create new categories
        Category.objects.bulk_create(category_objects_to_create_or_update, ignore_conflicts=True)
        # Refresh existing_categories to include newly created ones for M2M linking
        existing_categories = {cat.categoryId: cat for cat in Category.objects.filter(categoryId__in=list(all_category_pks_to_fetch))}

        # Prepare for bulk M2M updates using through model if possible,
        # or by iterating and using .set() if the direct `through` table is not exposed
        # or if `set` is preferred for clarity and simplicity here.
        # For ManyToMany fields, `set()` is generally the way to go per instance.
        # Bulk updating M2M is complex and often involves clearing and re-adding relations
        # to the intermediary table, which is usually not a single bulk_update call
        # but a combination of `bulk_create` for new relations and `delete` for old.
        # However, for simplicity and ensuring correctness, iterating and using `set()`
        # per product after its main fields are updated is often acceptable,
        # especially if the number of products in a batch (100) is not extremely large.

        product_category_relations_to_create = []
        product_category_relations_to_delete = []

        # Get all existing relations for the products in the current batch
        # This is efficient because we query for multiple products at once.
        existing_relations = Product.categories.through.objects.filter(
            product__in=product_instances
        ).values_list('product_id', 'category_id') # Get actual PKs, not categoryId from ERP API

        existing_relation_set = set(existing_relations) # For faster lookups

        # Collect relations to add and remove
        for product_instance in product_instances:
            # Get the actual Category PKs based on the ERP category IDs
            target_category_pks = [
                existing_categories[erp_cat_id].pk
                for erp_cat_id in product_to_category_ids_map.get(product_instance.pk, [])
                if erp_cat_id in existing_categories # Ensure category was found/created
            ]
            
            # Find relations to create
            for cat_pk in target_category_pks:
                if (product_instance.pk, cat_pk) not in existing_relation_set:
                    product_category_relations_to_create.append(
                        Product.categories.through(product_id=product_instance.pk, category_id=cat_pk)
                    )

            # Find relations to delete
            for prod_id, cat_id in existing_relation_set:
                if prod_id == product_instance.pk and cat_id not in target_category_pks:
                    # Mark for deletion
                    # We can't use bulk_delete directly with a list of instances, need to filter.
                    product_category_relations_to_delete.append((prod_id, cat_id))
        
        # Bulk create new M2M relations
        Product.categories.through.objects.bulk_create(product_category_relations_to_create, ignore_conflicts=True)

        # Bulk delete old M2M relations
        if product_category_relations_to_delete:
            # Extract product_ids and category_ids for efficient deletion
            delete_product_ids = [item[0] for item in product_category_relations_to_delete]
            delete_category_ids = [item[1] for item in product_category_relations_to_delete]
            
            # Delete in batches or use OR conditions for efficiency if needed
            Product.categories.through.objects.filter(
                product_id__in=delete_product_ids,
                category_id__in=delete_category_ids
            ).delete()

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
