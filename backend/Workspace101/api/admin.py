from django.contrib import admin
from .models import Product, Category, BusinessType, InventoryData, Vendor, Invoice, InvoiceLineItem
from .models import PurchaseHistory

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


class ProductAdmin(ImportExportModelAdmin):
    autocomplete_fields = ["inventoryList", "categories"]
    list_display = ("productId", "sku", "productName", "availableQuantity", "standardPrice", "active")
    search_fields = ("productName", "sku", "productId")
    list_filter = ("active", "ecommerce", InventoryStatusFilter)


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
    list_display = ("id", "customerName", "companyName", "totalAmount", "status", "insertedTimestamp")
    search_fields = ("id", "customerName", "companyName", "email", "storeName")
    list_filter = ("status", "insertedTimestamp", "storeName")


class InvoiceLineItemAdmin(ImportExportModelAdmin):
    autocomplete_fields = ["orderId", "productId"]
    list_display = ("id", "orderId", "productName", "sku", "quantity", "retailPrice", "totalAmount", "status")
    search_fields = ("id", "orderId__id", "productName", "sku", "status")
    list_filter = ("status", "deleted")


class PurchaseHistoryAdmin(ImportExportModelAdmin):
    list_display = ("purchaseOrderId", "productId", "productId__productName", "sku", "purchasedQuantity", "costPrice", "vendorId", "purchaseOrderInsertedTimestamp")
    search_fields = (
        "purchaseOrderId",
        "productId__productId",
        "productId__productName",
        "sku",
        "name",
        "vendorName",
    )
    list_filter = ("vendorId__name",)
    autocomplete_fields = ["productId", "vendorId"]


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
