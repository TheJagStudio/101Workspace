# Generated by Django 5.2.1 on 2025-06-03 21:54

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0022_rename_new_categories_m2m_product_categories"),
    ]

    operations = [
        migrations.AddField(
            model_name="businesstype",
            name="lastSyncTimestamp",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="inventorydata",
            name="lastSyncTimestamp",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="invoice",
            name="lastSyncTimestamp",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="product",
            name="lastSyncTimestamp",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="vendor",
            name="lastSyncTimestamp",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AlterField(
            model_name="category",
            name="lastSyncTimestamp",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
    ]
