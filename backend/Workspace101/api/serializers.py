from rest_framework import serializers
from .models import (
    Product, Category, BusinessType, Vendor, Customer, Invoice,
    InvoiceLineItem, ProductHistory, PurchaseHistory, SalesgentToken,
    AIReport, POLocal, POLocalLineItem, ModulePermissions, ErpProxyApiKey,
)


class CategoryMiniSerializer(serializers.ModelSerializer):
    """Lightweight category serializer for nested display."""
    class Meta:
        model = Category
        fields = ['categoryId', 'name', 'parentId']


class ProductSerializer(serializers.ModelSerializer):
    """Full product serializer excluding sensitive internal fields."""
    class Meta:
        model = Product
        fields = [
            'productId', 'sku', 'upc', 'productName', 'availableQuantity',
            'imageUrl', 'masterProductId', 'masterProductName',
            'standardPrice', 'tierPrice', 'costPrice', 'ecommerce', 'active',
            'compositeProduct', 'stateRestricted', 'customerGroupRestricted',
            'trackInventory', 'trackInventoryByImei', 'size', 'returnable',
            'minimumSellingPrice', 'TotalSaleAmount', 'TotalGrossMargin',
            'TotalGrossMarginPrecentage', 'TotalRevenue', 'urlAlias',
            'shortDescription', 'fullDescription', 'avgCostPrice',
            'latestCostPrice', 'stdPrice', 'tier1Price', 'tier2Price',
            'tier3Price', 'tier4Price', 'tier5Price', 'upc1', 'upc2',
            'singleUpc', 'vendorUpc', 'metaKeyword', 'childProductList',
            'quantity', 'reorderQuantity', 'minQuantity', 'caseQuantity',
            'boxQuantity', 'isHotProduct', 'isClearanceProduct', 'parValueDays',
            'lastSyncTimestamp',
        ]


class ProductMiniSerializer(serializers.ModelSerializer):
    """Lightweight product serializer for nested/list display."""
    class Meta:
        model = Product
        fields = ['productId', 'productName', 'sku', 'upc', 'imageUrl',
                  'availableQuantity', 'standardPrice', 'costPrice']


class CategorySerializer(serializers.ModelSerializer):
    """Full category serializer."""
    class Meta:
        model = Category
        fields = [
            'categoryId', 'name', 'alias', 'parentId', 'parentIdStr',
            'imageUrl', 'description', 'ecommerce', 'customerSpecific',
            'loginRequired', 'repairCategory', 'businessTypeId',
            'businessTypeName', 'sequenceNumber', 'metaTitle', 'metaData',
            'metaDescription', 'deleted', 'taxPaid', 'lastSyncTimestamp',
            'parValueDays',
        ]


class BusinessTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessType
        fields = '__all__'


class VendorSerializer(serializers.ModelSerializer):
    """Vendor serializer - excludes sensitive password/credential fields."""
    class Meta:
        model = Vendor
        exclude = ['websitePassword', 'portalPassword', 'websiteUsername']


class VendorMiniSerializer(serializers.ModelSerializer):
    """Lightweight vendor serializer."""
    class Meta:
        model = Vendor
        fields = ['id', 'name']


class CustomerSerializer(serializers.ModelSerializer):
    """Full customer serializer."""
    class Meta:
        model = Customer
        fields = '__all__'


class InvoiceSerializer(serializers.ModelSerializer):
    """Full invoice serializer."""
    class Meta:
        model = Invoice
        fields = '__all__'


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    """Full invoice line item serializer."""
    class Meta:
        model = InvoiceLineItem
        fields = '__all__'


class ProductHistorySerializer(serializers.ModelSerializer):
    """Product history serializer."""
    class Meta:
        model = ProductHistory
        fields = '__all__'


class PurchaseHistorySerializer(serializers.ModelSerializer):
    """Purchase history serializer."""
    class Meta:
        model = PurchaseHistory
        fields = '__all__'


class SalesgentTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesgentToken
        fields = '__all__'


class AIReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIReport
        fields = '__all__'


class POLocalSerializer(serializers.ModelSerializer):
    """POLocal serializer with nested vendor info."""
    vendorName = serializers.CharField(source='vendor.name', read_only=True)

    class Meta:
        model = POLocal
        fields = ['id', 'purchaseOrderId', 'vendor', 'vendorName', 'status',
                  'totalAmount', 'totalQuantity', 'insertedTimestamp']


class POLocalLineItemSerializer(serializers.ModelSerializer):
    """POLocal line item serializer with product info."""
    productId = serializers.IntegerField(source='product.productId', read_only=True)
    productName = serializers.CharField(source='product.productName', read_only=True)
    productSku = serializers.CharField(source='product.sku', read_only=True)
    productImageUrl = serializers.URLField(source='product.imageUrl', read_only=True, allow_null=True)

    class Meta:
        model = POLocalLineItem
        fields = ['id', 'productId', 'productName', 'productSku', 'productImageUrl',
                  'quantity', 'unitPrice', 'totalPrice']


class ModulePermissionsSerializer(serializers.ModelSerializer):
    """Serializer for ModulePermissions model."""
    class Meta:
        model = ModulePermissions
        fields = [
            'purchase', 'tracker', 'delivery', 'catalog', 'accounts',
            'utility', 'supplychain', 'purchase_PO', 'purchase_Inventory',
            'purchase_Settings', 'tracker_Map', 'tracker_History',
            'tracker_Salesmen_List', 'tracker_Global_View', 'tracker_config',
            'tracker_Admin_Profile', 'tracker_Profile', 'utility_sticker',
            'utility_product_sync', 'accounts_invoice', 'delivery_admin',
        ]


class ErpProxyApiKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ErpProxyApiKey
        fields = ['id', 'name', 'key', 'is_active', 'created_at', 'last_used_at', 'notes']
        read_only_fields = ['key', 'created_at', 'last_used_at']


# ---------- Response serializers for views with custom shapes ----------

class InventorySummaryProductRowSerializer(serializers.Serializer):
    """Response row for InventorySummaryView product report."""
    id = serializers.IntegerField()
    index = serializers.IntegerField()
    name = serializers.CharField()
    closingInventory = serializers.IntegerField()
    revenue = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    grossProfit = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    inventoryCost = serializers.DecimalField(max_digits=20, decimal_places=2)
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)


class InventorySummaryCategoryRowSerializer(serializers.Serializer):
    """Response row for InventorySummaryView category report."""
    id = serializers.IntegerField()
    index = serializers.IntegerField()
    name = serializers.CharField()
    closingInventory = serializers.DecimalField(max_digits=20, decimal_places=2)
    revenue = serializers.DecimalField(max_digits=20, decimal_places=2)
    grossProfit = serializers.DecimalField(max_digits=20, decimal_places=2)
    inventoryCost = serializers.DecimalField(max_digits=20, decimal_places=2)
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)


class InventorySummaryTotalSerializer(serializers.Serializer):
    """Response for InventorySummaryView totals."""
    totalClosingInventory = serializers.DecimalField(max_digits=20, decimal_places=2)
    totalGrossMargin = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    totalInventoryCost = serializers.DecimalField(max_digits=20, decimal_places=2)
    totalRevenue = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)


class InventoryReplenishmentProductRowSerializer(serializers.Serializer):
    """Response row for InventoryReplenishmentView product report."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    closingInventory = serializers.FloatField()
    itemsSold = serializers.FloatField()
    itemsSoldPerDay = serializers.FloatField()
    daysCover = serializers.FloatField()
    averageCost = serializers.FloatField()
    inboundInventory = serializers.FloatField()
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)
    sku = serializers.CharField(allow_blank=True, allow_null=True)
    upc = serializers.CharField(allow_blank=True, allow_null=True)


class InventoryReplenishmentCategoryRowSerializer(serializers.Serializer):
    """Response row for InventoryReplenishmentView category report."""
    id = serializers.IntegerField()
    index = serializers.IntegerField()
    name = serializers.CharField()
    closingInventory = serializers.FloatField()
    itemsSold = serializers.FloatField()
    itemsSoldPerDay = serializers.FloatField()
    daysCover = serializers.FloatField()
    averageCost = serializers.FloatField()
    inboundInventory = serializers.FloatField()
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)


class DustyInventoryProductRowSerializer(serializers.Serializer):
    """Response row for DustyInventoryView product report."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    sku = serializers.CharField(allow_blank=True, allow_null=True)
    closingInventory = serializers.IntegerField()
    sellThroughRate = serializers.FloatField()
    quantitySold = serializers.IntegerField()
    inventoryCost = serializers.FloatField()
    retailValue = serializers.FloatField()
    lastSale = serializers.CharField(allow_null=True)
    days_since_last_sale = serializers.IntegerField(allow_null=True)
    lastReceived = serializers.CharField(allow_null=True)
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)


class DustyInventoryTotalSerializer(serializers.Serializer):
    """Response for DustyInventoryView totals."""
    totalClosingInventory = serializers.FloatField()
    totalInventoryCost = serializers.FloatField()
    totalRetailValue = serializers.FloatField()
    overallSellThroughRate = serializers.FloatField()
    totalSoldInPeriod = serializers.FloatField()
    analysisThresholdDays = serializers.IntegerField()


class ProductHistoryResponseSerializer(serializers.Serializer):
    """Response for ProductHistoryView."""
    id = serializers.IntegerField()
    productName = serializers.CharField()
    sku = serializers.CharField(allow_null=True)
    upc = serializers.CharField(allow_null=True)
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)
    availableQuantity = serializers.IntegerField(allow_null=True)
    history = serializers.ListField()
    purchaseHistory = serializers.ListField()


class POMakerProductSerializer(serializers.Serializer):
    """Response row for POMakerView."""
    index = serializers.IntegerField()
    id = serializers.IntegerField()
    name = serializers.CharField()
    sku = serializers.CharField(allow_null=True)
    costPrice = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    availableQuantity = serializers.IntegerField(allow_null=True)
    minQuantity = serializers.IntegerField(allow_null=True)
    standardPrice = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    profitPercentage = serializers.FloatField()
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)
    vendors = serializers.ListField()


class POMakerPostResponseSerializer(serializers.Serializer):
    """Response for POMakerView POST."""
    success = serializers.BooleanField()
    message = serializers.CharField()


class POListItemSerializer(serializers.Serializer):
    """Response row for POView list."""
    id = serializers.IntegerField()
    vendorId = serializers.IntegerField()
    vendor = serializers.CharField()
    status = serializers.CharField()
    totalAmount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    totalQuantity = serializers.IntegerField(allow_null=True)
    insertedTimestamp = serializers.DateTimeField(allow_null=True)


class POExportItemSerializer(serializers.Serializer):
    """Response row for POView export."""
    id = serializers.IntegerField()
    vendorId = serializers.IntegerField()
    vendor = serializers.CharField()
    status = serializers.CharField()
    totalAmount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    totalQuantity = serializers.IntegerField(allow_null=True)
    insertedTimestamp = serializers.DateTimeField(allow_null=True)
    items = serializers.ListField()


class POLineItemResponseSerializer(serializers.Serializer):
    """Response row for POLineItemView."""
    id = serializers.IntegerField()
    productId = serializers.IntegerField()
    productName = serializers.CharField()
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)
    sku = serializers.CharField(allow_null=True)
    quantity = serializers.IntegerField(allow_null=True)
    unitPrice = serializers.FloatField()
    totalPrice = serializers.FloatField()


class HotProductSerializer(serializers.Serializer):
    """Response row for HotProductView."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)
    upc = serializers.CharField(allow_null=True)
    sku = serializers.CharField(allow_null=True)
    quantity = serializers.IntegerField(allow_null=True)
    costPrice = serializers.FloatField(allow_null=True)
    retailPrice = serializers.FloatField(allow_null=True)
    masterProductId = serializers.IntegerField(allow_null=True)
    masterProductName = serializers.CharField(allow_null=True)


class ClearanceProductLossSerializer(serializers.Serializer):
    """Inner product loss details for ClearanceLossReportView."""
    loss = serializers.FloatField()
    quantitySoldAtLoss = serializers.IntegerField()
    name = serializers.CharField()
    productId = serializers.IntegerField()
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)
    originalCostMax = serializers.FloatField()
    originalCostMin = serializers.FloatField()
    currentCostMax = serializers.FloatField()
    currentCostMin = serializers.FloatField()


class ClearanceMonthlyBreakdownSerializer(serializers.Serializer):
    """Monthly breakdown for ClearanceLossReportView."""
    totalLoss = serializers.FloatField()
    productLoss = ClearanceProductLossSerializer(many=True)


class ParLevelCategorySerializer(serializers.Serializer):
    """Par level row for category."""
    categoryId = serializers.IntegerField()
    name = serializers.CharField()
    parValueDays = serializers.IntegerField(allow_null=True)
    parentId = serializers.IntegerField(allow_null=True)


class ParLevelProductSerializer(serializers.Serializer):
    """Par level row for product."""
    productId = serializers.IntegerField()
    productName = serializers.CharField()
    parValueDays = serializers.IntegerField(allow_null=True)


class CategoryTreeNodeSerializer(serializers.Serializer):
    """Category tree node for FetchCategoriesView."""
    categoryId = serializers.IntegerField()
    name = serializers.CharField()
    parentId = serializers.IntegerField(allow_null=True)
    subcategories = serializers.ListField()


class VendorByCategorySerializer(serializers.Serializer):
    """Vendor for FetchVendorsByCategoryView."""
    id = serializers.IntegerField()
    name = serializers.CharField()


class StickerProductSerializer(serializers.Serializer):
    """Response product for sticker views."""
    productId = serializers.IntegerField()
    id = serializers.IntegerField()
    productName = serializers.CharField()
    upc = serializers.CharField(allow_null=True)
    sku = serializers.CharField(allow_null=True)
    standardPrice = serializers.FloatField()
    tierPrice = serializers.FloatField(allow_null=True)
    imageUrl = serializers.URLField(allow_null=True, allow_blank=True)
    masterProductId = serializers.IntegerField(allow_null=True)
    masterProductName = serializers.CharField(allow_null=True)
    availableQuantity = serializers.IntegerField(allow_null=True)
