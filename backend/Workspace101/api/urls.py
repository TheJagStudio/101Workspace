from django.urls import path

from . import views
from .erp_proxy import ErpProxyView

urlpatterns = [
    path(
        "search-products/",
        views.SearchProductsView.as_view(),
        name="SearchProductsView",
    ),
    path(
        "sync-salesgent-token/",
        views.SyncSalesgentTokenView.as_view(),
        name="SyncSalesgentTokenView",
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
    path("dataMaker/", views.dataMaker.as_view(), name="dataMaker"),
    path("vacuum-sqlite/", views.vacuum_sqlite_database.as_view(), name="vacuum_sqlite"),
    path("proxy/<path:route>", ErpProxyView.as_view(), name="erp_proxy"),
    path("summer-sale-registration/", views.SummerSaleUserRegistration.as_view(), name="SummerSaleUserRegistrationView"),
]
