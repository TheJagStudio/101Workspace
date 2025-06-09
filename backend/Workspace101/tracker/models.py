from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User


class Salesman(models.Model):
    USER_TYPE_CHOICES = (
        ('salesman', 'Salesman'),
        ('admin', 'Admin'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salesmen')
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='salesman')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('offline', 'Offline'),
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='offline')
    last_seen = models.DateTimeField(auto_now=True)
    current_location_lat = models.FloatField(blank=True, null=True)
    current_location_lng = models.FloatField(blank=True, null=True)
    today_visits = models.IntegerField(default=0)
    battery = models.IntegerField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )

    class Meta:
        verbose_name = "Salesman"
        verbose_name_plural = "Salesmen"

    def __str__(self):
        return self.user.username


class LocationPoint(models.Model):
    salesman = models.ForeignKey(Salesman, on_delete=models.CASCADE, related_name='location_history')
    latitude = models.FloatField()
    longitude = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Location Point"
        verbose_name_plural = "Location Points"
        ordering = ['timestamp']

    def __str__(self):
        return f"Location for {self.salesman.user.username} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"


class DailyActivity(models.Model):
    salesman = models.ForeignKey(Salesman, on_delete=models.CASCADE, related_name='daily_activities')
    date = models.DateField()
    checkpoints = models.IntegerField(default=0)
    duration = models.CharField(max_length=50, blank=True, null=True)
    distance = models.FloatField(default=0.0)
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    route_coordinates_json = models.JSONField(default=list, blank=True, null=True)

    class Meta:
        verbose_name = "Daily Activity"
        verbose_name_plural = "Daily Activities"
        unique_together = ('salesman', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"Daily Activity for {self.salesman.user.username} on {self.date}"


class AdminSettings(models.Model):
    location_update_interval_minutes = models.IntegerField(default=3, help_text="Interval in minutes for location updates.")
    checkpoint_threshold_minutes = models.IntegerField(default=15, help_text="Time in minutes a salesman must stay at a location to be considered a checkpoint.")
    proximity_range_meters = models.IntegerField(default=50, help_text="Proximity range in meters for location-based events.")
    notify_salesman_offline = models.BooleanField(default=True)
    notify_low_battery_alerts = models.BooleanField(default=True)
    notify_unusual_route_patterns = models.BooleanField(default=True)
    notify_daily_summary_reports = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Admin Setting"
        verbose_name_plural = "Admin Settings"

    def __str__(self):
        return "Global Admin Settings"

    def save(self, *args, **kwargs):
        if not self.pk and AdminSettings.objects.exists():
            existing_settings = AdminSettings.objects.first()
            self.pk = existing_settings.pk
        super().save(*args, **kwargs)


class PlannedRoute(models.Model):
    salesman = models.ForeignKey(Salesman, on_delete=models.CASCADE, related_name='planned_routes')
    date = models.DateField()
    name = models.CharField(max_length=200, help_text="e.g., 'Stone Mountain Gas Stations'")
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    class Meta:
        verbose_name = "Planned Route"
        verbose_name_plural = "Planned Routes"
        unique_together = ('salesman', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"Route for {self.salesman.user.username} on {self.date}"


class RouteStop(models.Model):
    route = models.ForeignKey(PlannedRoute, on_delete=models.CASCADE, related_name='stops')
    location_name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    order = models.PositiveIntegerField()
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('visited', 'Visited'),
        ('skipped', 'Skipped'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    visited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Route Stop"
        verbose_name_plural = "Route Stops"
        ordering = ['route', 'order']

    def __str__(self):
        return f"Stop {self.order}: {self.location_name} for route {self.route.id}"


class SystemNotification(models.Model):
    salesman = models.ForeignKey(Salesman, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    EVENT_CHOICES = (
        ('offline', 'Went Offline'),
        ('online', 'Came Online'),
        ('low_battery', 'Low Battery'),
        ('checkpoint', 'Reached Checkpoint'),
        ('route_start', 'Started Route'),
    )
    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES)
    message = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        verbose_name = "System Notification"
        verbose_name_plural = "System Notifications"
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.event_type}] {self.message} at {self.timestamp}"