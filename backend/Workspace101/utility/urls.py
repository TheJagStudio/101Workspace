from django.urls import path

from . import views

urlpatterns = [
    path(
        "sync-products/",
        views.SyncProductsView.as_view(),
        name="SyncProductsView",
    ),
]