from django.http import JsonResponse
from django.shortcuts import render
from django.views import View
from django.urls import path
from . import views


# Create your views here.
class InvoicesView(View):
    def get(self, request):
        # Logic for handling invoice view
        return JsonResponse({"message": "Invoices view"})