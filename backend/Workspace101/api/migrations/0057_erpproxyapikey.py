from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0056_modulepermissions_supplychain"),
    ]

    operations = [
        migrations.CreateModel(
            name="ErpProxyApiKey",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(help_text="Label for this client (e.g. Label Designer Pro)", max_length=255)),
                ("key", models.CharField(db_index=True, editable=False, max_length=64, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
            ],
            options={
                "verbose_name": "ERP proxy API key",
                "verbose_name_plural": "ERP proxy API keys",
            },
        ),
    ]
