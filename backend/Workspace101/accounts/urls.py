from django.urls import path

from . import views

urlpatterns = [
    path(
        "invoices/",
        views.InvoicesView.as_view(),
        name="InvoicesView",
    ),
    path(
        "stamp-invoice/",
        views.StampInvoiceView.as_view(),
        name="StampInvoiceView",
    ),
    path("download-stamped-invoices/", views.DownloadStampedInvoicesView.as_view(), name="DownloadStampedInvoicesView"),
]
