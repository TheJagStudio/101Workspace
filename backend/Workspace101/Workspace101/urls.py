from django.contrib import admin
from django.urls import path
from django.urls import include, path

urlpatterns = [
    path("api/", include("api.urls")),
    path("api/auth/", include("authAPI.urls")),
    path("api/sync/", include("sync.urls")),
    path("api/tracker/", include("tracker.urls")),
    path("api-auth/", include("rest_framework.urls")),
    path("admin/", admin.site.urls),
]
