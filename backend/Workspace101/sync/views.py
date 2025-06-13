from django.shortcuts import render
import requests
from api.models import BusinessType, Category, Product, InventoryData, Vendor, SalesgentToken, Customer
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
    i = 0
    categoryNameMap = {category.name: category for category in Category.objects.all()}
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
                "https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page=" + str(i) + "&size=1000",
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
                "https://erp.101distributorsga.com/api/product/list?storeIds=1,2&page=" + str(i) + "&size=1000&active=false",
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
    for i in range(0,totalProducts,1000):
        product_categories_map = {}
        productObjList = []
        for product in productList[i:i+1000]:
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
                    customerGroupRestricted=product.get("customerGroupRestricted", False),
                    trackInventory=product.get("trackInventory", False),
                    trackInventoryByImei=product.get("trackInventoryByImei", False),
                    size=product.get("size", 0),
                    returnable=product.get("returnable", False),
                    minimumSellingPrice=product.get("minimumSellingPrice", 0),
                )
                productObjList.append(productObj)
                if categories:
                    product_categories_map[product["productId"]] = categories

        productExists = Product.objects.filter(productId__in=[p.productId for p in productObjList]).values_list("productId", flat=True)
        # bulk create or update products
        products_to_update = [p for p in productObjList if p.productId in productExists]
        products_to_create = [p for p in productObjList if p.productId not in productExists]
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
                        category_id=category.categoryId
                    )
                    for product in products_to_update
                    for category in product_categories_map.get(product.productId, [])
                ]
                
                # Bulk create the many-to-many relationships
                if category_relations:
                    Product.categories.through.objects.bulk_create(
                        category_relations,
                        ignore_conflicts=True
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
                Product.categories.through.objects.filter(product_id__in=product_ids).delete()
                
                # Create new category relationships
                category_relations = [
                    Product.categories.through(
                        product_id=product.productId,
                        category_id=category.categoryId
                    )
                    for product in products_to_update
                    for category in product_categories_map.get(product.productId, [])
                ]
                
                # Bulk create the many-to-many relationships
                if category_relations:
                    Product.categories.through.objects.bulk_create(
                        category_relations,
                        ignore_conflicts=True
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
    start_date = (today - timedelta(days=6)).strftime("%Y-%m-%d+%H:%M:%S")
    end_date = today.strftime("%Y-%m-%d+%H:%M:%S")
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
            product["categories"] = str(product["categories"])
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
                    insertedTimestamp=timezone.make_aware(datetime.strptime(customer["insertedTimestamp"], "%Y-%m-%d %H:%M:%S")) if customer["insertedTimestamp"] else None,
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
                    insertedTimestamp=timezone.make_aware(datetime.strptime(customer["insertedTimestamp"], "%Y-%m-%d %H:%M:%S")) if customer["insertedTimestamp"] else None,
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
        Customer.objects.bulk_update(customers_to_update, ["insertedTimestamp", "name", "company", "storeId", "email", "phone", "tier", "notes", "storeCredit", "loyaltyPoints", "dueAmount", "excessAmount", "active", "verified", "viewSpecificCategory", "viewSpecificProduct", "salesRepresentativeName", "taxable", "communicateViaPhone", "communicateViaText", "dbaName", "address1", "stateId", "billingStateId", "sendDuePaymentReminder", "rewardable", "saveProductPrice"])
        yield 100


class syncData(APIView):
    def post(self, request):
        token = SalesgentToken.objects.first().accessToken if SalesgentToken.objects.exists() else None
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
                # Send a generic error to the client
                yield f"data: {json.dumps({'error': f'An error occurred during {syncType} sync: {str(e)}', 'status': 'error'})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"  # Important for SSE
        return response
