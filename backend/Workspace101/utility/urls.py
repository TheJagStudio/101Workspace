from django.urls import path

from . import views

urlpatterns = [
    path(
        "sync-products/",
        views.SyncProductsView.as_view(),
        name="SyncProductsView",
    ),
    path(
        "sticker/health/",
        views.StickerHealthView.as_view(),
        name="StickerHealthView",
    ),
    path(
        "sticker/products/",
        views.StickerProductSearchView.as_view(),
        name="StickerProductSearchView",
    ),
    path(
        "sticker/products/bulk/",
        views.StickerBulkUpcView.as_view(),
        name="StickerBulkUpcView",
    ),
]