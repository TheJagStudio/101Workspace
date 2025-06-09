# tracker/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Admin URLs
    path("admin/salesmen/", views.AdminSalesmanListView.as_view(), name="admin-salesmen-list"),
    path("admin/salesmen/<int:pk>/", views.AdminSalesmanDetailView.as_view(), name="admin-salesman-detail"),
    path("admin/salesmen/<int:pk>/route_history/", views.AdminSalesmanRouteHistoryView.as_view(), name="admin-salesman-route-history"),
    path("admin/settings/", views.AdminSettingsView.as_view(), name="admin-settings"),
    path("admin/notifications/", views.AdminNotificationListView.as_view(), name="admin-notifications-list"),
    path("admin/notifications/mark_all_read/", views.AdminMarkAllNotificationsReadView.as_view(), name="admin-notifications-mark-read"),
    path("admin/dashboard_stats/", views.AdminDashboardStatsView.as_view(), name="admin-dashboard-stats"),
    
    # Salesman URLs
    path("salesman/update_status/", views.SalesmanUpdateStatusView.as_view(), name="salesman-update-status"),
    path("salesman/set_tracking_status/", views.SalesmanSetTrackingStatusView.as_view(), name="salesman-set-tracking-status"),
    path("salesman/activity_history/", views.SalesmanActivityHistoryView.as_view(), name="salesman-activity-history"),
    path("salesman/places_search/", views.GooglePlacesProxyView.as_view(), name="salesman-places-search"),
    path("salesman/planned_routes/", views.SalesmanPlannedRouteView.as_view(), name="salesman-planned-routes-list-create"),
    path("salesman/planned_routes/today/", views.SalesmanTodayPlannedRouteView.as_view(), name="salesman-planned-routes-today"),
    path("salesman/planned_routes/stops/<int:pk>/update_status/", views.SalesmanRouteStopUpdateStatusView.as_view(), name="salesman-routestop-update-status"),
    path("salesman/activity/today/", views.SalesmanTodayActivityView.as_view(), name="salesman-today-activity"),
    path("salesman/stats/monthly/", views.SalesmanMonthlyStatsView.as_view(), name="salesman-monthly-stats"),
    path("salesman/planned_routes/add_stop/", views.SalesmanAddRouteStopView.as_view(), name="salesman-add-route-stop"),
]