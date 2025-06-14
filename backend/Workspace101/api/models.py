from django.db import models
from django.contrib import admin


class Product(models.Model):
    productId = models.IntegerField(primary_key=True)
    sku = models.CharField(max_length=500,null=True, blank=True)
    upc = models.CharField(max_length=500,null=True, blank=True)
    productName = models.CharField(max_length=255)
    availableQuantity = models.IntegerField(null=True, blank=True)
    imageUrl = models.URLField(max_length=500, blank=True, null=True)
    masterProductId = models.IntegerField(null=True, blank=True)
    masterProductName = models.CharField(max_length=255, null=True, blank=True)
    standardPrice = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    tierPrice = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    costPrice = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    ecommerce = models.BooleanField(null=True, blank=True)
    active = models.BooleanField(null=True, blank=True)
    compositeProduct = models.BooleanField(null=True, blank=True)
    stateRestricted = models.BooleanField(null=True, blank=True)
    customerGroupRestricted = models.BooleanField(null=True, blank=True)
    categories = models.ManyToManyField("Category", related_name="products_m2m", blank=True)
    trackInventory = models.BooleanField(null=True, blank=True)
    trackInventoryByImei = models.BooleanField(null=True, blank=True)
    size = models.IntegerField(null=True, blank=True)
    returnable = models.BooleanField(null=True, blank=True)
    minimumSellingPrice = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    TotalSaleAmount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    TotalGrossMargin = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    TotalGrossMarginPrecentage = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    TotalRevenue = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    inventoryList = models.ManyToManyField("InventoryData", related_name="products", blank=True)
    lastSyncTimestamp = models.DateTimeField(null=True, blank=True, auto_now=True)

    def __str__(self):
        return str(self.productName)


class Category(models.Model):
    categoryId = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=255)
    alias = models.CharField(max_length=255)
    parentId = models.IntegerField(null=True, blank=True)
    parentIdStr = models.CharField(max_length=255, null=True, blank=True)
    imageUrl = models.URLField(max_length=500, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    ecommerce = models.BooleanField(null=True, blank=True)
    customerSpecific = models.BooleanField(null=True, blank=True)
    loginRequired = models.BooleanField(null=True, blank=True)
    repairCategory = models.BooleanField(null=True, blank=True)
    businessTypeId = models.IntegerField(null=True, blank=True)
    businessTypeName = models.CharField(max_length=255, null=True, blank=True)
    sequenceNumber = models.IntegerField(null=True, blank=True)
    metaTitle = models.CharField(max_length=255, null=True, blank=True)
    metaData = models.TextField(null=True, blank=True)
    metaDescription = models.TextField(null=True, blank=True)
    deleted = models.BooleanField(null=True, blank=True)
    taxPaid = models.BooleanField(null=True, blank=True)
    lastSyncTimestamp = models.DateTimeField(null=True, blank=True, auto_now=True)
    businessTypeList = models.ManyToManyField("BusinessType", related_name="categories", blank=True)

    def __str__(self):
        return str(self.name)


class BusinessType(models.Model):
    name = models.CharField(max_length=255, primary_key=True)
    imageUrl = models.URLField(max_length=500, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    insertedTimestamp = models.DateTimeField(auto_now_add=True)
    lastSyncTimestamp = models.DateTimeField(null=True, blank=True, auto_now=True)


class InventoryData(models.Model):
    id = models.IntegerField(primary_key=True)
    productInventoryId = models.IntegerField()
    productId = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        db_column="productId",
        related_name="inventory_records",
    )
    wareHouseId = models.IntegerField()
    quantity = models.IntegerField()
    availableQuantity = models.IntegerField()
    costPrice = models.DecimalField(max_digits=10, decimal_places=2)
    orderId = models.IntegerField(null=True, blank=True)
    orderLineItemId = models.IntegerField(null=True, blank=True)
    orderFulfillmentId = models.IntegerField(null=True, blank=True)
    returnOrderId = models.IntegerField(null=True, blank=True)
    purchaseOrderId = models.IntegerField(null=True, blank=True)
    billId = models.IntegerField(null=True, blank=True)
    transferOrderId = models.IntegerField(null=True, blank=True)
    vendorReturnOrderId = models.IntegerField(null=True, blank=True)
    compositeProductId = models.IntegerField(null=True, blank=True)
    adjustmentId = models.IntegerField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    actionType = models.CharField(max_length=255, null=True, blank=True)
    salesOrderId = models.IntegerField(null=True, blank=True)
    createdBy = models.IntegerField()
    insertedTimestamp = models.DateTimeField()
    employeeName = models.CharField(max_length=255, null=True, blank=True)
    storeName = models.CharField(max_length=255, null=True, blank=True)
    warehouseName = models.CharField(max_length=255, null=True, blank=True)
    lastSyncTimestamp = models.DateTimeField(null=True, blank=True, auto_now=True)

    def __str__(self):
        return str(self.id)


class Vendor(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=255)
    company = models.CharField(max_length=255, null=True, blank=True)
    dbaName = models.CharField(max_length=255, null=True, blank=True)
    active = models.BooleanField(default=True)
    address1 = models.CharField(max_length=255, null=True, blank=True)
    address2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    stateId = models.IntegerField(null=True, blank=True)
    stateName = models.CharField(max_length=255, null=True, blank=True)
    zip = models.CharField(max_length=20, null=True, blank=True)
    country = models.CharField(max_length=255, null=True, blank=True)
    countryId = models.IntegerField(null=True, blank=True)
    county = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=500, null=True, blank=True)
    workPhone = models.CharField(max_length=500, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    websiteUrl = models.URLField(max_length=500, null=True, blank=True)
    websiteUsername = models.CharField(max_length=255, null=True, blank=True)
    websitePassword = models.CharField(max_length=255, null=True, blank=True)
    portalUserName = models.CharField(max_length=255, null=True, blank=True)
    portalPassword = models.CharField(max_length=255, null=True, blank=True)
    taxId = models.CharField(max_length=100, null=True, blank=True)
    feinNumber = models.CharField(max_length=100, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    dueAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    excessAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    storeCredit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    insuranceExpiryDate = models.DateField(null=True, blank=True)
    manufacturerId = models.IntegerField(null=True, blank=True)
    manufacturerType = models.CharField(max_length=255, null=True, blank=True)
    msaTypeId = models.IntegerField(null=True, blank=True)
    msaTypeName = models.CharField(max_length=255, null=True, blank=True)
    paymentTermsId = models.IntegerField(null=True, blank=True)
    paymentTermsName = models.CharField(max_length=255, null=True, blank=True)
    primarySalesRepresentativeId = models.IntegerField(null=True, blank=True)
    primarySalesRepresentativeName = models.CharField(max_length=255, null=True, blank=True)
    createdBy = models.IntegerField(null=True, blank=True)
    updatedBy = models.IntegerField(null=True, blank=True)
    insertedTimestamp = models.DateTimeField(null=True, blank=True)
    updatedTimestamp = models.DateTimeField(null=True, blank=True)
    lastSyncTimestamp = models.DateTimeField(null=True, blank=True, auto_now=True)

    def __str__(self):
        return str(self.name)

class Customer(models.Model):
    id = models.AutoField(primary_key=True)
    insertedTimestamp = models.DateTimeField(null=True, blank=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    company = models.CharField(max_length=255, null=True, blank=True)
    storeId = models.IntegerField(null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=500, null=True, blank=True)
    tier = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    storeCredit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    loyaltyPoints = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    dueAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    excessAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    verified    = models.BooleanField(default=False)
    viewSpecificCategory = models.BooleanField(default=False)
    viewSpecificProduct = models.BooleanField(default=False)
    salesRepresentativeName = models.CharField(max_length=255, null=True, blank=True)
    taxable = models.BooleanField(default=False)
    communicateViaPhone = models.BooleanField(default=False)
    communicateViaText = models.BooleanField(default=False)
    dbaName = models.CharField(max_length=255, null=True, blank=True)
    address1 = models.CharField(max_length=255, null=True, blank=True)
    stateId = models.IntegerField(null=True, blank=True)
    billingStateId = models.IntegerField(null=True, blank=True)
    sendDuePaymentReminder = models.BooleanField(default=False)
    rewardable = models.BooleanField(default=False)
    saveProductPrice = models.BooleanField(default=False)
        
    def __str__(self):
        """String representation of the Customer model."""
        return f"{self.name} ({self.company or 'N/A'})"

    class Meta:
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        ordering = ['name']



class Invoice(models.Model):
    id = models.IntegerField(primary_key=True)
    totalQuantity = models.IntegerField(default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    totalAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=100, default="")
    insertedTimestamp = models.DateTimeField(null=True, blank=True)
    customerId = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        db_column="customerId",
        null=True,
        blank=True,
    )
    customerName = models.CharField(max_length=255, default="")
    companyName = models.CharField(max_length=255, default="")
    email = models.EmailField(null=True, blank=True)
    storeName = models.CharField(max_length=255, default="")
    orderTags = models.TextField(null=True, blank=True)
    dueAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    dueDate = models.DateTimeField(null=True, blank=True)
    orderNotes = models.TextField(null=True, blank=True)
    salesRepId = models.IntegerField(null=True, blank=True)
    salesRepName = models.CharField(max_length=255, default="")
    pickerId = models.IntegerField(null=True, blank=True)
    pickerName = models.CharField(max_length=255, null=True, blank=True)
    trackingUrl = models.URLField(max_length=500, null=True, blank=True)
    trackingNumber = models.CharField(max_length=255, null=True, blank=True)
    salesOrderId = models.IntegerField(null=True, blank=True)
    quotationId = models.IntegerField(null=True, blank=True)
    shippingStatusId = models.IntegerField(null=True, blank=True)
    shippingStatusName = models.CharField(max_length=255, default="")
    stateId = models.IntegerField(null=True, blank=True)
    state = models.CharField(max_length=100, default="")
    city = models.CharField(max_length=100, default="")
    county = models.CharField(max_length=100, null=True, blank=True)
    dbaName = models.CharField(max_length=255, null=True, blank=True)
    lastSyncTimestamp = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return str(self.id)
    
class ProductHistory(models.Model):
    productId = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        db_column="productId",
        related_name="product_history",
    )
    quantity = models.IntegerField(null=True, blank=True)
    costPrice = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    retailPrice = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    date = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.productId.productName} - {self.quantity}"


class InvoiceLineItem(models.Model):
    id = models.IntegerField(primary_key=True)
    createdBy = models.IntegerField(null=True, blank=True)
    insertedTimestamp = models.DateTimeField(null=True, blank=True)
    updatedBy = models.IntegerField(null=True, blank=True)
    updatedTimestamp = models.DateTimeField(null=True, blank=True)
    orderId = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        db_column="orderId",
        related_name="line_items",
    )
    productId = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        db_column="productId",
        related_name="invoice_line_items",
    )
    masterProductId = models.IntegerField(null=True, blank=True)
    quantity = models.IntegerField(default=0, null=True, blank=True)
    availableQuantity = models.IntegerField(default=0, null=True, blank=True)
    deleted = models.BooleanField(default=False, null=True, blank=True)
    inStock = models.BooleanField(default=False, null=True, blank=True)
    shippingQuantity = models.IntegerField(default=0, null=True, blank=True)
    packs = models.IntegerField(default=0, null=True, blank=True)
    costPrice = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    maxCostPrice = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    retailPrice = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    couponDiscount = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    discountValue = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    discountType = models.CharField(max_length=500, default="", null=True, blank=True)
    discountAmount = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    taxClassId = models.IntegerField(default=0, null=True, blank=True)
    taxType = models.CharField(max_length=100, default="", null=True, blank=True)
    taxPercentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, null=True, blank=True)
    taxPerVolume = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    taxPerOunce = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    directTaxPercentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, null=True, blank=True)
    taxIncludedInSellingPrice = models.BooleanField(default=False, null=True, blank=True)
    volume = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    size = models.IntegerField(default=0, null=True, blank=True)
    taxAmount = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    totalAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0, null=True, blank=True)
    retailAfterDiscount = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    updated = models.BooleanField(default=False, null=True, blank=True)
    loyaltyPointPerProduct = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=100, default="", null=True, blank=True)
    productInventoryId = models.IntegerField(default=0, null=True, blank=True)
    productName = models.CharField(max_length=255, default="", null=True, blank=True)
    sku = models.CharField(max_length=500, default="", null=True, blank=True)
    upc = models.CharField(max_length=500, default="", null=True, blank=True)
    singleUpc = models.CharField(max_length=500, default="", null=True, blank=True)
    discountId = models.IntegerField(null=True, blank=True)
    boxQuantity = models.IntegerField(default=0, null=True, blank=True)
    serviceProduct = models.BooleanField(default=False, null=True, blank=True)
    trackInventoryByImei = models.BooleanField(default=False, null=True, blank=True)
    trackInventory = models.BooleanField(default=False, null=True, blank=True)
    sameCostAndRetail = models.BooleanField(default=False, null=True, blank=True)
    productIMEIList = models.TextField(null=True, blank=True)
    grossMargin = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    grossMarginPercentage = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    isNoteName = models.BooleanField(default=False, null=True, blank=True)
    masterCategoryName = models.CharField(max_length=255, null=True, blank=True)
    productDefaultLocation = models.CharField(max_length=255, blank=True)
    urlAlias = models.CharField(max_length=255, null=True, blank=True)
    productImageList = models.TextField(null=True, blank=True)
    dropShipment = models.BooleanField(default=False, null=True, blank=True)
    primaryVendorId = models.IntegerField(default=0, null=True, blank=True)
    primaryVendorName = models.CharField(max_length=255, null=True, blank=True)
    inventoryValidated = models.BooleanField(default=False, null=True, blank=True)
    alternativeName = models.CharField(max_length=255, null=True, blank=True)
    salesOrderLineItemId = models.IntegerField(null=True, blank=True)
    salesOrderQuantity = models.IntegerField(default=0, null=True, blank=True)
    minimumSellingPrice = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    msrp = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)


class PurchaseHistory(models.Model):
    purchaseOrderId = models.IntegerField()
    productId = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        db_column="productId",
        related_name="purchase_history",
    )
    upc = models.CharField(max_length=500,null=True,blank=True)
    sku = models.CharField(max_length=500,null=True,blank=True)
    name = models.CharField(max_length=255)
    purchasedQuantity = models.IntegerField(null=True,blank=True)
    passedQuantity = models.IntegerField(null=True,blank=True)
    failedQuantity = models.IntegerField(null=True,blank=True)
    costPrice = models.DecimalField(max_digits=10, decimal_places=2,null=True,blank=True)
    totalCostPrice = models.DecimalField(max_digits=12, decimal_places=2,null=True,blank=True)
    vendorId = models.ForeignKey(
        Vendor,
        on_delete=models.CASCADE,
        db_column="vendorId",
        related_name="purchase_history",
    )
    vendorName = models.CharField(max_length=255,null=True,blank=True)
    billId = models.CharField(max_length=500,null=True,blank=True)
    purchaseOrderInsertedTimestamp = models.DateTimeField(null=True,blank=True)
    billInsertedTimestamp = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.purchaseOrderId} - {self.productId.productName}"

class SalesgentToken(models.Model):
    id = models.AutoField(primary_key=True)
    accessToken = models.TextField()
    refreshToken = models.TextField(null=True, blank=True)
    lastSyncTimestamp = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.accessToken

class AIReport(models.Model):
    reportName = models.CharField(max_length=255, unique=True)
    htmlContent = models.TextField()
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.reportName