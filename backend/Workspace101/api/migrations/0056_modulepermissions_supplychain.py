# Generated migration for supplychain module permission

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0055_product_parvaluedays"),
    ]

    operations = [
        migrations.AddField(
            model_name="modulepermissions",
            name="supplychain",
            field=models.BooleanField(default=False),
        ),
    ]
