from django.urls import path

from . import views

urlpatterns = [
    path(
        "invoices/",
        views.InvoicesView.as_view(),
        name="InvoicesView",
    )
]
