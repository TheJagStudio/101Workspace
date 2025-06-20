# Generated by Django 5.2.1 on 2025-06-02 22:08

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("authAPI", "0002_rename_user_customuser"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customuser",
            name="user_permissions",
            field=models.ManyToManyField(
                blank=True,
                help_text="Specific permissions for this user.",
                related_name="tracker_user_permissions",
                related_query_name="tracker_user_permission",
                to="auth.permission",
                verbose_name="user permissions",
            ),
        ),
    ]
