from django.http import JsonResponse
from django.shortcuts import render
from django.views import View
from django.urls import path
from . import views
from api.models import SalesgentToken
import requests


# Create your views here.
class InvoicesView(View):
    def get(self, request):
        token = SalesgentToken.objects.filter(id=1).first()
        page = request.GET.get('page', 0)
        size = request.GET.get('size', 20)
        startDate = request.GET.get('startDate', None)
        endDate = request.GET.get('endDate', None)
        headers = {
            'Accept': 'application/json, text/plain',
            'Accept-Language': 'en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6',
            'Authorization': f'Bearer {token.accessToken}' if token else '',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Pragma': 'no-cache',
            'Referer': 'https://erp.101distributorsga.com/sales',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
        }
        url = 'https://erp.101distributorsga.com/api/order/list?storeIds=1,2&page=' + str(page) + '&size=' + str(size) + '&showEmployeeSpecificData=false'
        if startDate and endDate:
            url += f'&startDate={startDate}+00:00:00&endDate={endDate}+23:59:59'
        response = requests.get(
            url,
            headers=headers,
        )
        return JsonResponse(response.json(), safe=False)