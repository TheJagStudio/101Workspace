from django.urls import path

from . import views

urlpatterns = [
    path(
        "search-products/",
        views.SearchProductsView.as_view(),
        name="SearchProductsView",
    ),
    path(
        "products/",
        views.ProductListingView.as_view(),
        name="ProductListingView",
    ),
    path(
        "sync-salesgent-token/",
        views.SyncSalesgentTokenView.as_view(),
        name="SyncSalesgentTokenView",
    ),
    path(
        "inventory-summary/",
        views.InventorySummaryView.as_view(),
        name="InventorySummaryView",
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
        "chat-with-ai-agent/",
        views.ChatWithAIAgentView.as_view(),
        name="ChatWithAIAgentView",
    ),
    path(
        "ai-report/",
        views.AIReportView.as_view(),
        name="AIReportView",
    ),
    path(
        "po-maker/",
        views.POMakerView.as_view(),
        name="POMakerView",
    ),
    path("dataMaker/", views.dataMaker.as_view(), name="dataMaker"),
    path("vacuum-sqlite/", views.vacuum_sqlite_database.as_view(), name="vacuum_sqlite"),
    path("summer-sale-registration/", views.SummerSaleUserRegistration.as_view(), name="SummerSaleUserRegistrationView"),
    path("license-validator/", views.LicenseValidatorAPIView.as_view(), name="LicenseValidatorAPIView"),
    path("ollama-api/", views.OllamaApiView.as_view(), name="OllamaApiView"),
]
