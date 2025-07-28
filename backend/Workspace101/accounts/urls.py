from django.urls import path

from . import views

urlpatterns = [
    path(
        "invoice/",
        views.InvoicesView.as_view(),
        name="InvoicesView",
    )
]
