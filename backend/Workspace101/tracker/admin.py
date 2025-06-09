from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from .models import Salesman, LocationPoint, DailyActivity, AdminSettings, PlannedRoute, RouteStop, SystemNotification

# --- Admin Classes ---

class SalesmanAdmin(ImportExportModelAdmin):
    list_display = ('user', 'status', 'last_seen', 'current_location_lat', 'current_location_lng', 'today_visits', 'battery')
    list_filter = ('status', 'battery')
    search_fields = ('user__username', 'user__email', 'user__phone_number')

class LocationPointAdmin(ImportExportModelAdmin):
    list_display = ('salesman', 'latitude', 'longitude', 'timestamp')
    list_filter = ('salesman', 'timestamp')
    search_fields = ('salesman__user__username',)
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)

class DailyActivityAdmin(ImportExportModelAdmin):
    list_display = ('salesman', 'date', 'checkpoints', 'duration', 'distance', 'start_time', 'end_time')
    list_filter = ('salesman', 'date')
    search_fields = ('salesman__user__username',)
    date_hierarchy = 'date'
    ordering = ('-date',)

class AdminSettingsAdmin(ImportExportModelAdmin):
    list_display = ('location_update_interval_minutes', 'checkpoint_threshold_minutes', 'proximity_range_meters',
                    'notify_salesman_offline', 'notify_low_battery_alerts', 'notify_unusual_route_patterns', 'notify_daily_summary_reports')

    def has_add_permission(self, request):
        # Allow adding only if no settings exist yet
        return not AdminSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Prevent deletion to ensure settings always exist
        return False

class PlannedRouteAdmin(ImportExportModelAdmin):
    list_display = ('salesman', 'date', 'name', 'status')
    list_filter = ('salesman', 'date', 'status')
    search_fields = ('salesman__user__username', 'name')
    ordering = ('-date',)

class RouteStopAdmin(ImportExportModelAdmin):
    list_display = ('route', 'order', 'location_name', 'status', 'visited_at')
    list_filter = ('route', 'status')
    search_fields = ('route__name', 'location_name')
    ordering = ('route', 'order')

class SystemNotificationAdmin(ImportExportModelAdmin):
    list_display = ('salesman', 'event_type', 'message', 'timestamp', 'is_read')
    list_filter = ('event_type', 'is_read', 'timestamp')
    search_fields = ('salesman__user__username', 'message')
    ordering = ('-timestamp',)

# Register your models here.
admin.site.register(Salesman, SalesmanAdmin)
admin.site.register(LocationPoint, LocationPointAdmin)
admin.site.register(DailyActivity, DailyActivityAdmin)
admin.site.register(AdminSettings, AdminSettingsAdmin)
admin.site.register(PlannedRoute, PlannedRouteAdmin)
admin.site.register(RouteStop, RouteStopAdmin)
admin.site.register(SystemNotification, SystemNotificationAdmin)