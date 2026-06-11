from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from api.models import Product, SalesgentToken
from rest_framework.permissions import IsAuthenticated
import json
import csv
import requests
from django.conf import settings
import typesense
from django.http import StreamingHttpResponse
import random


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


class SyncProductsView(APIView):

    def post(self, request):
        token = SalesgentToken.objects.filter(id=1).first().accessToken

        def generate_progress():
            def syncSearchData():
                # Connect to Typesense
                client = typesense.Client(
                    {
                        "api_key": settings.TYPESENSE_API_KEY,
                        "nodes": [
                            {
                                "host": "purityai-typesense.hf.space",
                                "port": "443",
                                "protocol": "https",
                            },
                            {
                                "host": "thejagstudio-typesense.hf.space",
                                "port": "443",
                                "protocol": "https",
                            },
                        ],
                        "connection_timeout_seconds": 2,
                    }
                )

                # Prepare collection schema
                collection_name = "101"
                schema = {
                    "name": collection_name,
                    "fields": [
                        {"name": "id", "type": "auto"},
                        {"name": "productId", "type": "auto"},
                        {"name": "sku", "type": "auto"},
                        {"name": "upc", "type": "auto"},
                        {"name": "productName", "type": "auto"},
                        {"name": "availableQuantity", "type": "int32"},
                        {"name": "eta", "type": "auto"},
                        {"name": "imageUrl", "type": "auto"},
                        {"name": "masterProductId", "type": "auto"},
                        {"name": "masterProductName", "type": "auto"},
                        {"name": "standardPrice", "type": "auto"},
                        {"name": "tierPrice", "type": "auto"},
                        {"name": "costPrice", "type": "auto"},
                        {"name": "ecommerce", "type": "auto"},
                        {"name": "active", "type": "auto"},
                        {"name": "compositeProduct", "type": "auto"},
                        {"name": "stateRestricted", "type": "auto"},
                        {"name": "customerGroupRestricted", "type": "auto"},
                        {"name": "categories", "type": "auto", "facet": True},
                        {"name": "trackInventory", "type": "auto"},
                        {"name": "trackInventoryByImei", "type": "auto"},
                        {"name": "insertedTimestamp", "type": "auto"},
                        {"name": "size", "type": "auto"},
                    ],
                    "default_sorting_field": "availableQuantity",
                }

                # Delete collection if exists
                try:
                    client.collections[collection_name].delete()
                except Exception as e:
                    pass
                # Create collection
                client.collections.create(schema)
                print(f"Collection {collection_name} created successfully.")

                # Fetch products from API and import to Typesense
                totalPages = 10
                page = 0

                headers = {
                    "Accept": "application/json, text/plain",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Authorization": "Bearer " + token,
                    "Connection": "keep-alive",
                    "Referer": "https://erp.101distributorsga.com/product",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                }
                # Fetch all products first
                all_products = []
                while page <= totalPages:
                    response = requests.get(
                        f"https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page={page}&size=1000",
                        headers=headers,
                    )
                    products = []
                    try:
                        products = response.json()["result"]["content"]
                        totalPages = response.json()["result"]["totalPages"]
                    except Exception as e:
                        print(f"Error fetching products on page {page}: {e} {response.json()}")
                    for product in products:
                        product["id"] = str(product["id"])
                        product["eta"] = str(product["eta"])
                        product["masterProductName"] = str(product["masterProductName"])
                        try:
                            product["masterProductId"] = int(product["masterProductId"])
                        except:
                            product["masterProductId"] = 0
                        product["categories"] = str(product["categories"])
                        percent = (page / totalPages) * 50
                        all_products.append(product)
                    if len(all_products) > 0:
                        client.collections[collection_name].documents.import_(all_products, {"action": "create"})
                        tenRandomProducts = random.sample(all_products, 10) if len(all_products) > 10 else all_products
                        yield json.dumps({"progress": percent + (page / totalPages) * 50, "products": [{"name": product["productName"] if product else "No Products", "image": product["imageUrl"] if product else ""} for product in tenRandomProducts], "status": "fetching" if page < totalPages else "importing"}) + "\n"
                        all_products = []
                        page += 1
                    else:
                        break

                yield json.dumps({"progress": 100, "status": "completed"}) + "\n"

            try:
                yield from syncSearchData()
            except Exception as e:
                yield json.dumps({"error": str(e), "status": "error"}) + "\n"

        return StreamingHttpResponse(generate_progress(), content_type="text/event-stream")


def _serialize_sticker_product(product):
    return {
        "productId": product.productId,
        "id": product.productId,
        "productName": product.productName,
        "upc": product.upc,
        "sku": product.sku,
        "standardPrice": float(product.standardPrice or 0),
        "tierPrice": float(product.tierPrice or 0) if product.tierPrice is not None else None,
        "imageUrl": product.imageUrl,
        "masterProductId": product.masterProductId,
        "masterProductName": product.masterProductName,
        "availableQuantity": product.availableQuantity,
    }


class StickerHealthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Product.objects.filter(active=True).count()
        return Response({"ok": True, "active_product_count": count})


class StickerProductSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q

        upc = request.GET.get("upc", "").strip()
        name = request.GET.get("name", "").strip()
        search = request.GET.get("search", "").strip()
        limit = min(int(request.GET.get("limit", 20)), 50)

        qs = Product.objects.filter(active=True)

        if upc:
            qs = qs.filter(upc__iexact=upc)
        elif name:
            qs = qs.filter(productName__icontains=name)
        elif search:
            qs = qs.filter(
                Q(productName__icontains=search)
                | Q(upc__icontains=search)
                | Q(sku__icontains=search)
            )
        else:
            return Response({"error": "Provide upc, name, or search query"}, status=400)

        products = [_serialize_sticker_product(p) for p in qs[:limit]]
        return Response({"products": products, "count": len(products)})


class StickerBulkUpcView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        upcs = request.data.get("upcs", [])
        if not upcs:
            return Response({"error": "upcs required"}, status=400)

        normalized = []
        seen = set()
        for raw in upcs:
            upc = str(raw).strip()
            if upc and upc not in seen:
                seen.add(upc)
                normalized.append(upc)

        found_products = Product.objects.filter(active=True, upc__in=normalized)
        found_map = {p.upc: p for p in found_products}
        products = [_serialize_sticker_product(found_map[u]) for u in normalized if u in found_map]
        not_found = [u for u in normalized if u not in found_map]

        return Response(
            {
                "products": products,
                "notFoundUPCs": not_found,
                "found_count": len(products),
            }
        )
