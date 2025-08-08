from django.contrib import admin
from .models import DeliveryDriver, DeliveryTruck, DeliverySheet

from import_export.admin import ImportExportModelAdmin
# Register your models here.
class DeliveryDriverAdmin(ImportExportModelAdmin):
    list_display = ('user', 'driverLicense')
    search_fields = ('user__first_name', 'user__last_name', 'driverLicense')
    autocomplete_fields = ['user']

class DeliveryTruckAdmin(ImportExportModelAdmin):
    list_display = ('truckNo', 'truckName')
    search_fields = ('truckNo', 'truckName')


class DeliverySheetAdmin(ImportExportModelAdmin):
    list_display = ('invoice', 'customer', 'box', 'checkAmount', 'cashAmount', 'payment_status', 'status', 'date', 'truck', 'driver', 'insertedTimestamp', 'deliveryTimestamp')
    list_filter = ('payment_status', 'status', 'date', 'truck', 'driver')
    search_fields = ('invoice__id', 'customer__name', 'truck__truckNo', 'driver__driverName')
    autocomplete_fields = ['invoice', 'customer', 'truck', 'driver']

admin.site.register(DeliveryDriver, DeliveryDriverAdmin)
admin.site.register(DeliveryTruck, DeliveryTruckAdmin)  
admin.site.register(DeliverySheet, DeliverySheetAdmin)