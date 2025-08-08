# delivery/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("scan-invoice/",views.ScanInvoice.as_view(), name="ScanInvoice"),
    path("truck-info/", views.TruckInfo.as_view(), name="TruckInfo"),
    path("upload-delivery-entry/", views.UploadDeliveryEntry.as_view(), name="UploadDeliveryEntry"),
    path("list-deliveries/", views.ListDeliveries.as_view(), name="ListDeliveries"),
    path("dashboard-stats/", views.DashboardStats.as_view(), name="DashboardStats"),
    path("invoice/<str:invoice_id>/", views.InvoiceDetail.as_view(), name="InvoiceDetail"),
    
    # Truck CRUD endpoints
    path("trucks/", views.TruckCRUD.as_view(), name="TruckList"),
    path("trucks/<int:truck_id>/", views.TruckCRUD.as_view(), name="TruckDetail"),
    
    # Driver CRUD endpoints
    path("drivers/", views.DriverCRUD.as_view(), name="DriverList"),
    path("drivers/<int:driver_id>/", views.DriverCRUD.as_view(), name="DriverDetail"),
]