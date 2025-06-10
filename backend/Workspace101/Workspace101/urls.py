from django.contrib import admin
from django.urls import path
from django.urls import include, path

urlpatterns = [
    path("backend/api/", include("api.urls")),
    path("backend/api/auth/", include("authAPI.urls")),
    path("backend/api/sync/", include("sync.urls")),
    path("backend/api/tracker/", include("tracker.urls")),
    path("backend/api-auth/", include("rest_framework.urls")),
    path("backend/admin/", admin.site.urls),
]
