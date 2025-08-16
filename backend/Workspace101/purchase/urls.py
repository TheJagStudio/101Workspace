from django.urls import path

from . import views

urlpatterns = [
    path(
        "products/",
        views.ProductListingView.as_view(),
        name="ProductListingView",
    ),
    path(
        "inventory-summary/",
        views.InventorySummaryView.as_view(),
        name="InventorySummaryView",
    ),
    path(
        "hot-product/",
        views.HotProductView.as_view(),
        name="HotProductView",
    ),
    path(
        "inventory-replenishment/",
        views.InventoryReplenishmentView.as_view(),
        name="InventoryReplenishmentView",
    ),
    path(
        "dusty-inventory/",
        views.DustyInventoryView.as_view(),
        name="DustyInventoryView",
    ),
    path(
        "categories/",
        views.FetchCategoriesView.as_view(),
        name="FetchCategoriesView",
    ),
    path(
        "vendors-by-category/<int:category_id>/",
        views.FetchVendorsByCategoryView.as_view(),
        name="FetchVendorsByCategoryView",
    ),
    path(
        "product-history/<int:product_id>/",
        views.ProductHistoryView.as_view(),
        name="ProductHistoryView",
    ),
    path(
        "po-maker/",
        views.POMakerView.as_view(),
        name="POMakerView",
    ),
    path(
        "po/",
        views.POView.as_view(),
        name="POView",
    ),
    path(
        "po-line-items/<int:po_id>/",
        views.POLineItemView.as_view(),
        name="POLineItemView",
    ),
    path(
        "clearance-loss-report/",
        views.ClearanceLossReportView.as_view(),
        name="ClearanceLossReportView",
    ),
    path("par-level/", views.ParLevelView.as_view(), name="ParLevelView"),
]
