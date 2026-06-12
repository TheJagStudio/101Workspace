from collections import defaultdict
import typesense
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import Product, SalesgentToken, AIReport,Category,Invoice,InvoiceLineItem,Customer
from .serializers import (
    ProductSerializer, CategorySerializer, VendorSerializer, CustomerSerializer,
    InvoiceSerializer, SalesgentTokenSerializer,
    InventorySummaryProductRowSerializer, InventorySummaryCategoryRowSerializer,
    InventorySummaryTotalSerializer,
    InventoryReplenishmentProductRowSerializer, InventoryReplenishmentCategoryRowSerializer,
    DustyInventoryProductRowSerializer, DustyInventoryTotalSerializer,
    ProductHistoryResponseSerializer, POMakerProductSerializer,
    POListItemSerializer, POExportItemSerializer, POLineItemResponseSerializer,
    HotProductSerializer, ClearanceMonthlyBreakdownSerializer,
    ParLevelCategorySerializer, ParLevelProductSerializer,
    CategoryTreeNodeSerializer, VendorByCategorySerializer,
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
import json
from django.db import transaction
from api.ai_agent.agent import DjangoAIAgent
import requests
from django.contrib.auth.models import User
from .ai_agent.researchAgent import Orchestrator
from django.http import StreamingHttpResponse, JsonResponse
import json
from django.utils import timezone
import concurrent.futures
from datetime import timedelta
import os
import pandas as pd
from io import BytesIO
from django.http import HttpResponse
from django.shortcuts import redirect
from rest_framework import status

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
            "Content-Type": "application/x-www-form-urlencoded",
        }
        data = message
        response = requests.post(f"https://thejagstudio-ntfy.hf.space/{channel}", headers=headers, data=data)
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
            return Response(data["hits"], status=status.HTTP_200_OK)
        except typesense.exceptions.ObjectNotFound:
            notifyMe("Search Error: Typesense collection not found.", "101-error")
            return Response({"error": "Typesense collection not found."}, status=status.HTTP_404_NOT_FOUND)


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
            return Response({"error": "Username and password are required.", "status": "failed"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(username=username).first()
        if not user or not user.check_password(password):
            return Response({"error": "Invalid username or password.", "status": "failed"}, status=status.HTTP_401_UNAUTHORIZED)

        entry = SalesgentToken.objects.filter(id=1).first()
        if not entry:
            return Response({"error": "No Salesgent token found.", "status": "failed"}, status=status.HTTP_404_NOT_FOUND)
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

        entry2 = SalesgentToken.objects.filter(id=2).first()
        if not entry2:
            return Response({"error": "No Salesgent token found.", "status": "failed"}, status=status.HTTP_404_NOT_FOUND)
        refresh_token = entry2.refreshToken
        headers = {
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
            "refreshToken": refresh_token,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Pragma": "no-cache",
            "Referer": "https://erp.rivercitywholesale.com/product",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "device-id": "07b17521-b821-41fd-beea-22679d5ef98f",
            "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }

        response = requests.post("https://erp.rivercitywholesale.com/api/refreshToken", headers=headers)
        data = response.json()["result"]
        entry2.accessToken = data.get("access")
        entry2.refreshToken = data.get("refresh")
        entry2.save()
        return Response({"message": "Token synced successfully.", "status": "success"}, status=status.HTTP_200_OK)



def get_all_descendant_pks(start_pk, category_map):
    # (function code from above)
    pks_to_process = [start_pk]
    all_descendants = {start_pk}
    while pks_to_process:
        parent_pk = pks_to_process.pop()
        children = category_map.get(parent_pk, [])
        for child_pk in children:
            if child_pk not in all_descendants:
                all_descendants.add(child_pk)
                pks_to_process.append(child_pk)
    return list(all_descendants)

class dataMaker(APIView):
    permission_classes = []

    def get(self, request):
        token = SalesgentToken.objects.first()
        customer1 = Customer.objects.filter(id=66).first()
        customer2 = Customer.objects.filter(id=1258).first()
        invoices1 = Invoice.objects.filter(customerId=customer1).all()
        invoices2 = Invoice.objects.filter(customerId=customer2).all()
        invoices = invoices1 | invoices2
        # create /media/pdf/66 and /media/pdf/1258 directories if they don't exist
        os.makedirs("./media/pdf/", exist_ok=True)
        os.makedirs(f"./media/pdf/{customer1.id}", exist_ok=True)
        os.makedirs(f"./media/pdf/{customer2.id}", exist_ok=True)

        for invoice in invoices:
            url = "https://erp.101distributorsga.com/services/pdf/sales-order/invoice/" + str(invoice.id) + "?token="+token.accessToken+"&zone=America%2FNew_York&storeIdList=1%2C2&defaultStoreId=1&showSkuOnSalePage=false"
            response = requests.get(url)
            with open(f"./media/pdf/{invoice.customerId.id}/{invoice.id}.pdf", "wb") as f:
                f.write(response.content)
            print(f"Saved invoice {invoice.id} for customer {invoice.customerId.id}")
        return Response({
            "status": "Completed"
        })

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
            return Response({"message": "SQLite VACUUM completed successfully."})
        except Exception as e:
            print(f"Error during SQLite VACUUM: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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

def notifyMe(message, channel):
    try:
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        data = message
        response = requests.post(f'https://harismruti-ntfy-gl7swe-3ac893-172-191-145-54.sslip.io/{channel}', headers=headers, data=data)
        print(response.text)
    except Exception as e:
        print(f"Error notifying: {e}")
    return

# Set to True to require business_license, fein_license, and driving_license documents
REQUIRE_DOCUMENTS = False


class SummerSaleUserRegistration(APIView):
    """Customer registration for the 101 Mega Summer Trade Show.

    Implements the full ERP registration flow:
      1. Validate form data and uploaded files
      2. Create customer via POST /api/customer
      3. Upload each document via POST /api/attachment (multipart)
      4. Verify uploads via GET /api/attachment/fieldId/651/recordId/{id}/moduleId/4
      5. Send notification and redirect to success/error page
    """

    permission_classes = []

    STATE_ID_TO_NAME = {
        "1": "Alabama", "2": "Alaska", "3": "Arizona", "4": "Arkansas",
        "5": "California", "6": "Colorado", "7": "Connecticut", "8": "Delaware",
        "9": "District Of Columbia", "10": "Florida", "11": "Georgia",
        "12": "Hawaii", "13": "Idaho", "14": "Illinois", "15": "Indiana",
        "16": "Iowa", "17": "Kansas", "18": "Kentucky", "19": "Louisiana",
        "20": "Maine", "21": "Maryland", "22": "Massachusetts", "23": "Michigan",
        "24": "Minnesota", "25": "Mississippi", "26": "Missouri", "27": "Montana",
        "28": "Nebraska", "29": "Nevada", "30": "New Hampshire",
        "31": "New Jersey", "32": "New Mexico", "33": "New York",
        "34": "North Carolina", "35": "North Dakota", "36": "Ohio",
        "37": "Oklahoma", "38": "Oregon", "39": "Pennsylvania",
        "40": "Rhode Island", "41": "South Carolina", "42": "South Dakota",
        "43": "Tennessee", "44": "Texas", "45": "Utah", "46": "Vermont",
        "47": "Virginia", "48": "Washington", "49": "West Virginia",
        "50": "Wisconsin", "51": "Wyoming",
    }

    DOC_TYPE_MAP = {
        "ach_form_document": 60,
        "business_license_document": 55,
        "credit_card_auth_document": 61,
        "driving_license_document": 58,
        "fein_license_document": 56,
        "hemp_license_document": 220,
        "sales_tax_certificate_document": 57,
        "tobacco_license_document": 54,
        "void_check_document": 59,
    }

    REDIRECT_BASE = "https://101distributors.com/mega-summer-trade-show-2026-customer-registration/"

    ERP_BASE = "https://erp.101distributorsga.com"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_api_headers(self):
        """Build ERP request headers using the stored Salesgent access token."""
        token_obj = SalesgentToken.objects.first()
        if not token_obj:
            raise ValueError("Salesgent token not found in the database")
        return {
            "Authorization": f"Bearer {token_obj.accessToken}",
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Origin": self.ERP_BASE,
            "Pragma": "no-cache",
            "Referer": f"{self.ERP_BASE}/customer/add",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/149.0.0.0 Safari/537.36"
            ),
            "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }

    @staticmethod
    def _clean_phone(raw_phone):
        """Strip everything except digits and return an int."""
        digits = "".join(c for c in str(raw_phone) if c.isdigit())
        return int(digits) if digits else 0

    def _redirect(self, message, success=False, request=None):
        """Shorthand for building the redirect response.

        If the request is AJAX (sent with X-Requested-With header), return
        a JSON response instead of a 302 redirect to avoid CORS issues.
        """
        status_param = "success" if success else "error"
        if request and request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return JsonResponse({
                "status": status_param,
                "message": message,
            })
        return redirect(
            f"{self.REDIRECT_BASE}?message={message}&status={status_param}",
            status_code=status.HTTP_302_FOUND,
        )

    @staticmethod
    def _extract_erp_error(err):
        """Pull a readable message out of an HTTPError response."""
        try:
            body = err.response.json()
            err_node = body.get("error", "")
            if isinstance(err_node, dict):
                return err_node.get("message", "Backend error")
            if isinstance(err_node, str) and err_node:
                return err_node
            return body.get("message", f"API error ({err.response.status_code})")
        except (json.JSONDecodeError, AttributeError, ValueError):
            return f"HTTP {err.response.status_code}"

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def _validate(self, data, files):
        """Return a dict of field → error message. Empty dict means valid."""
        errors = {}

        required_fields = {
            "names[first_name]": "First name is required.",
            "names[last_name]": "Last name is required.",
            "email": "Email is required.",
            "phone": "Phone number is required.",
            "input_text": "Legal business name is required.",
            "input_text_1": "DBA name is required.",
            "dropdown": "Sales representative is required.",
            "address_1[address_line_1]": "Address is required.",
            "address_1[city]": "City is required.",
            "address_1[state]": "State is required.",
            "address_1[zip]": "Zip code is required.",
        }
        for field, msg in required_fields.items():
            if not str(data.get(field, "")).strip():
                errors[field] = msg

        email = str(data.get("email", ""))
        if email and "@" not in email:
            errors["email"] = "Enter a valid email address."

        if not data.get("terms-n-condition"):
            errors["terms-n-condition"] = "You must agree to the terms and conditions."

        if REQUIRE_DOCUMENTS:
            required_files = [
                "business_license_document",
                "fein_license_document",
                "driving_license_document",
            ]
            for f in required_files:
                if f not in files or not files[f]:
                    nice = f.replace("_", " ").title()
                    errors[f] = f"{nice} is required."

        for f in files:
            if hasattr(files[f], "size") and files[f].size == 0:
                errors[f] = "Uploaded file is empty."

        return errors

    # ------------------------------------------------------------------
    # Step 2 – Create customer in ERP
    # ------------------------------------------------------------------

    @staticmethod
    def _load_location_cache():
        """Load the pre-cached city/county data from data/erp_locations_cache.json."""
        cache_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "data", "erp_locations_cache.json"
        )
        if not os.path.exists(cache_path):
            print("[WARN] Location cache not found. Run: python api/generate_location_cache.py")
            return {}
        with open(cache_path, "r") as f:
            return json.load(f)

    @classmethod
    def _lookup_city(cls, state_id, city_name, location_cache):
        """Look up cityId from the local cache."""
        if not city_name:
            return None
        state_data = location_cache.get(str(state_id))
        if not state_data:
            return None
        city_lower = city_name.strip().lower()
        for city in state_data.get("cities", []):
            if city.get("name", "").strip().lower() == city_lower:
                return city.get("id")
        return None

    @classmethod
    def _lookup_county(cls, state_id, county_name, location_cache):
        """Look up countyId from the local cache."""
        if not county_name:
            return None
        state_data = location_cache.get(str(state_id))
        if not state_data:
            return None
        county_lower = county_name.strip().lower()
        for county in state_data.get("counties", []):
            if county.get("name", "").strip().lower() == county_lower:
                return county.get("id")
        return None

    def _build_customer_payload(self, data, city_id=None, county_id=None):
        """Build the customerDto payload documented in customerRegistrationAPIs.py."""
        state_id_str = str(data.get("address_1[state]", "")).strip()
        state_id = int(state_id_str) if state_id_str.isdigit() else 11
        state_name = self.STATE_ID_TO_NAME.get(state_id_str, "Georgia")

        dto = {
            # Core fields — order matches reference exactly
            "tier": 1,
            "paymentTermsId": 14,
            "taxable": 1,
            "active": True,
            "saveProductPrice": True,
            "signUpStoreId": 1,
            "countryCode": 1,
            # Address
            "customerStoreAddressList": [
                {
                    "countryId": 1,
                    "active": True,
                    "defaultAddress": True,
                    "billingAddress": True,
                    "shippingAddress": True,
                    "sameAsBillingAddress": True,
                    "address1": data.get("address_1[address_line_1]", ""),
                    "address2": data.get("address_1[address_line_2]", ""),
                    "stateId": state_id,
                    "state": state_name,
                    "zip": data.get("address_1[zip]", ""),
                    "id": None,
                }
            ],
            # Personal / company — always present
            "firstName": data.get("names[first_name]", "").strip(),
            "lastName": data.get("names[last_name]", "").strip(),
            "email": data.get("email", "").strip(),
            "phone": self._clean_phone(data.get("phone", "")),
            "company": data.get("input_text", "").strip(),
            "dbaName": data.get("input_text_1", "").strip(),
            "customerTypeId": 52,
            "notes": "Added in 101 Show 2026",
            "primarySalesRepresentativeId": (
                int(data["dropdown"]) if data.get("dropdown") else 0
            ),
            "createdBy": 20,
        }

        # Add cityId and countyId only if resolved
        if city_id is not None:
            dto["customerStoreAddressList"][0]["cityId"] = city_id
        if county_id is not None:
            dto["customerStoreAddressList"][0]["countyId"] = county_id

        # Only include optional fields when they have values (avoid empty-string
        # "Data violation" errors from the ERP).
        optional_fields = {
            "taxId": data.get("taxId", "").strip(),
            "feinNumber": data.get("input_text_4", "").strip(),
            "cigaretteId": data.get("input_text_2", "").strip(),
            "tobaccoId": data.get("input_text_3", "").strip(),
            "hempLicenseNumber": data.get("input_text_5", "").strip(),
            "voidCheckNumber": data.get("input_text_6", "").strip(),
            "drivingLicenseNumber": data.get("input_text_7", "").strip(),
        }
        for key, value in optional_fields.items():
            if value:
                dto[key] = value

        return {"customerDto": dto}

    def _create_customer(self, data, headers, city_id=None, county_id=None):
        """POST /api/customer and return the ERP response."""
        payload = self._build_customer_payload(data, city_id=city_id, county_id=county_id)
        resp = requests.post(
            f"{self.ERP_BASE}/api/customer",
            headers=headers,
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Step 3 – Upload documents
    # ------------------------------------------------------------------

    def _upload_document(self, customer_id, file_field_name, file_obj, headers):
        """POST /api/attachment with multipart/form-data for a single file."""
        doc_type_id = self.DOC_TYPE_MAP.get(file_field_name)
        if not doc_type_id:
            return {"status": "error", "message": f"Unknown document type: {file_field_name}"}

        attachment_meta = {
            "name": file_obj.name,
            "recordId": customer_id,
            "moduleId": 4,
            "fieldName": "customer_document",
            "fieldId": 651,
            "active": True,
            "documentTypeId": doc_type_id,
        }

        # Multipart headers – remove Content-Type so requests sets the boundary
        upload_headers = {k: v for k, v in headers.items() if k.lower() != "content-type"}

        files_payload = {
            "attachmentObj": (
                None,
                json.dumps(attachment_meta),
                "application/json",
            ),
            "file": (
                file_obj.name,
                file_obj.read(),
                file_obj.content_type or "application/octet-stream",
            ),
        }

        resp = requests.post(
            f"{self.ERP_BASE}/api/attachment",
            headers=upload_headers,
            files=files_payload,
            timeout=30,
        )
        resp.raise_for_status()
        return {"status": "success", "data": resp.json()}

    # ------------------------------------------------------------------
    # Step 4 – Verify documents
    # ------------------------------------------------------------------

    def _verify_documents(self, customer_id, headers):
        """GET /api/attachment/fieldId/651/recordId/{id}/moduleId/4."""
        resp = requests.get(
            f"{self.ERP_BASE}/api/attachment/fieldId/651/recordId/{customer_id}/moduleId/4",
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("result", [])

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def post(self, request):
        data = request.data
        files = request.FILES

        # Step 1 – Validate
        errors = self._validate(data, files)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # Step 2 – Create customer
        try:
            headers = self._get_api_headers()

            # Lookup cityId and countyId from cache before building payload
            state_id_str = str(data.get("address_1[state]", "")).strip()
            state_id = int(state_id_str) if state_id_str.isdigit() else 11
            city_name = data.get("address_1[city]", "").strip()
            location_cache = self._load_location_cache()
            city_id = self._lookup_city(state_id, city_name, location_cache)
            # County comes directly from the form dropdown (ERP county ID)
            county_raw = str(data.get("County_Dropdown", "")).strip()
            county_id = int(county_raw) if county_raw.isdigit() else None

            erp_response = self._create_customer(data, headers, city_id=city_id, county_id=county_id)
        except requests.exceptions.HTTPError as err:
            error_msg = self._extract_erp_error(err)
            notifyMe(
                f"Registration ERP error: {error_msg}\n"
                f"Name: {data.get('names[first_name]', '')} {data.get('names[last_name]', '')}\n"
                f"Email: {data.get('email', '')}\n"
                f"Phone: {data.get('phone', '')}",
                "101-error",
            )
            return self._redirect(f"ERP error: {error_msg}", request=request)
        except Exception as err:
            notifyMe(f"Registration unexpected error: {err}", "101-error")
            return self._redirect("An unexpected error occurred. Please try again.", request=request)

        customer_id = erp_response.get("result", {}).get("id")
        if not customer_id:
            return self._redirect(
                "Failed to create customer account. Please try again.",
                request=request,
            )

        # Step 3 – Upload documents
        upload_results = {}
        for file_key, file_obj in files.items():
            # Form sends "file_" prefix for some fields (FluentForm convention)
            field_name = file_key.replace("file_", "")
            if field_name in self.DOC_TYPE_MAP:
                try:
                    upload_results[field_name] = self._upload_document(
                        customer_id, field_name, file_obj, headers
                    )
                except Exception as e:
                    upload_results[field_name] = {
                        "status": "error",
                        "message": str(e),
                    }

        # Step 4 – Verify uploaded documents (best-effort, non-blocking)
        try:
            attached_docs = self._verify_documents(customer_id, headers)
        except Exception:
            attached_docs = []

        # Step 5 – Notify and redirect
        notifyMe(
            f"New customer registered at Trade Show:\n"
            f"{data.get('names[first_name]', '')} {data.get('names[last_name]', '')}\n"
            f"Email: {data.get('email', '')}\n"
            f"Phone: {data.get('phone', '')}\n"
            f"Company: {data.get('input_text', '')}\n"
            f"DBA: {data.get('input_text_1', '')}\n"
            f"City: {data.get('address_1[city]', '')}, "
            f"{self.STATE_ID_TO_NAME.get(data.get('address_1[state]', ''), '')}\n"
            f"Documents uploaded: {len(upload_results)}\n"
            f"Documents verified: {len(attached_docs)}\n"
            f"ERP Customer ID: {customer_id}",
            "101",
        )

        return self._redirect(
            "Your account has been created successfully. "
            "For activation, please contact the registration counter.",
            success=True,
            request=request,
        )