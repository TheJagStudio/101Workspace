# Generated by Django 5.2.1 on 2025-05-31 20:56

import django.contrib.auth.models
import django.contrib.auth.validators
import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="AdminSettings",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "location_update_interval_minutes",
                    models.IntegerField(
                        default=3, help_text="Interval in minutes for location updates."
                    ),
                ),
                (
                    "checkpoint_threshold_minutes",
                    models.IntegerField(
                        default=15,
                        help_text="Time in minutes a salesman must stay at a location to be considered a checkpoint.",
                    ),
                ),
                (
                    "proximity_range_meters",
                    models.IntegerField(
                        default=50,
                        help_text="Proximity range in meters for location-based events.",
                    ),
                ),
                ("notify_salesman_offline", models.BooleanField(default=True)),
                ("notify_low_battery_alerts", models.BooleanField(default=True)),
                ("notify_unusual_route_patterns", models.BooleanField(default=True)),
                ("notify_daily_summary_reports", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Admin Setting",
                "verbose_name_plural": "Admin Settings",
            },
        ),
        migrations.CreateModel(
            name="Salesman",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Active"), ("offline", "Offline")],
                        default="offline",
                        max_length=10,
                    ),
                ),
                ("last_seen", models.DateTimeField(auto_now=True)),
                ("current_location_lat", models.FloatField(blank=True, null=True)),
                ("current_location_lng", models.FloatField(blank=True, null=True)),
                ("today_visits", models.IntegerField(default=0)),
                (
                    "battery",
                    models.IntegerField(
                        default=100,
                        validators=[
                            django.core.validators.MinValueValidator(0),
                            django.core.validators.MaxValueValidator(100),
                        ],
                    ),
                ),
            ],
            options={
                "verbose_name": "Salesman",
                "verbose_name_plural": "Salesmen",
                "ordering": ["user__username"],
            },
        ),
        migrations.CreateModel(
            name="LocationPoint",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("latitude", models.FloatField()),
                ("longitude", models.FloatField()),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                (
                    "salesman",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="location_history",
                        to="tracker.salesman",
                    ),
                ),
            ],
            options={
                "verbose_name": "Location Point",
                "verbose_name_plural": "Location Points",
                "ordering": ["timestamp"],
            },
        ),
        migrations.CreateModel(
            name="User",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                (
                    "last_login",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="last login"
                    ),
                ),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                (
                    "username",
                    models.CharField(
                        error_messages={
                            "unique": "A user with that username already exists."
                        },
                        help_text="Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.",
                        max_length=150,
                        unique=True,
                        validators=[
                            django.contrib.auth.validators.UnicodeUsernameValidator()
                        ],
                        verbose_name="username",
                    ),
                ),
                (
                    "first_name",
                    models.CharField(
                        blank=True, max_length=150, verbose_name="first name"
                    ),
                ),
                (
                    "last_name",
                    models.CharField(
                        blank=True, max_length=150, verbose_name="last name"
                    ),
                ),
                (
                    "email",
                    models.EmailField(
                        blank=True, max_length=254, verbose_name="email address"
                    ),
                ),
                (
                    "is_staff",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether the user can log into this admin site.",
                        verbose_name="staff status",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True,
                        help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.",
                        verbose_name="active",
                    ),
                ),
                (
                    "date_joined",
                    models.DateTimeField(
                        default=django.utils.timezone.now, verbose_name="date joined"
                    ),
                ),
                (
                    "user_type",
                    models.CharField(
                        choices=[("salesman", "Salesman"), ("admin", "Admin")],
                        default="salesman",
                        max_length=10,
                    ),
                ),
                (
                    "phone_number",
                    models.CharField(blank=True, max_length=20, null=True),
                ),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                        related_name="tracker_users",
                        related_query_name="tracker_user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="tracker_users",
                        related_query_name="tracker_user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={
                "verbose_name": "User",
                "verbose_name_plural": "Users",
                "db_table": "users",
            },
            managers=[
                ("objects", django.contrib.auth.models.UserManager()),
            ],
        ),
        migrations.AddField(
            model_name="salesman",
            name="user",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="salesman_profile",
                to="tracker.user",
            ),
        ),
        migrations.CreateModel(
            name="DailyActivity",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("date", models.DateField()),
                ("checkpoints", models.IntegerField(default=0)),
                ("duration", models.CharField(blank=True, max_length=50, null=True)),
                ("distance", models.FloatField(default=0.0)),
                ("start_time", models.TimeField(blank=True, null=True)),
                ("end_time", models.TimeField(blank=True, null=True)),
                (
                    "route_coordinates_json",
                    models.JSONField(blank=True, default=list, null=True),
                ),
                (
                    "salesman",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="daily_activities",
                        to="tracker.salesman",
                    ),
                ),
            ],
            options={
                "verbose_name": "Daily Activity",
                "verbose_name_plural": "Daily Activities",
                "ordering": ["-date"],
                "unique_together": {("salesman", "date")},
            },
        ),
    ]
