from django.contrib import admin
from .models import Product, Category, BusinessType, Vendor, Invoice, InvoiceLineItem, ProductHistory, Customer, AIReport, ModulePermissions
from .models import PurchaseHistory
from .models import SalesgentToken, ErpProxyApiKey
from .erp_proxy import generate_proxy_api_key
from .models import POLocal, POLocalLineItem
from .signals import _calculate_and_update_product_metrics
# import export
from import_export.admin import ImportExportModelAdmin
from django.contrib.admin import SimpleListFilter
from django.db.models import Sum, F, DecimalField, Value, Case, When
from django.db.models.functions import Abs
from decimal import Decimal


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
            return queryset.filter(availableQuantity__gt=0).distinct()
        if self.value() == "no":
            return queryset.filter(availableQuantity=0)
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


class IsHotProductFilter(SimpleListFilter):
    title = "Is Hot Product"
    parameter_name = "is_hot_product"

    def lookups(self, request, model_admin):
        return [
            ("yes", "Yes"),
            ("no", "No"),
        ]

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(isHotProduct=True)
        if self.value() == "no":
            return queryset.filter(isHotProduct=False)
        return queryset


class IsClearanceProductFilter(SimpleListFilter):
    title = "Is Clearance Product"
    parameter_name = "is_clearance_product"

    def lookups(self, request, model_admin):
        return [
            ("yes", "Yes"),
            ("no", "No"),
        ]

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(isClearanceProduct=True)
        if self.value() == "no":
            return queryset.filter(isClearanceProduct=False)
        return queryset
    
class IsParentProductFilter(SimpleListFilter):
    title = "Is Parent Product"
    parameter_name = "is_parent_product"

    def lookups(self, request, model_admin):
        return [
            ("yes", "Yes"),
            ("no", "No"),
        ]

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.exclude(childProductList=[])
        if self.value() == "no":
            return queryset.filter(childProductList=[])
        return queryset

@admin.action(description='Recalculate metrics for selected products')
def recalculate_metrics(modeladmin, request, queryset):
    product_ids = list(queryset.values_list('productId', flat=True))
    # Aggregate ProductHistory data for all selected products
    agg_data = (
        ProductHistory.objects
        .filter(productId_id__in=product_ids)
        .values('productId_id')
        .annotate(
            calculated_revenue=Sum(F("quantity") * F("retailPrice"), output_field=DecimalField()),
            calculated_gross_margin=Sum(
                Abs(F("quantity") * (F("retailPrice") - F("costPrice"))),
                output_field=DecimalField()
            ),
            calculated_total_sales_amount=Sum(
                F("quantity"),
                output_field=DecimalField()
            ),
            calculated_gross_margin_percentage=Case(
                When(calculated_total_sales_amount=0, then=Value(0)),
                default=F("calculated_gross_margin") * 100 / F("calculated_total_sales_amount"),
                output_field=DecimalField()
            )
        )
    )
    # Map productId to aggregated values
    metrics_map = {
        item['productId_id']: {
            'TotalRevenue': item['calculated_revenue'] or Decimal('0.00'),
            'TotalGrossMargin': item['calculated_gross_margin'] or Decimal('0.00'),
            "TotalGrossMarginPercentage": item['calculated_gross_margin_percentage'] or Decimal('0.00'),
            "TotalSaleAmount": item['calculated_total_sales_amount'] or Decimal('0.00')
        }
        for item in agg_data
    }
    products_to_update = []
    for product in queryset:
        metrics = metrics_map.get(product.productId, {'TotalRevenue': Decimal('0.00'), 'TotalGrossMargin': Decimal('0.00')})
        product.TotalRevenue = metrics['TotalRevenue']
        product.TotalGrossMargin = metrics['TotalGrossMargin']
        products_to_update.append(product)
    # Bulk update only the required fields
    if products_to_update:
        queryset.model.objects.bulk_update(products_to_update, ['TotalRevenue', 'TotalGrossMargin'], batch_size=5000)

class ProductAdmin(ImportExportModelAdmin):
    actions = [recalculate_metrics]
    autocomplete_fields = ["categories"]
    list_display = ("productId", "sku", "upc", "productName", "availableQuantity", "standardPrice", "active","lastSyncTimestamp")
    search_fields = ("productName", "sku", "upc", "productId")
    list_filter = ("active", "ecommerce", IsHotProductFilter, IsClearanceProductFilter,IsParentProductFilter, InventoryStatusFilter, categoryFilter)


class CategoryAdmin(ImportExportModelAdmin):
    list_display = ("categoryId", "name", "parentId", "parValueDays")
    search_fields = ("name", "categoryId")

    # create a filter which leaves category with parentId None
    class ParentCategoryFilter(SimpleListFilter):
        title = "Parent Category"
        parameter_name = "parent_category"

        def lookups(self, request, model_admin):
            return [
                ("yes", "Has Parent"),
                ("no", "No Parent"),
            ]

        def queryset(self, request, queryset):
            if self.value() == "yes":
                return queryset.filter(parentId__isnull=False, parentId__gt=0)
            if self.value() == "no":
                return queryset.filter(parentId__isnull=True) | queryset.filter(parentId=0)

    list_filter = (ParentCategoryFilter,)


class BusinessTypeAdmin(ImportExportModelAdmin):
    list_display = ("name", "insertedTimestamp")
    search_fields = ("name",)
    list_filter = ("insertedTimestamp",)


class VendorAdmin(ImportExportModelAdmin):
    list_display = ("id", "name", "active", "email")
    search_fields = ("name", "id", "active", "email")


class InvoiceAdmin(ImportExportModelAdmin):
    list_display = ("id", "customerId", "totalAmount", "status", "insertedTimestamp")
    search_fields = ("id", "customerId__name", "email", "storeName")
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
    list_display = ("productId", "quantity", "costPrice", "retailPrice", "date")
    search_fields = ("productId__productId", "date")
    autocomplete_fields = ["productId"]


class CustomerAdmin(ImportExportModelAdmin):
    list_display = ("id", "name", "company", "email", "phone")
    search_fields = ("id", "name", "company", "email", "phone")


class AIReportAdmin(ImportExportModelAdmin):
    list_display = ("reportName", "createdAt", "updatedAt")


# POLocal and POLocalLineItem admin
class POLocalLineItemInline(admin.TabularInline):
    model = POLocalLineItem
    extra = 0
    autocomplete_fields = ["product"]


class POLocalAdmin(ImportExportModelAdmin):
    list_display = ("id", "purchaseOrderId", "vendor", "status", "totalAmount", "totalQuantity", "insertedTimestamp")
    search_fields = ("id", "purchaseOrderId", "vendor__name", "status")
    list_filter = ("status", "vendor")
    autocomplete_fields = ["vendor"]
    inlines = [POLocalLineItemInline]
    list_editable = ("status",)


class POLocalLineItemAdmin(ImportExportModelAdmin):
    list_display = ("id", "po_local", "product", "quantity", "unitPrice", "totalPrice")
    search_fields = ("id", "po_local__purchaseOrderId", "product__productId", "product__productName")
    autocomplete_fields = ["po_local", "product"]


@admin.action(description="Regenerate selected API keys")
def regenerate_proxy_api_keys(modeladmin, request, queryset):
    for api_key in queryset:
        api_key.key = generate_proxy_api_key()
        api_key.save(update_fields=["key"])


class ErpProxyApiKeyAdmin(ImportExportModelAdmin):
    list_display = ("name", "key", "is_active", "created_at", "last_used_at")
    list_filter = ("is_active",)
    search_fields = ("name", "key", "notes")
    readonly_fields = ("key", "created_at", "last_used_at")
    actions = [regenerate_proxy_api_keys]


class ModulePermissionsAdmin(ImportExportModelAdmin):
    list_display = (
        "user",
        "purchase",
        "tracker",
        "delivery",
        "catalog",
        "accounts",
        "utility",
        "supplychain",
    )
    search_fields = ("user__username",)
    list_filter = (
        "purchase",
        "tracker",
        "delivery",
        "catalog",
        "accounts",
        "utility",
        "supplychain",
    )
    list_editable = (
        "purchase",
        "tracker",
        "delivery",
        "catalog",
        "accounts",
        "utility",
        "supplychain",
    )
    autocomplete_fields = ["user"]


# Register your models here.
admin.site.site_header = "API Admin"
admin.site.site_title = "API Admin Portal"
admin.site.index_title = "Welcome to the API Admin Portal"
# Register your models here.
admin.site.register(Product, ProductAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(BusinessType, BusinessTypeAdmin)
admin.site.register(Vendor, VendorAdmin)
admin.site.register(Invoice, InvoiceAdmin)
admin.site.register(InvoiceLineItem, InvoiceLineItemAdmin)
admin.site.register(PurchaseHistory, PurchaseHistoryAdmin)
admin.site.register(SalesgentToken, SalesgentTokenAdmin)
admin.site.register(ProductHistory, ProductHistoryAdmin)
admin.site.register(Customer, CustomerAdmin)
admin.site.register(AIReport, AIReportAdmin)
admin.site.register(POLocal, POLocalAdmin)
admin.site.register(POLocalLineItem, POLocalLineItemAdmin)
admin.site.register(ModulePermissions, ModulePermissionsAdmin)
admin.site.register(ErpProxyApiKey, ErpProxyApiKeyAdmin)
