from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.views import APIView

# Create your views here.
class HelloView(APIView):
    def get(self, request):
        """
        Search products based on query parameters.
        """
        return JsonResponse({"message": "Hello, World!"})