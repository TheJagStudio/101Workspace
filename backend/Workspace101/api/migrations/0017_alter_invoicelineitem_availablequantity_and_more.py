# Generated by Django 5.0.2 on 2025-06-01 19:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0016_alter_invoice_city_alter_invoice_companyname_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invoicelineitem",
            name="availableQuantity",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="boxQuantity",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="costPrice",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="couponDiscount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="directTaxPercentage",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="discountAmount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="discountType",
            field=models.CharField(default="", max_length=50),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="discountValue",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="grossMargin",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="grossMarginPercentage",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="loyaltyPointPerProduct",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="maxCostPrice",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="minimumSellingPrice",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="msrp",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="packs",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="primaryVendorId",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="productInventoryId",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="productName",
            field=models.CharField(default="", max_length=255),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="quantity",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="retailAfterDiscount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="retailPrice",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="salesOrderQuantity",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="shippingQuantity",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="singleUpc",
            field=models.CharField(default="", max_length=50),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="size",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="sku",
            field=models.CharField(default="", max_length=50),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="status",
            field=models.CharField(default="", max_length=100),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="taxAmount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="taxClassId",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="taxPerOunce",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="taxPerVolume",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="taxPercentage",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="taxType",
            field=models.CharField(default="", max_length=100),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="totalAmount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AlterField(
            model_name="invoicelineitem",
            name="upc",
            field=models.CharField(default="", max_length=50),
        ),
    ]
