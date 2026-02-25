import os
from django.shortcuts import render
import requests
from api.models import (
    BusinessType,
    Category,
    Product,
    Vendor,
    SalesgentToken,
    Customer,
    Invoice,
    InvoiceLineItem,
    ProductHistory,
    PurchaseHistory,
)
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import StreamingHttpResponse
import json
from django.core.cache import cache
from datetime import timedelta, datetime
from django.utils import timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.db import transaction
import typesense
import time
from django.conf import settings


def notifyMe(message, channel):
    try:
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }
        data = message
        response = requests.post(
            f"https://thejagstudio-ntfy.hf.space/{channel}",
            headers=headers,
            data=data,
        )
        print(response.text)
    except Exception as e:
        print(f"Error notifying: {e}")
    return


def syncProducts(token):
    totalPages = 80
    i = 0
    categoryNameMap = {
        category.name: category for category in Category.objects.all()
    }
    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9",
        "Authorization": "Bearer " + token,
        "Connection": "keep-alive",
        "Referer": "https://erp.101distributorsga.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }
    productList = []

    while i <= totalPages:
        try:
            response = requests.get(
                "https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page="
                + str(i)
                + "&size=1000",
                headers=headers,
            )
            totalPages = response.json()["result"]["totalPages"]
            data = response.json()["result"]["content"]
            print(f"Fetching products from page {i + 1} of {totalPages}")
            for product in data:
                productList.append(product)
            i += 1
        except Exception as e:
            print(f"Error fetching products from page {i + 1}: {e}")
            yield 100
        yield (i * 15) / totalPages
    i = 0
    while i <= totalPages:
        try:
            response = requests.get(
                "https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page="
                + str(i)
                + "&size=1000&active=false",
                headers=headers,
            )
            totalPages = response.json()["result"]["totalPages"]
            data = response.json()["result"]["content"]
            for product in data:
                productList.append(product)
            i += 1
        except Exception as e:
            print(f"Error fetching products from page {i + 1}: {e}")
            yield 100
        yield 15 + (i * 15) / totalPages

    totalProducts = len(productList)
    for i in range(0, totalProducts, 1000):
        product_categories_map = {}
        productObjList = []
        for product in productList[i : i + 1000]:
            upc = product.get("upc", "")
            if upc is not None and upc != "":
                categories = []
                for category in product.get("categories", []).split(","):
                    category = category.strip()
                    if category:
                        cat_obj = categoryNameMap.get(category)
                        if cat_obj:
                            categories.append(cat_obj)

                productObj = Product(
                    productId=product["productId"],
                    sku=product.get("sku", ""),
                    upc=product.get("upc", ""),
                    productName=product.get("productName", ""),
                    availableQuantity=product.get("availableQuantity", 0),
                    imageUrl=product.get("imageUrl", ""),
                    masterProductId=product.get("masterProductId"),
                    masterProductName=product.get("masterProductName"),
                    standardPrice=product.get("standardPrice", 0),
                    tierPrice=product.get("tierPrice", 0),
                    costPrice=product.get("costPrice", 0),
                    ecommerce=product.get("ecommerce", False),
                    active=product.get("active", False),
                    compositeProduct=product.get("compositeProduct", False),
                    stateRestricted=product.get("stateRestricted", False),
                    customerGroupRestricted=product.get(
                        "customerGroupRestricted", False
                    ),
                    trackInventory=product.get("trackInventory", False),
                    trackInventoryByImei=product.get(
                        "trackInventoryByImei", False
                    ),
                    size=product.get("size", 0),
                    returnable=product.get("returnable", False),
                    minimumSellingPrice=product.get("minimumSellingPrice", 0),
                )
                productObjList.append(productObj)
                if categories:
                    product_categories_map[product["productId"]] = categories

        productExists = Product.objects.filter(
            productId__in=[p.productId for p in productObjList]
        ).values_list("productId", flat=True)
        # bulk create or update products
        products_to_update = [
            p for p in productObjList if p.productId in productExists
        ]
        products_to_create = [
            p for p in productObjList if p.productId not in productExists
        ]
        if products_to_create:
            # do bulk create
            with transaction.atomic():
                Product.objects.bulk_create(
                    products_to_create,
                    ignore_conflicts=False,
                )
                category_relations = [
                    Product.categories.through(
                        product_id=product.productId,
                        category_id=category.categoryId,
                    )
                    for product in products_to_update
                    for category in product_categories_map.get(
                        product.productId, []
                    )
                ]

                # Bulk create the many-to-many relationships
                if category_relations:
                    Product.categories.through.objects.bulk_create(
                        category_relations, ignore_conflicts=True
                    )
        else:
            with transaction.atomic():
                Product.objects.bulk_update(
                    products_to_update,
                    [
                        "sku",
                        "upc",
                        "productName",
                        "availableQuantity",
                        "imageUrl",
                        "standardPrice",
                        "tierPrice",
                        "costPrice",
                        "ecommerce",
                        "active",
                    ],
                )
                # Create a list of many-to-many relationships
                # Clear existing category relationships and create new ones
                product_ids = [p.productId for p in products_to_update]
                Product.categories.through.objects.filter(
                    product_id__in=product_ids
                ).delete()

                # Create new category relationships
                category_relations = [
                    Product.categories.through(
                        product_id=product.productId,
                        category_id=category.categoryId,
                    )
                    for product in products_to_update
                    for category in product_categories_map.get(
                        product.productId, []
                    )
                ]

                # Bulk create the many-to-many relationships
                if category_relations:
                    Product.categories.through.objects.bulk_create(
                        category_relations, ignore_conflicts=False
                    )
        yield 30 + (i * 70) / totalProducts


def syncBusinessTypes(token):
    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
        "Authorization": f"Bearer {token}",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": "https://erp.101distributorsga.com",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }

    response = requests.get(
        "https://erp.101distributorsga.com/api/store/businessType",
        headers=headers,
    )
    data = response.json()
    if data["hasError"]:
        raise Exception("Error fetching business types: " + data["message"])
    else:
        business_types = data["result"]
        totalBusinessTypes = len(business_types)
        i = 0
        for business_type in business_types:
            BusinessType.objects.update_or_create(
                name=business_type["name"],
                defaults={
                    "imageUrl": business_type.get("imageUrl", ""),
                    "description": business_type.get("description", ""),
                    "insertedTimestamp": timezone.now(),
                },
            )
            i += 1
            yield (i * 100) / totalBusinessTypes


def syncVendors(token):
    vendors = []
    totalElements = 1000
    totalPages = 10
    j = 0
    i = 0
    while i < totalPages:
        headers = {
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
            "Authorization": "Bearer " + token,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Pragma": "no-cache",
            "Referer": "https://erp.101distributorsga.com/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }

        params = {
            "page": str(i),
            "size": "500",
            "storeIds": "1,2",
        }

        response = requests.get(
            "https://erp.101distributorsga.com/api/vendor/list",
            params=params,
            headers=headers,
        )
        if response.json()["hasError"]:
            yield response.json()["error"]["message"]
        else:
            data = response.json()["result"]["content"]
            totalPages = response.json()["result"]["totalPages"]
            totalElements = response.json()["result"]["totalElements"]
            if len(data) > 0:
                for vendorData in data:
                    # create or update the vendor
                    Vendor.objects.update_or_create(
                        id=vendorData.get("id"),
                        defaults={
                            "name": vendorData.get("name"),
                            "company": vendorData.get("company"),
                            "dbaName": vendorData.get("dbaName"),
                            "active": vendorData.get("active", True),
                            "address1": vendorData.get("address1"),
                            "address2": vendorData.get("address2"),
                            "city": vendorData.get("city"),
                            "stateId": vendorData.get("stateId", 0),
                            "stateName": vendorData.get("stateName"),
                            "zip": vendorData.get("zip"),
                            "country": vendorData.get("country"),
                            "countryId": vendorData.get("countryId", 0),
                            "county": vendorData.get("county"),
                            "phone": vendorData.get("phone"),
                            "workPhone": vendorData.get("workPhone"),
                            "email": vendorData.get("email"),
                            "websiteUrl": vendorData.get("websiteUrl"),
                            "websiteUsername": vendorData.get(
                                "websiteUsername"
                            ),
                            "websitePassword": vendorData.get(
                                "websitePassword"
                            ),
                            "portalUserName": vendorData.get("portalUserName"),
                            "portalPassword": vendorData.get("portalPassword"),
                            "taxId": vendorData.get("taxId"),
                            "feinNumber": vendorData.get("feinNumber"),
                            "description": vendorData.get("description"),
                            "dueAmount": vendorData.get("dueAmount", 0),
                            "excessAmount": vendorData.get("excessAmount", 0),
                            "storeCredit": vendorData.get("storeCredit", 0),
                            "insuranceExpiryDate": vendorData.get(
                                "insuranceExpiryDate"
                            ),
                            "manufacturerId": vendorData.get("manufacturerId"),
                            "manufacturerType": vendorData.get(
                                "manufacturerType"
                            ),
                            "msaTypeId": vendorData.get("msaTypeId"),
                            "msaTypeName": vendorData.get("msaTypeName"),
                            "paymentTermsId": vendorData.get("paymentTermsId"),
                            "paymentTermsName": vendorData.get(
                                "paymentTermsName"
                            ),
                            "primarySalesRepresentativeId": vendorData.get(
                                "primarySalesRepresentativeId"
                            ),
                            "primarySalesRepresentativeName": vendorData.get(
                                "primarySalesRepresentativeName"
                            ),
                            "createdBy": vendorData.get("createdBy"),
                            "updatedBy": vendorData.get("updatedBy"),
                            "insertedTimestamp": vendorData.get(
                                "insertedTimestamp"
                            ),
                            "updatedTimestamp": vendorData.get(
                                "updatedTimestamp"
                            ),
                        },
                    )
                    j += 1
                    yield (j * 100) / totalElements
            else:
                print("No vendors found in this page, skipping...")
                yield 100
        i += 1
        if i >= totalPages:
            yield 100
            break


def syncCategories(token):
    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
        "Authorization": f"Bearer {token}",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": "https://erp.101distributorsga.com",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }

    response = requests.get(
        "https://erp.101distributorsga.com/api/category/all", headers=headers
    )
    data = response.json()
    if data["hasError"]:
        raise Exception("Error fetching categories: " + data)
    else:
        categories = data["result"]
        totalCategories = len(categories)
        i = 0
        for category_data in categories:
            # Process each top-level category
            category_obj, created = Category.objects.update_or_create(
                categoryId=category_data["id"],
                defaults={
                    "name": category_data.get("name", ""),
                    "alias": category_data.get("alias", ""),
                    "parentId": category_data.get("parentId"),
                    "parentIdStr": category_data.get("parentIdStr"),
                    "imageUrl": category_data.get("imageUrl"),
                    "description": category_data.get("description"),
                    "ecommerce": category_data.get("ecommerce", False),
                    "customerSpecific": category_data.get(
                        "customerSpecific", False
                    ),
                    "loginRequired": category_data.get("loginRequired", False),
                    "repairCategory": category_data.get(
                        "repairCategory", False
                    ),
                    "businessTypeId": category_data.get("businessTypeId"),
                    "businessTypeName": category_data.get("businessTypeName"),
                    "sequenceNumber": category_data.get("sequenceNumber", 0),
                    "metaTitle": category_data.get("metaTitle"),
                    "metaData": category_data.get("metaData"),
                    "metaDescription": category_data.get("metaDescription"),
                    "deleted": category_data.get("deleted", False),
                    "lastSyncTimestamp": timezone.now(),
                },
            )
            i += 1
            yield (i * 80) / totalCategories

        # Handle businessTypeList
        if (
            "businessTypeList" in category_data
            and category_data["businessTypeList"]
        ):
            business_types = []
            for bt in category_data["businessTypeList"]:
                bt_obj, _ = BusinessType.objects.get_or_create(
                    name=bt["name"],
                    defaults={
                        "imageUrl": bt.get("imageUrl"),
                        "description": bt.get("description"),
                    },
                )
                business_types.append(bt_obj)
            category_obj.businessTypeList.set(business_types)
        yield 100


def syncSearchData(token):
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
        print(
            f"Collection {collection_name} does not exist or could not be deleted: {e}"
        )
    # Create collection
    client.collections.create(schema)

    # Fetch products from API and import to Typesense

    totalPages = 10
    page = 0

    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
        "Authorization": "Bearer " + token,
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": "https://erp.101distributorsga.com/product",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }
    # Fetch all products first
    all_products = []
    while page <= totalPages:
        response = requests.request("GET", f"https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page={page}&size=1000", headers=headers)
        products = []
        try:
            products = response.json()["result"]["content"]
            totalPages = response.json()["result"]["totalPages"]
        except Exception as e:
            print(
                f"Error fetching products on page {page}: {e} {response.json()}"
            )
        for product in products:
            product["id"] = str(product["id"])
            product["eta"] = str(product["eta"])
            product["masterProductName"] = str(product["masterProductName"])
            try:
                product["masterProductId"] = int(product["masterProductId"])
            except:
                product["masterProductId"] = 0
            product["categories"] = str(product["categories"])
            all_products.append(product)
        percent = (page / totalPages) * 50
        page += 1
        yield percent

    # Import to Typesense in chunks of 1000
    for i in range(0, len(all_products), 1000):
        client.collections[collection_name].documents.import_(
            all_products[i : i + 1000], {"action": "create"}
        )
        percent = 50 + ((i + 1000) / len(all_products)) * 50
        yield percent

    yield 100


def syncCustomers(token):
    totalPages = 50
    i = 0
    customers = []
    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
        "Authorization": "Bearer " + token,
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": "https://erp.101distributorsga.com/customer",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }
    while i <= totalPages:
        try:
            response = requests.get(
                f"https://erp.101distributorsga.com/api/customer/list?storeIds=1,2&page={i}&size=500&showEmployeeSpecificData=false",
                headers=headers,
            )
            customers.extend(response.json()["result"]["content"])
            totalPages = response.json()["result"]["totalPages"]
            i = i + 1
            yield (i * 15) / (totalPages + 1)
        except Exception as e:
            print(f"Error fetching customers on page {i}: {e}")
            yield 100
            break
    totalPages = 50
    i = 0
    while i <= totalPages:
        try:
            response = requests.get(
                f"https://erp.101distributorsga.com/api/customer/list?storeIds=1,2&page={i}&size=500&showEmployeeSpecificData=false&active=false",
                headers=headers,
            )
            customers.extend(response.json()["result"]["content"])
            totalPages = response.json()["result"]["totalPages"]
            i = i + 1
            yield 15 + (i * 15) / (totalPages + 1)
        except Exception as e:
            print(f"Error fetching customers on page {i}: {e}")
            yield 100
            break
    totalCustomers = len(customers)
    yield 30
    # list all customers which exists in the database
    existing_customers = set(Customer.objects.values_list("id", flat=True))

    # Separate customers into new and existing
    customers_to_create = []
    customers_to_update = []
    i = 0
    for customer in customers:
        if customer["id"] in existing_customers:
            customers_to_update.append(
                Customer(
                    id=customer["id"],
                    insertedTimestamp=(
                        timezone.make_aware(
                            datetime.strptime(
                                customer["insertedTimestamp"],
                                "%Y-%m-%d %H:%M:%S",
                            )
                        )
                        if customer["insertedTimestamp"]
                        else None
                    ),
                    name=customer["name"],
                    company=customer["company"],
                    storeId=customer["storeId"],
                    email=customer["email"],
                    phone=customer["phone"],
                    tier=customer["tier"],
                    notes=customer["notes"],
                    storeCredit=customer["storeCredit"],
                    loyaltyPoints=customer["loyaltyPoints"],
                    dueAmount=customer["dueAmount"],
                    excessAmount=customer["excessAmount"],
                    active=customer["active"],
                    verified=customer["verified"],
                    viewSpecificCategory=customer["viewSpecificCategory"],
                    viewSpecificProduct=customer["viewSpecificProduct"],
                    salesRepresentativeName=customer["salesRepresentativeName"],
                    taxable=customer["taxable"],
                    communicateViaPhone=customer["communicateViaPhone"],
                    communicateViaText=customer["communicateViaText"],
                    dbaName=customer["dbaName"],
                    address1=customer["address1"],
                    stateId=customer["stateId"],
                    billingStateId=customer["billingStateId"],
                    sendDuePaymentReminder=customer["sendDuePaymentReminder"],
                    rewardable=customer["rewardable"],
                    saveProductPrice=customer["saveProductPrice"],
                )
            )
        else:
            customers_to_create.append(
                Customer(
                    id=customer["id"],
                    insertedTimestamp=(
                        timezone.make_aware(
                            datetime.strptime(
                                customer["insertedTimestamp"],
                                "%Y-%m-%d %H:%M:%S",
                            )
                        )
                        if customer["insertedTimestamp"]
                        else None
                    ),
                    name=customer["name"],
                    company=customer["company"],
                    storeId=customer["storeId"],
                    email=customer["email"],
                    phone=customer["phone"],
                    tier=customer["tier"],
                    notes=customer["notes"],
                    storeCredit=customer["storeCredit"],
                    loyaltyPoints=customer["loyaltyPoints"],
                    dueAmount=customer["dueAmount"],
                    excessAmount=customer["excessAmount"],
                    active=customer["active"],
                    verified=customer["verified"],
                    viewSpecificCategory=customer["viewSpecificCategory"],
                    viewSpecificProduct=customer["viewSpecificProduct"],
                    salesRepresentativeName=customer["salesRepresentativeName"],
                    taxable=customer["taxable"],
                    communicateViaPhone=customer["communicateViaPhone"],
                    communicateViaText=customer["communicateViaText"],
                    dbaName=customer["dbaName"],
                    address1=customer["address1"],
                    stateId=customer["stateId"],
                    billingStateId=customer["billingStateId"],
                    sendDuePaymentReminder=customer["sendDuePaymentReminder"],
                    rewardable=customer["rewardable"],
                    saveProductPrice=customer["saveProductPrice"],
                )
            )
        i += 1
        yield 30 + ((i * 30) / totalCustomers)

    # Bulk create new customers
    if customers_to_create:
        Customer.objects.bulk_create(customers_to_create, ignore_conflicts=True)
        yield 70

    # Bulk update existing customers
    if customers_to_update:
        Customer.objects.bulk_update(
            customers_to_update,
            [
                "insertedTimestamp",
                "name",
                "company",
                "storeId",
                "email",
                "phone",
                "tier",
                "notes",
                "storeCredit",
                "loyaltyPoints",
                "dueAmount",
                "excessAmount",
                "active",
                "verified",
                "viewSpecificCategory",
                "viewSpecificProduct",
                "salesRepresentativeName",
                "taxable",
                "communicateViaPhone",
                "communicateViaText",
                "dbaName",
                "address1",
                "stateId",
                "billingStateId",
                "sendDuePaymentReminder",
                "rewardable",
                "saveProductPrice",
            ],
        )
        yield 100


def syncInvoices(token):

    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
        "Authorization": "Bearer " + token,
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": "https://erp.101distributorsga.com/sales",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    }
    totalPages = 10
    page = 0
    while page <= totalPages:
        response = requests.get(
            f"https://erp.101distributorsga.com/api/order/list?storeIds=1,2&page={page}&size=10000&showEmployeeSpecificData=false",
            headers=headers,
        )
        try:
            data = response.json()
            if data["hasError"]:
                notifyMe("Sync Error : " + data["errorMessage"], "101-error")
                return Response(
                    {"status": "error", "message": data["errorMessage"]},
                    status=400,
                )
            totalPages = data["result"]["totalPages"]
            content = data["result"]["content"]
            invoices_to_create = []
            invoices_to_update = []

            # Get existing invoice IDs from database
            existing_invoice_ids = set(
                Invoice.objects.values_list("id", flat=True)
            )

            # premap the customer IDs
            customer_id_map = {
                customer.id: customer for customer in Customer.objects.all()
            }

            for invoice in content:
                # Convert timestamps
                inserted_timestamp = (
                    timezone.make_aware(
                        datetime.strptime(
                            invoice["insertedTimestamp"], "%Y-%m-%d %H:%M:%S"
                        )
                    )
                    if invoice["insertedTimestamp"]
                    else None
                )
                due_date = (
                    timezone.make_aware(
                        datetime.strptime(
                            invoice["dueDate"].split(".")[0],
                            "%Y-%m-%dT%H:%M:%S",
                        )
                    )
                    if invoice["dueDate"]
                    else None
                )

                invoice_obj = Invoice(
                    id=invoice["id"],
                    totalQuantity=invoice.get("totalQuantity", 0),
                    discount=invoice.get("discount", 0),
                    totalAmount=invoice.get("totalAmount", 0),
                    status=invoice.get("status", ""),
                    insertedTimestamp=inserted_timestamp,
                    customerId=customer_id_map.get(invoice.get("customerId")),
                    customerName=invoice.get("customerName", ""),
                    companyName=invoice.get("companyName", ""),
                    email=invoice.get("email"),
                    storeName=invoice.get("storeName", ""),
                    orderTags=invoice.get("orderTags"),
                    dueAmount=invoice.get("dueAmount", 0),
                    dueDate=due_date,
                    orderNotes=invoice.get("orderNotes"),
                    salesRepId=invoice.get("salesRepId"),
                    salesRepName=invoice.get("salesRepName", ""),
                    pickerId=invoice.get("pickerId"),
                    pickerName=invoice.get("pickerName"),
                    trackingUrl=invoice.get("trackingUrl"),
                    trackingNumber=invoice.get("trackingNumber"),
                    salesOrderId=invoice.get("salesOrderId"),
                    quotationId=invoice.get("quotationId"),
                    shippingStatusId=invoice.get("shippingStatusId"),
                    shippingStatusName=invoice.get("shippingStatusName", ""),
                    stateId=invoice.get("stateId"),
                    state=invoice.get("state", ""),
                    city=invoice.get("city", ""),
                    county=invoice.get("county"),
                    dbaName=invoice.get("dbaName"),
                    lastSyncTimestamp=timezone.now(),
                )

                if invoice["id"] in existing_invoice_ids:
                    invoices_to_update.append(invoice_obj)
                else:
                    invoices_to_create.append(invoice_obj)

            # Bulk create new invoices
            if invoices_to_create:
                Invoice.objects.bulk_create(invoices_to_create, batch_size=1000)

            # Bulk update existing invoices
            if invoices_to_update:
                Invoice.objects.bulk_update(
                    invoices_to_update,
                    fields=[
                        "totalQuantity",
                        "discount",
                        "totalAmount",
                        "status",
                        "insertedTimestamp",
                        "customerName",
                        "companyName",
                        "email",
                        "storeName",
                        "orderTags",
                        "dueAmount",
                        "dueDate",
                        "orderNotes",
                        "salesRepId",
                        "salesRepName",
                        "pickerId",
                        "pickerName",
                        "trackingUrl",
                        "trackingNumber",
                        "salesOrderId",
                        "quotationId",
                        "shippingStatusId",
                        "shippingStatusName",
                        "stateId",
                        "state",
                        "city",
                        "county",
                        "dbaName",
                        "lastSyncTimestamp",
                    ],
                    batch_size=1000,
                )

            page += 1
            yield (page * 100) / totalPages
        except Exception as e:
            notifyMe("Sync Error : " + str(e), "101-error")
            return Response({"status": "error", "message": str(e)}, status=400)
    yield 100


def productSales(productId, token):
    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
        "Authorization": f"Bearer {token}",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": f"https://erp.101distributorsga.com/product/{productId}/edit",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }
    today = timezone.now().strftime("%Y-%m-%d+%H:%M:%S")
    response = requests.get(
        f"https://erp.101distributorsga.com/api/report/sales/byProductSummary/product/{productId}?storeIds=1,2&status=Pending+Payment,Partially+Paid,Paid,Completed&shippingStatusIds=664,665&startDate=2015-01-01+04:00:00&endDate={today}&page=0&size=90000000",
        headers=headers,
    )
    data = response.json()
    if data["hasError"]:
        notifyMe("Sync Error : " + str(data["errorMessage"]), "101-error")
        return Response(
            {"status": "error", "message": str(data["errorMessage"])},
            status=400,
        )
    else:
        return data["result"]["salesByProductList"]["content"]


def purchaseHistory(productId, token):
    headers = {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
        "Authorization": f"Bearer {token}",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
        "Referer": f"https://erp.101distributorsga.com/product/{productId}/edit",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }
    today = timezone.now().strftime("%Y-%m-%d+%H:%M:%S")
    response = requests.get(
        f"https://erp.101distributorsga.com/api/report/purchase/byProduct?productId={productId}&storeIds=1,2&startDate=2019-01-01+05:00:00&endDate={today}&page=0&size=9000000",
        headers=headers,
    )
    data = response.json()
    if data["hasError"]:
        notifyMe("Sync Error : " + str(data["errorMessage"]), "101-error")
        return []
    else:
        return data["result"]["purchaseByProductDtoPage"]["content"]


def fetch_product_data(product, token):
    try:
        product_id = product.productId
        # check if file exists
        if os.path.exists(f"./dataHistory/product_{product_id}_sales.json"):
            with open(
                f"./dataHistory/product_{product_id}_sales.json", "r"
            ) as f:
                data = json.load(f)
                sales_data = data.get("sales_data", [])
                purchase_data = data.get("purchase_data", [])
                skip = True
        else:
            sales_data = productSales(product_id, token)
            purchase_data = purchaseHistory(product_id, token)
            with open(
                f"./dataHistory/product_{product_id}_sales.json", "w"
            ) as f:
                data = {
                    "sales_data": sales_data,
                    "purchase_data": purchase_data,
                }
                f.write(json.dumps(data, indent=4))
            skip = False
        if not skip:
            print(
                f"Data for product {product_id} fetched successfully with {len(sales_data)} sales records and {len(purchase_data)} purchase records."
            )
        return {
            "product": product,
            "sales_data": sales_data,
            "purchase_data": purchase_data,
            "error": None,
            "skip": skip,
        }
    except Exception as e:
        print(f"Error fetching data for product {product.productId}: {e}")
        return {
            "product": product,
            "sales_data": [],
            "purchase_data": [],
            "error": e,
        }


def syncProductHistory(token):
    # get all ids from ./dataHistory/
    existing_ids = set()
    for filename in os.listdir("./dataHistory"):
        if filename.startswith("product_") and filename.endswith("_sales.json"):
            product_id = filename.split("_")[1]
            existing_ids.add(product_id)

    products = list(
        Product.objects.filter(active=True)
        # .exclude(productId__in=existing_ids)
        .order_by("productId")
    )
    product_count = len(products)
    print(f"Total products to sync history for: {product_count}")
    doUpdate = False
    if product_count == 0:
        yield 100
        return

    batch_size = 16
    processed_count = 0
    fullBatch = []
    for i in range(0, product_count, batch_size):
        product_batch = products[i : i + batch_size]

        # Use a ThreadPoolExecutor to fetch data for the current batch in parallel
        # with ThreadPoolExecutor(max_workers=batch_size) as executor:
        #     # Submit the fetch_product_data function for each product in the batch
        #     future_to_product = {
        #         executor.submit(fetch_product_data, product, token): product
        #         for product in product_batch
        #     }

        #     # This list will hold the results from the threads
        #     batch_results = []
        #     for future in as_completed(future_to_product):
        #         try:
        #             data = future.result()
        #             if data["skip"]:
        #                 continue
        #             batch_results.append(data)
        #         except Exception as exc:
        #             product = future_to_product[future]
        #             print(
        #                 f"Product {product.productId} generated an exception: {exc}"
        #             )
        #     fullBatch.extend(batch_results)

        for product in product_batch:
            with open(
                f"./dataHistory/product_{product.productId}_sales.json", "r"
            ) as f:
                data = json.load(f)
                sales_data = data.get("sales_data", [])
                purchase_data = data.get("purchase_data", [])
            fullBatch.append(
                {
                    "product": product,
                    "sales_data": sales_data,
                    "purchase_data": purchase_data,
                    "error": None,
                }
            )

        if len(fullBatch) > 200:
            # Now that all data for the batch is fetched, process it for DB operations
            for result in fullBatch:
                if result["error"]:
                    # Skip products that had fetching errors
                    processed_count += 1
                    continue

                product = result["product"]
                sales_data = result["sales_data"]
                purchase_data = result["purchase_data"]

                # --- Process Sales Data in Bulk (for one product) ---
                if sales_data:
                    sales_to_create = []
                    sales_to_update = []

                    incoming_sale_dates = {
                        timezone.make_aware(
                            datetime.strptime(
                                sale["insertedTimestamp"], "%Y-%m-%d %H:%M:%S"
                            )
                        )
                        for sale in sales_data
                        if sale.get("insertedTimestamp")
                    }

                    if incoming_sale_dates:
                        existing_sales = ProductHistory.objects.filter(
                            productId=product, date__in=incoming_sale_dates
                        )
                        existing_sales_map = {
                            sale.date: sale for sale in existing_sales
                        }

                        for sale in sales_data:
                            if not sale.get("insertedTimestamp"):
                                continue

                            sale_date = timezone.make_aware(
                                datetime.strptime(
                                    sale["insertedTimestamp"],
                                    "%Y-%m-%d %H:%M:%S",
                                )
                            )

                            defaults = {
                                "quantity": sale.get("totalQuantity", 0),
                                "costPrice": sale.get("costPrice", 0),
                                "retailPrice": sale.get("retailPrice", 0),
                            }

                            if sale_date in existing_sales_map:
                                if doUpdate:
                                    existing_sale_obj = existing_sales_map[
                                        sale_date
                                    ]
                                    for key, value in defaults.items():
                                        setattr(existing_sale_obj, key, value)
                                    sales_to_update.append(existing_sale_obj)
                            else:
                                sales_to_create.append(
                                    ProductHistory(
                                        productId=product,
                                        date=sale_date,
                                        **defaults,
                                    )
                                )

                        if sales_to_create:
                            ProductHistory.objects.bulk_create(sales_to_create)
                        if (
                            sales_to_update
                        ):  # doUpdate is implicitly checked by this list being populated
                            ProductHistory.objects.bulk_update(
                                sales_to_update,
                                ["quantity", "costPrice", "retailPrice"],
                            )

                # --- Process Purchase Data in Bulk (for one product) ---
                if purchase_data:
                    purchases_to_create = []
                    purchases_to_update = []

                    vendor_ids = {
                        p["vendorId"]
                        for p in purchase_data
                        if p.get("vendorId")
                    }
                    vendor_map = {
                        v.id: v
                        for v in Vendor.objects.filter(id__in=vendor_ids)
                    }

                    incoming_po_ids = {
                        p["purchaseOrderId"]
                        for p in purchase_data
                        if p.get("purchaseOrderId")
                    }
                    if incoming_po_ids:
                        existing_purchases = PurchaseHistory.objects.filter(
                            productId=product,
                            purchaseOrderId__in=incoming_po_ids,
                        )
                        existing_purchases_map = {
                            p.purchaseOrderId: p for p in existing_purchases
                        }

                        for purchase in purchase_data:
                            po_id = purchase.get("purchaseOrderId")
                            if not po_id or not purchase.get(
                                "purchaseOrderInsertedTimestamp"
                            ):
                                continue

                            vendor = vendor_map.get(purchase.get("vendorId"))

                            defaults = {
                                "upc": purchase.get("upc"),
                                "sku": purchase.get("sku"),
                                "name": purchase.get("name", ""),
                                "purchasedQuantity": purchase.get(
                                    "purchasedQuantity", 0
                                ),
                                "passedQuantity": purchase.get(
                                    "passedQuantity", 0
                                ),
                                "failedQuantity": purchase.get(
                                    "failedQuantity", 0
                                ),
                                "costPrice": purchase.get("costPrice", 0),
                                "totalCostPrice": purchase.get(
                                    "totalCostPrice", 0
                                ),
                                "vendorId": vendor,
                                "vendorName": purchase.get("vendorName", ""),
                                "billId": purchase.get("billId"),
                                "purchaseOrderInsertedTimestamp": timezone.make_aware(
                                    datetime.strptime(
                                        purchase[
                                            "purchaseOrderInsertedTimestamp"
                                        ],
                                        "%Y-%m-%d %H:%M:%S",
                                    )
                                ),
                                "billInsertedTimestamp": (
                                    timezone.make_aware(
                                        datetime.strptime(
                                            purchase["billInsertedTimestamp"],
                                            "%Y-%m-%d %H:%M:%S",
                                        )
                                    )
                                    if purchase.get("billInsertedTimestamp")
                                    else None
                                ),
                            }

                            if po_id in existing_purchases_map:
                                if doUpdate:
                                    existing_purchase_obj = (
                                        existing_purchases_map[po_id]
                                    )
                                    for key, value in defaults.items():
                                        setattr(
                                            existing_purchase_obj, key, value
                                        )
                                    purchases_to_update.append(
                                        existing_purchase_obj
                                    )
                            else:
                                purchases_to_create.append(
                                    PurchaseHistory(
                                        purchaseOrderId=po_id,
                                        productId=product,
                                        **defaults,
                                    )
                                )

                        if purchases_to_create:
                            PurchaseHistory.objects.bulk_create(
                                purchases_to_create
                            )
                        if purchases_to_update:
                            update_fields = [
                                "upc",
                                "sku",
                                "name",
                                "purchasedQuantity",
                                "passedQuantity",
                                "failedQuantity",
                                "costPrice",
                                "totalCostPrice",
                                "vendorId",
                                "vendorName",
                                "billId",
                                "purchaseOrderInsertedTimestamp",
                                "billInsertedTimestamp",
                            ]
                            PurchaseHistory.objects.bulk_update(
                                purchases_to_update, update_fields
                            )

                # Update and yield progress after each product is fully processed
                processed_count += 1
                yield (processed_count * 100) / product_count
            fullBatch = []  # Clear the batch after processing
    if len(fullBatch) > 0:
        for result in fullBatch:
            if result["error"]:
                # Skip products that had fetching errors
                processed_count += 1
                continue

            product = result["product"]
            sales_data = result["sales_data"]
            purchase_data = result["purchase_data"]

            # --- Process Sales Data in Bulk (for one product) ---
            if sales_data:
                sales_to_create = []
                sales_to_update = []

                incoming_sale_dates = {
                    timezone.make_aware(
                        datetime.strptime(
                            sale["insertedTimestamp"], "%Y-%m-%d %H:%M:%S"
                        )
                    )
                    for sale in sales_data
                    if sale.get("insertedTimestamp")
                }

                if incoming_sale_dates:
                    existing_sales = ProductHistory.objects.filter(
                        productId=product, date__in=incoming_sale_dates
                    )
                    existing_sales_map = {
                        sale.date: sale for sale in existing_sales
                    }

                    for sale in sales_data:
                        if not sale.get("insertedTimestamp"):
                            continue

                        sale_date = timezone.make_aware(
                            datetime.strptime(
                                sale["insertedTimestamp"], "%Y-%m-%d %H:%M:%S"
                            )
                        )

                        defaults = {
                            "quantity": sale.get("totalQuantity", 0),
                            "costPrice": sale.get("costPrice", 0),
                            "retailPrice": sale.get("retailPrice", 0),
                        }

                        if sale_date in existing_sales_map:
                            if doUpdate:
                                existing_sale_obj = existing_sales_map[
                                    sale_date
                                ]
                                for key, value in defaults.items():
                                    setattr(existing_sale_obj, key, value)
                                sales_to_update.append(existing_sale_obj)
                        else:
                            sales_to_create.append(
                                ProductHistory(
                                    productId=product,
                                    date=sale_date,
                                    **defaults,
                                )
                            )

                    if sales_to_create:
                        ProductHistory.objects.bulk_create(sales_to_create)
                    if (
                        sales_to_update
                    ):  # doUpdate is implicitly checked by this list being populated
                        ProductHistory.objects.bulk_update(
                            sales_to_update,
                            ["quantity", "costPrice", "retailPrice"],
                        )

            # --- Process Purchase Data in Bulk (for one product) ---
            if purchase_data:
                purchases_to_create = []
                purchases_to_update = []

                vendor_ids = {
                    p["vendorId"] for p in purchase_data if p.get("vendorId")
                }
                vendor_map = {
                    v.id: v for v in Vendor.objects.filter(id__in=vendor_ids)
                }

                incoming_po_ids = {
                    p["purchaseOrderId"]
                    for p in purchase_data
                    if p.get("purchaseOrderId")
                }
                if incoming_po_ids:
                    existing_purchases = PurchaseHistory.objects.filter(
                        productId=product, purchaseOrderId__in=incoming_po_ids
                    )
                    existing_purchases_map = {
                        p.purchaseOrderId: p for p in existing_purchases
                    }

                    for purchase in purchase_data:
                        po_id = purchase.get("purchaseOrderId")
                        if not po_id or not purchase.get(
                            "purchaseOrderInsertedTimestamp"
                        ):
                            continue

                        vendor = vendor_map.get(purchase.get("vendorId"))

                        defaults = {
                            "upc": purchase.get("upc"),
                            "sku": purchase.get("sku"),
                            "name": purchase.get("name", ""),
                            "purchasedQuantity": purchase.get(
                                "purchasedQuantity", 0
                            ),
                            "passedQuantity": purchase.get("passedQuantity", 0),
                            "failedQuantity": purchase.get("failedQuantity", 0),
                            "costPrice": purchase.get("costPrice", 0),
                            "totalCostPrice": purchase.get("totalCostPrice", 0),
                            "vendorId": vendor,
                            "vendorName": purchase.get("vendorName", ""),
                            "billId": purchase.get("billId"),
                            "purchaseOrderInsertedTimestamp": timezone.make_aware(
                                datetime.strptime(
                                    purchase["purchaseOrderInsertedTimestamp"],
                                    "%Y-%m-%d %H:%M:%S",
                                )
                            ),
                            "billInsertedTimestamp": (
                                timezone.make_aware(
                                    datetime.strptime(
                                        purchase["billInsertedTimestamp"],
                                        "%Y-%m-%d %H:%M:%S",
                                    )
                                )
                                if purchase.get("billInsertedTimestamp")
                                else None
                            ),
                        }

                        if po_id in existing_purchases_map:
                            if doUpdate:
                                existing_purchase_obj = existing_purchases_map[
                                    po_id
                                ]
                                for key, value in defaults.items():
                                    setattr(existing_purchase_obj, key, value)
                                purchases_to_update.append(
                                    existing_purchase_obj
                                )
                        else:
                            purchases_to_create.append(
                                PurchaseHistory(
                                    purchaseOrderId=po_id,
                                    productId=product,
                                    **defaults,
                                )
                            )

                    if purchases_to_create:
                        PurchaseHistory.objects.bulk_create(purchases_to_create)
                    if purchases_to_update:
                        update_fields = [
                            "upc",
                            "sku",
                            "name",
                            "purchasedQuantity",
                            "passedQuantity",
                            "failedQuantity",
                            "costPrice",
                            "totalCostPrice",
                            "vendorId",
                            "vendorName",
                            "billId",
                            "purchaseOrderInsertedTimestamp",
                            "billInsertedTimestamp",
                        ]
                        PurchaseHistory.objects.bulk_update(
                            purchases_to_update, update_fields
                        )

    yield 100


class syncData(APIView):
    def post(self, request):
        token = (
            SalesgentToken.objects.first().accessToken
            if SalesgentToken.objects.exists()
            else None
        )
        syncType = request.data.get("syncType", "all")

        if not token:
            notifyMe(
                "Sync Error : Token not found. Please check your Salesgent token configuration.",
                "101-error",
            )
            return Response(
                {"status": "error", "message": "Token is required"}, status=400
            )

        def event_stream():
            try:
                if syncType == "businessType":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'business_types_starting'})}\n\n"
                    for percent in syncBusinessTypes(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'business_types'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "invoice":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'invoices_starting'})}\n\n"
                    for percent in syncInvoices(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'invoices'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "categories":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'categories_starting'})}\n\n"
                    for percent in syncCategories(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'categories'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "products":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'products_starting'})}\n\n"
                    for percent in syncProducts(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'products'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "productsHistory":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'products_history_starting'})}\n\n"
                    for percent in syncProductHistory(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'products_history'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "vendor":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'vendor_starting'})}\n\n"
                    for percent in syncVendors(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'vendor'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "search":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'search_data_starting'})}\n\n"
                    for percent in syncSearchData(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'search_data'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "customer":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'customer_starting'})}\n\n"
                    for percent in syncCustomers(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'customer'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"
                else:
                    yield f"data: {json.dumps({'error': 'Invalid syncType specified', 'progress': 0, 'status': 'error'})}\n\n"

            except Exception as e:
                # Log the full error server-side for debugging
                import traceback

                print(f"Error during sync operation ({syncType}): {e}")
                traceback.print_exc()
                notifyMe(f"Sync Error: {str(e)}", "101-error")
                # Send a generic error to the client
                yield f"data: {json.dumps({'error': f'An error occurred during {syncType} sync: {str(e)}', 'status': 'error'})}\n\n"

        response = StreamingHttpResponse(
            event_stream(), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"  # Important for SSE
        return response
