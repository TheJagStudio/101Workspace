from django.shortcuts import render
import requests
from api.models import BusinessType, Category, Product, InventoryData, Vendor
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


def syncProducts(token):
    totalPages = 80
    i = 1
    while i <= totalPages:
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

        response = requests.get(
            "https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page=" + str(i) + "&size=1000",
            headers=headers,
        )
        totalPages = response.json()["result"]["totalPages"]
        products_to_update = []
        product_categories_map = {}
        for product in response.json()["result"]["content"]:
            sku = product.get("sku", "")
            if sku is not None and sku != "":
                categories = []
                for category in product.get("categories", []).split(","):
                    category = category.strip()
                    if category:
                        cat_obj = Category.objects.filter(name=category).first()
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
                    customerGroupRestricted=product.get("customerGroupRestricted", False),
                    trackInventory=product.get("trackInventory", False),
                    trackInventoryByImei=product.get("trackInventoryByImei", False),
                    size=product.get("size", 0),
                    returnable=product.get("returnable", False),
                    minimumSellingPrice=product.get("minimumSellingPrice", 0),
                )
                products_to_update.append(productObj)
                if categories:
                    product_categories_map[product["productId"]] = categories

        with transaction.atomic():
            Product.objects.bulk_create(
                products_to_update,
                update_fields=[
                    "sku",
                    "upc",
                    "productName",
                    "availableQuantity",
                    "imageUrl",
                    "masterProductId",
                    "masterProductName",
                    "standardPrice",
                    "tierPrice",
                    "costPrice",
                    "ecommerce",
                    "active",
                    "compositeProduct",
                    "stateRestricted",
                    "customerGroupRestricted",
                    "trackInventory",
                    "trackInventoryByImei",
                    "size",
                    "returnable",
                    "minimumSellingPrice",
                ],
                update_conflicts=True,
                unique_fields=["productId"],
            )
            # Now assign categories to products
            for product_id, categories in product_categories_map.items():
                product_instance = Product.objects.get(productId=product_id)
                product_instance.categories.set(categories)
        i += 1
        yield (i * 100) / totalPages


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

    response = requests.get("https://erp.101distributorsga.com/api/store/businessType", headers=headers)
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
                            "websiteUsername": vendorData.get("websiteUsername"),
                            "websitePassword": vendorData.get("websitePassword"),
                            "portalUserName": vendorData.get("portalUserName"),
                            "portalPassword": vendorData.get("portalPassword"),
                            "taxId": vendorData.get("taxId"),
                            "feinNumber": vendorData.get("feinNumber"),
                            "description": vendorData.get("description"),
                            "dueAmount": vendorData.get("dueAmount", 0),
                            "excessAmount": vendorData.get("excessAmount", 0),
                            "storeCredit": vendorData.get("storeCredit", 0),
                            "insuranceExpiryDate": vendorData.get("insuranceExpiryDate"),
                            "manufacturerId": vendorData.get("manufacturerId"),
                            "manufacturerType": vendorData.get("manufacturerType"),
                            "msaTypeId": vendorData.get("msaTypeId"),
                            "msaTypeName": vendorData.get("msaTypeName"),
                            "paymentTermsId": vendorData.get("paymentTermsId"),
                            "paymentTermsName": vendorData.get("paymentTermsName"),
                            "primarySalesRepresentativeId": vendorData.get("primarySalesRepresentativeId"),
                            "primarySalesRepresentativeName": vendorData.get("primarySalesRepresentativeName"),
                            "createdBy": vendorData.get("createdBy"),
                            "updatedBy": vendorData.get("updatedBy"),
                            "insertedTimestamp": vendorData.get("insertedTimestamp"),
                            "updatedTimestamp": vendorData.get("updatedTimestamp"),
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


def createSingleProduct(product_data):
    product = Product(
        sku=product_data.get("sku"),
        upc=product_data.get("upc"),
        productName=product_data.get("name"),
        availableQuantity=product_data.get("availableQuantity"),
        imageUrl=product_data.get("imageUrl"),
        masterProductId=product_data.get("masterProductId"),
        masterProductName=product_data.get("masterProductName"),
        standardPrice=product_data.get("stdPrice"),
        tierPrice=product_data.get("tier1Price"),
        costPrice=product_data.get("costPrice"),
        ecommerce=product_data.get("ecommerce"),
        active=product_data.get("active"),
        compositeProduct=product_data.get("compositeProduct"),
        stateRestricted=None,
        customerGroupRestricted=product_data.get("customerSpecific"),
        trackInventory=product_data.get("trackInventory"),
        trackInventoryByImei=product_data.get("trackInventoryByImei"),
        size=product_data.get("size"),
        returnable=product_data.get("returnable"),
        minimumSellingPrice=product_data.get("minimumSellingPrice"),
    )
    for category in product_data.get("productCategories", []):
        category_obj = Category.objects.filter(name=category).first()
        if category_obj:
            product.categories.add(category_obj)
    product.save()
    return product


def createSingleInventoryData(product, inventoryDataList):
    inventory_data_objs = []
    productId = Product.objects.filter(productId=product.productId).first()
    for inventoryData in inventoryDataList:
        inventory_data_obj = InventoryData(
            id=inventoryData.get("id"),
            productInventoryId=inventoryData.get("productInventoryId"),
            productId=productId,
            wareHouseId=inventoryData.get("wareHouseId"),
            quantity=inventoryData.get("quantity"),
            availableQuantity=(inventoryData.get("availableQuantity") or 0),
            costPrice=(inventoryData.get("costPrice") or 0),
            orderId=inventoryData.get("orderId"),
            orderLineItemId=inventoryData.get("orderLineItemId"),
            orderFulfillmentId=inventoryData.get("orderFulfillmentId"),
            returnOrderId=inventoryData.get("returnOrderId"),
            purchaseOrderId=inventoryData.get("purchaseOrderId"),
            billId=inventoryData.get("billId"),
            transferOrderId=inventoryData.get("transferOrderId"),
            vendorReturnOrderId=inventoryData.get("vendorReturnOrderId"),
            compositeProductId=inventoryData.get("compositeProductId"),
            adjustmentId=inventoryData.get("adjustmentId"),
            notes=inventoryData.get("notes"),
            actionType=inventoryData.get("actionType"),
            salesOrderId=inventoryData.get("salesOrderId"),
            createdBy=inventoryData.get("createdBy"),
            insertedTimestamp=inventoryData.get("insertedTimestamp"),
            employeeName=inventoryData.get("employeeName"),
            storeName=inventoryData.get("storeName"),
            warehouseName=inventoryData.get("warehouseName"),
        )
        inventory_data_objs.append(inventory_data_obj)
    if inventory_data_objs:
        existing_ids = set(InventoryData.objects.filter(id__in=[obj.id for obj in inventory_data_objs]).values_list("id", flat=True))
        objs_to_update = [obj for obj in inventory_data_objs if obj.id in existing_ids]
        objs_to_create = [obj for obj in inventory_data_objs if obj.id not in existing_ids]
        if objs_to_update:
            InventoryData.objects.bulk_update(
                objs_to_update,
                [
                    "productInventoryId",
                    "productId",
                    "wareHouseId",
                    "quantity",
                    "availableQuantity",
                    "costPrice",
                    "orderId",
                    "orderLineItemId",
                    "orderFulfillmentId",
                    "returnOrderId",
                    "purchaseOrderId",
                    "billId",
                    "transferOrderId",
                    "vendorReturnOrderId",
                    "compositeProductId",
                    "adjustmentId",
                    "notes",
                    "actionType",
                    "salesOrderId",
                    "createdBy",
                    "insertedTimestamp",
                    "employeeName",
                    "storeName",
                    "warehouseName",
                ],
            )
        if objs_to_create:
            InventoryData.objects.bulk_create(objs_to_create, ignore_conflicts=True)
    # product.inventoryList.set(inventory_data_objs)
    # product.save()
    print(f"Updated inventory for product ID: {product.productId} with {len(inventory_data_objs)} records.")


def syncInventoryData(token):
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
    today = datetime.now()
    start_date = (today - timedelta(days=3)).strftime("%Y-%m-%d+%H:%M:%S")
    end_date = today.strftime("%Y-%m-%d+%H:%M:%S")
    print(f"Fetching inventory data from {start_date} to {end_date}")
    response = requests.get(
        "https://erp.101distributorsga.com/api/order/list?storeIds=1,2&startDate=" + start_date + "&endDate=" + end_date + "&page=0&size=500&showEmployeeSpecificData=false",
        headers=headers,
    )
    data = response.json()
    uniqueProducts = []
    if data["hasError"]:
        print("Error fetching inventory data:", data)
        yield 100
    else:
        invoices = data["result"]["content"]
        totalInvoices = len(invoices)
        i = 0
        for invoice in invoices:
            invoiceId = invoice["id"]
            salesOrderId = invoice.get("salesOrderId", None)
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

            response = requests.get(
                "https://erp.101distributorsga.com/api/order/lineItem/" + str(invoiceId) + "?storeIds=1,2&sortedByProductName=true&showEmployeeSpecificData=false",
                headers=headers,
            )
            line_items = response.json()["result"]
            for line_item in line_items:
                if line_item["productId"] not in uniqueProducts:
                    uniqueProducts.append(line_item["productId"])
            i += 1
            yield (i * 100) / (totalInvoices * 4)
    totalUniqueProducts = len(uniqueProducts)
    i = 0
    for productId in uniqueProducts:
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

        response = requests.get(
            f"https://erp.101distributorsga.com/api/inventory/history/{productId}?storeIds=1,2",
            headers=headers,
        )
        data = response.json()["result"]
        if data:
            product = Product.objects.filter(productId=productId).first()
            if product:
                inventoryDataList = []
                for key in data.keys():
                    for inventoryData in data[key]:
                        inventoryDataList.append(inventoryData)
                createSingleInventoryData(product, inventoryDataList)
                # print(f"Updated inventory for product ID: {productId}")
            else:
                print(f"Product ID {productId} not found in database.")
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

                response = requests.get(
                    "https://erp.101distributorsga.com/api/product/" + str(productId) + "?storeIds=1,2",
                    headers=headers,
                )
                productData = response.json()["result"]
                newProduct = createSingleProduct(productData)
                # Create InventoryData objects for the new product and associate them
                inventory_objs = []
                for key in data.keys():
                    for inventoryData in data[key]:
                        inventory_obj, _ = InventoryData.objects.get_or_create(
                            id=inventoryData.get("id"),
                            defaults={
                                "productInventoryId": inventoryData.get("productInventoryId"),
                                "productId": newProduct,
                                "wareHouseId": inventoryData.get("wareHouseId"),
                                "quantity": inventoryData.get("quantity"),
                                "availableQuantity": inventoryData.get("availableQuantity") or 0,
                                "costPrice": inventoryData.get("costPrice") or 0,
                                "orderId": inventoryData.get("orderId"),
                                "orderLineItemId": inventoryData.get("orderLineItemId"),
                                "orderFulfillmentId": inventoryData.get("orderFulfillmentId"),
                                "returnOrderId": inventoryData.get("returnOrderId"),
                                "purchaseOrderId": inventoryData.get("purchaseOrderId"),
                                "billId": inventoryData.get("billId"),
                                "transferOrderId": inventoryData.get("transferOrderId"),
                                "vendorReturnOrderId": inventoryData.get("vendorReturnOrderId"),
                                "compositeProductId": inventoryData.get("compositeProductId"),
                                "adjustmentId": inventoryData.get("adjustmentId"),
                                "notes": inventoryData.get("notes"),
                                "actionType": inventoryData.get("actionType"),
                                "salesOrderId": inventoryData.get("salesOrderId"),
                                "createdBy": inventoryData.get("createdBy"),
                                "insertedTimestamp": inventoryData.get("insertedTimestamp"),
                                "employeeName": inventoryData.get("employeeName"),
                                "storeName": inventoryData.get("storeName"),
                                "warehouseName": inventoryData.get("warehouseName"),
                            },
                        )
                        inventory_objs.append(inventory_obj)
                if inventory_objs:
                    newProduct.inventoryList.set(inventory_objs)
                newProduct.save()
                print(f"Created new product with ID: {productId} and updated inventory data.")
        i += 1
        yield ((i * 100) / (totalUniqueProducts * 2)) + 25

    print(f"Total unique products found: {len(uniqueProducts)}")


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

    response = requests.get("https://erp.101distributorsga.com/api/category/all", headers=headers)
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
                    "customerSpecific": category_data.get("customerSpecific", False),
                    "loginRequired": category_data.get("loginRequired", False),
                    "repairCategory": category_data.get("repairCategory", False),
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
        if "businessTypeList" in category_data and category_data["businessTypeList"]:
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
                    "host": "thejagstudio-typesense.hf.space",
                    "port": "443",
                    "protocol": "https",
                }
            ],
            "connection_timeout_seconds": 2,
        }
    )

    # Prepare collection schema
    collection_name = "101"
    schema = {"name": collection_name, "fields": [{"name": "id", "type": "int32"}, {"name": "productId", "type": "int32"}, {"name": "sku", "type": "string"}, {"name": "upc", "type": "string"}, {"name": "productName", "type": "string"}, {"name": "availableQuantity", "type": "int32"}, {"name": "eta", "type": "string"}, {"name": "imageUrl", "type": "string"}, {"name": "masterProductId", "type": "int32"}, {"name": "masterProductName", "type": "string"}, {"name": "standardPrice", "type": "float"}, {"name": "tierPrice", "type": "float"}, {"name": "costPrice", "type": "float"}, {"name": "ecommerce", "type": "bool"}, {"name": "active", "type": "bool"}, {"name": "compositeProduct", "type": "bool"}, {"name": "stateRestricted", "type": "bool"}, {"name": "customerGroupRestricted", "type": "bool"}, {"name": "categories", "type": "string", "facet": True}, {"name": "trackInventory", "type": "bool"}, {"name": "trackInventoryByImei", "type": "bool"}, {"name": "insertedTimestamp", "type": "string"}, {"name": "size", "type": "int32"}], "default_sorting_field": "availableQuantity"}

    # Delete collection if exists
    try:
        client.collections[collection_name].delete()
    except Exception as e:
        print(f"Collection {collection_name} does not exist or could not be deleted: {e}")
    # Create collection
    client.collections.create(schema)

    # Fetch products from API and import to Typesense

    totalPages = 10
    page = 1

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
            f"https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page={page}&size=10000",
            headers=headers,
        )
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
            product['categories'] = str(product['categories'])
            all_products.append(product)
        percent = (page / totalPages) * 50
        page += 1
        yield percent

    # Import to Typesense in chunks of 1000
    for i in range(0, len(all_products), 1000):
        client.collections[collection_name].documents.import_(all_products[i : i + 1000], {"action": "create"})
        percent = 50 + ((i + 1000) / len(all_products)) * 50
        yield percent

    yield 100


class syncData(APIView):
    def post(self, request):
        token = request.data.get("token")
        syncType = request.data.get("syncType", "all")

        if not token:
            return Response({"status": "error", "message": "Token is required"}, status=400)

        def event_stream():
            try:
                if syncType == "businessType":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'business_types_starting'})}\n\n"
                    for percent in syncBusinessTypes(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'business_types'})}\n\n"
                    yield f"data: {json.dumps({'progress': 100, 'status': 'done'})}\n\n"

                elif syncType == "inventoryData":
                    yield f"data: {json.dumps({'progress': 0, 'status': 'inventory_data'})}\n\n"
                    for percent in syncInventoryData(token):
                        yield f"data: {json.dumps({'progress': round(percent), 'status': 'inventory_data'})}\n\n"
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
                else:
                    yield f"data: {json.dumps({'error': 'Invalid syncType specified', 'progress': 0, 'status': 'error'})}\n\n"

            except Exception as e:
                # Log the full error server-side for debugging
                import traceback

                print(f"Error during sync operation ({syncType}): {e}")
                traceback.print_exc()
                # Send a generic error to the client
                yield f"data: {json.dumps({'error': f'An error occurred during {syncType} sync: {str(e)}', 'status': 'error'})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"  # Important for SSE
        return response
