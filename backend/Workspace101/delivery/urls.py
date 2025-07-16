# delivery/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Admin URLs
    path("", views.HelloView.as_view(), name="HelloView"),
]