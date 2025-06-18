from django.contrib import admin
from .models import Product, Category, BusinessType, InventoryData, Vendor, Invoice, InvoiceLineItem, ProductHistory, Customer,AIReport
from .models import PurchaseHistory
from .models import SalesgentToken

# import export
from import_export.admin import ImportExportModelAdmin
from django.contrib.admin import SimpleListFilter


class InventoryStatusFilter(admin.SimpleListFilter):
    title = "inventory status"
    parameter_name = "has_inventory"

    def lookups(self, request, model_admin):
        return [
            ("yes", "Has Inventory"),
            ("no", "No Inventory"),
        ]

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(inventoryList__isnull=False).distinct()
        if self.value() == "no":
            return queryset.filter(inventoryList__isnull=True)
        return queryset

class categoryFilter(SimpleListFilter):
    title = "Category"
    parameter_name = "category"

    def lookups(self, request, model_admin):
        categories = set(Category.objects.filter(parentId__isnull=True).values_list("name", flat=True))
        return [(c, c) for c in categories if c]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(categories__name=self.value())
        return queryset


class ProductAdmin(ImportExportModelAdmin):
    autocomplete_fields = ["inventoryList", "categories"]
    list_display = ("productId", "sku","upc", "productName", "availableQuantity", "standardPrice", "active")
    search_fields = ("productName", "sku","upc", "productId")
    list_filter = ("active", "ecommerce", InventoryStatusFilter,categoryFilter)


class CategoryAdmin(ImportExportModelAdmin):
    list_display = ("categoryId", "name", "parentId")
    search_fields = ("name", "categoryId")


class BusinessTypeAdmin(ImportExportModelAdmin):
    list_display = ("name", "insertedTimestamp")
    search_fields = ("name",)
    list_filter = ("insertedTimestamp",)


class InventoryDataAdmin(ImportExportModelAdmin):
    autocomplete_fields = ["productId"]
    list_display = ("id", "productId", "availableQuantity", "quantity", "costPrice", "orderId")
    search_fields = ("productId__productId", "id", "orderId")


class VendorAdmin(ImportExportModelAdmin):
    list_display = ("id", "name", "active", "email")
    search_fields = ("name", "id", "active", "email")


class InvoiceAdmin(ImportExportModelAdmin):
    list_display = ("id", "customerId", "totalAmount", "status", "insertedTimestamp")
    search_fields = ("id", "customerId__customerName", "email", "storeName")
    list_filter = ("status", "insertedTimestamp", "storeName")


class InvoiceLineItemAdmin(ImportExportModelAdmin):
    autocomplete_fields = ["orderId", "productId"]
    list_display = ("id", "orderId", "productName", "sku", "quantity", "retailPrice", "totalAmount", "status")
    search_fields = ("id", "orderId__id", "productName", "sku", "status")
    list_filter = ("status", "deleted")


class PurchaseHistoryAdmin(ImportExportModelAdmin):
    list_display = ("purchaseOrderId", "productId", "sku", "purchasedQuantity", "costPrice", "vendorId", "purchaseOrderInsertedTimestamp")
    search_fields = (
        "purchaseOrderId",
        "productId__productId",
        "sku",
        "name",
        "vendorName",
    )
    list_filter = ("vendorId__name",)
    autocomplete_fields = ["productId", "vendorId"]


# Add SalesgentToken admin
class SalesgentTokenAdmin(ImportExportModelAdmin):
    list_display = ("id", "accessToken", "lastSyncTimestamp")
    search_fields = ("accessToken", "id")


class ProductHistoryAdmin(ImportExportModelAdmin):
    list_display = ("productId", "quantity", "costPrice", "date")
    search_fields = ("productId__productId", "date")


class CustomerAdmin(ImportExportModelAdmin):
    list_display = ("id", "name", "company", "email", "phone")
    search_fields = ("id","name", "company", "email", "phone")

class AIReportAdmin(ImportExportModelAdmin):
    list_display = ("reportName", "createdAt", "updatedAt")


# Register your models here.
admin.site.site_header = "API Admin"
admin.site.site_title = "API Admin Portal"
admin.site.index_title = "Welcome to the API Admin Portal"
# Register your models here.
admin.site.register(Product, ProductAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(BusinessType, BusinessTypeAdmin)
admin.site.register(InventoryData, InventoryDataAdmin)
admin.site.register(Vendor, VendorAdmin)
admin.site.register(Invoice, InvoiceAdmin)
admin.site.register(InvoiceLineItem, InvoiceLineItemAdmin)
admin.site.register(PurchaseHistory, PurchaseHistoryAdmin)
admin.site.register(SalesgentToken, SalesgentTokenAdmin)
admin.site.register(ProductHistory, ProductHistoryAdmin)
admin.site.register(Customer, CustomerAdmin)
admin.site.register(AIReport, AIReportAdmin)
