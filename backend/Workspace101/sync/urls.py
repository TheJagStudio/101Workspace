from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("sync-data/", views.syncData.as_view(), name="sync-data")
]