from django.contrib import admin
from django.urls import path
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("api/", include("api.urls")),
    path("api/purchase/", include("purchase.urls")),
    path("api/auth/", include("authAPI.urls")),
    path("api/sync/", include("sync.urls")),
    path("api/tracker/", include("tracker.urls")),
    path("api/accounts/", include("accounts.urls")),
    path("api/utility/", include("utility.urls")),
    path("api/delivery/", include("delivery.urls")),
    path("api-auth/", include("rest_framework.urls")),
    path("admin/", admin.site.urls),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
