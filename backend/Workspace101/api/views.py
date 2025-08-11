from django.http import JsonResponse
import typesense
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import (
    Product,
    SalesgentToken,
    AIReport
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import  connection
import json
from api.ai_agent.agent import DjangoAIAgent
import requests
from django.contrib.auth.models import User

client = typesense.Client(
    {
        "api_key": settings.TYPESENSE_API_KEY,
        "nodes": [
            {
                "host": "purityai-typesense.hf.space",
                "port": "443",
                "protocol": "https",
            },
        ],
        "connection_timeout_seconds": 2,
    }
)
ai_agent = DjangoAIAgent(use_copilot=True)

def notifyMe(message, channel):
    try:
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        data = message
        response = requests.post(f'https://thejagstudio-ntfy.hf.space/{channel}', headers=headers, data=data)
        print(response.text)
    except Exception as e:
        print(f"Error notifying: {e}")
    return



class SearchProductsView(APIView):
    def get(self, request):
        """
        Search products based on query parameters.
        """
        query = request.GET.get("query", "")
        search_parameters = {"q": query, "query_by": "productName,sku,upc"}
        try:
            data = client.collections["101"].documents.search(search_parameters)
            return JsonResponse(data["hits"], safe=False)
        except typesense.exceptions.ObjectNotFound:
            notifyMe("Search Error: Typesense collection not found.", "101-error")
            return JsonResponse({"error": "Typesense collection not found."}, status=404)

class SyncSalesgentTokenView(APIView):
    permission_classes = []

    def post(self, request):
        """
        Sync Salesgent token with the database.
        """
        username = request.data.get("username")
        password = request.data.get("password")
        # authenticate the user
        if not username or not password:
            return JsonResponse({"error": "Username and password are required.", "status": "failed"}, status=400)
        user = User.objects.filter(username=username).first()
        if not user or not user.check_password(password):
            return JsonResponse({"error": "Invalid username or password.", "status": "failed"}, status=401)

        entry = SalesgentToken.objects.first()
        if not entry:
            return JsonResponse({"error": "No Salesgent token found.", "status": "failed"}, status=404)
        refresh_token = entry.refreshToken
        headers = {
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
            "refreshToken": refresh_token,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Pragma": "no-cache",
            "Referer": "https://erp.101distributorsga.com/product",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "device-id": "07b17521-b821-41fd-beea-22679d5ef98f",
            "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }

        response = requests.post("https://erp.101distributorsga.com/api/refreshToken", headers=headers)
        data = response.json()["result"]
        entry.accessToken = data.get("access")
        entry.refreshToken = data.get("refresh")
        entry.save()
        return JsonResponse({"message": "Token synced successfully.", "status": "success"}, status=200)


class dataMaker(APIView):
    permission_classes = []

    def get(self, request):
        """
        Generate data for testing purposes by reading invoice line items from JSON files.
        """
        products  = Product.objects.all()
        # I need a mapping for these products in following columns
        # Product Category,Product Subcategory,Product Name,Product Description,Price,Cost,Barcode,Active,Attribute type,Attribute parent,Attribute 1,Attribute value 1,Image Url

        product_data = []
        master_products_cache = {p.productId: {
            "upc": p.upc,
            "singleUpc": p.singleUpc
        } for p in Product.objects.filter(masterProductId__isnull=True)}
        for product in products:
            print(product.productName)
            if "deleted" not in str(product.singleUpc).lower() and "deleted" not in str(product.upc).lower():
                deleted = False
                if product.masterProductId:
                    master_product = master_products_cache.get(product.masterProductId)
                    if master_product:
                        if "deleted" in str(master_product["upc"]).lower() or "deleted" in str(master_product["singleUpc"]).lower():
                            deleted = True

                if not deleted:
                    product_data.append({
                        "id": product.productId,
                        "Product Category": None,
                        "Product Subcategory": None,  # No direct subcategory field in Product model
                        "Product Name": product.productName,
                        "Product Description": product.shortDescription if product.shortDescription else product.fullDescription,
                        "Price": float(product.standardPrice) if product.standardPrice is not None else None,
                        "Cost": float(product.costPrice) if product.costPrice is not None else None,
                        "Barcode": product.singleUpc if product.masterProductId else product.upc,
                        "Master Product Barcode": master_product["upc"] if product.masterProductId and master_product else None,
                        "Active": product.active,
                        "Attribute type": "Child" if product.masterProductId else "Parent",
                        "Attribute parent": None,  # No direct attribute_parent field
                        "Attribute 1": None,      # No direct attribute_1 field
                        "Attribute value 1": None, # No direct attribute_value_1 field
                        "Image Url": product.imageUrl,
                    })
        # Convert to csv format
        import pandas as pd
        df = pd.DataFrame(product_data)
        csv_file_path = 'product_data.csv'
        df.to_csv(csv_file_path, index=False)
        return JsonResponse({"message": "Successfully done"})


class vacuum_sqlite_database(APIView):
    permission_classes = []

    def get(self, request):
        """
        Runs the SQLite VACUUM command to reclaim unused space and optimize the database file size.
        """
        print("Starting SQLite VACUUM operation...")
        try:
            with connection.cursor() as cursor:
                cursor.execute("VACUUM;")
            print("SQLite VACUUM completed successfully.")
            return JsonResponse({"message": "SQLite VACUUM completed successfully."})
        except Exception as e:
            print(f"Error during SQLite VACUUM: {e}")
            return JsonResponse({"error": str(e)}, status=500)


class ChatWithAIAgentView(APIView):
    permission_classes = []  # Adjust as needed (e.g., [IsAuthenticated])

    @csrf_exempt  # For demonstration; use proper CSRF protection in production
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        try:
            data = json.loads(request.body)
            user_query = data.get("query")

            if not user_query:
                return Response({"error": "No query provided"}, status=400)

            agent_response = ai_agent.query_database(user_query)
            return Response({"response": agent_response})

        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=500)


class AIReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Handle GET requests for AI reports.
        """
        reportName = request.GET.get("reportName", None)
        if not reportName:
            return Response({"error": "reportName parameter is required"}, status=400)
        try:
            report_data = AIReport.objects.filter(reportName=reportName).first().htmlContent
            return Response({"report": report_data})
        except AIReport.DoesNotExist:
            return Response({"error": "Report not found"}, status=404)
        except Exception as e:
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=500)

    def post(self, request):
        """
        Handle POST requests to create or update AI reports.
        """
        from .ai_agent.researchAgent import Orchestrator
        from django.http import StreamingHttpResponse
        import json


        def stream_response():
            try:
                report_name = request.data.get("reportName")
                theme = request.data.get("theme", "indigo")
                if not report_name:
                    yield json.dumps({"error": "reportName is required"}) + "|||"
                    return

                orchestrator = Orchestrator(theme)
                final_report = None

                for status_update in orchestrator.run():
                    if isinstance(status_update, dict):
                        if "finalReport" in status_update:
                            final_report = status_update["finalReport"]
                        yield json.dumps(status_update) + "|||"

                if final_report:
                    AIReport.objects.update_or_create(reportName=report_name, defaults={"htmlContent": final_report})
                    yield json.dumps({"message": "Report generation completed", "report": final_report}) + "|||"

            except Exception as e:
                notifyMe(f"Error generating report: {str(e)}", "101-error")
                yield json.dumps({"error": f"An unexpected error occurred: {str(e)}"}) + "|||"

        return StreamingHttpResponse(streaming_content=stream_response(), content_type="application/json")



# ===========================================================================================================
