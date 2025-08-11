from django.urls import path

from . import views

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
]
