import os
import time
from django.http import StreamingHttpResponse
from django.shortcuts import render
from django.views import View
from django.urls import path
import json
from . import views
from api.models import SalesgentToken
import requests
import io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
import zipfile
from django.http import FileResponse


# Create your views here.
class InvoicesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        website = request.GET.get("website", "101GA")
        idToken = 2 if website == "Rivercity" else 1
        url = "https://erp.rivercitywholesale.com" if website == "Rivercity" else "https://erp.101distributorsga.com"
        token = SalesgentToken.objects.filter(id=idToken).first()
        page = request.GET.get("page", 0)
        size = request.GET.get("size", 20)
        startDate = request.GET.get("startDate", None)
        endDate = request.GET.get("endDate", None)
        headers = {
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
            "Authorization": f"Bearer {token.accessToken}" if token else "",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Pragma": "no-cache",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }
        url = f"{url}/api/order/list?storeIds=1,2,3,4,5&page=" + str(page) + "&size=" + str(size) + "&showEmployeeSpecificData=false"
        if startDate and endDate:
            url += f"&startDate={startDate}+00:00:00&endDate={endDate}+23:59:59"
        response = requests.get(
            url,
            headers=headers,
        )
        return Response(response.json(), status=http_status.HTTP_200_OK)


def download_pdf(url, save_path):
    """Downloads a PDF from a given URL and saves it to a local path.
    Returns True only if the downloaded content is actually a valid PDF."""
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")

        # Check if the response is actually a PDF
        if "application/pdf" not in content_type and not response.content[:5] == b"%PDF-":
            return False

        if len(response.content) < 100:
            return False

        file_path = os.path.join("./media/pdf/original/", save_path)
        with open(file_path, "wb") as f:
            f.write(response.content)

        # Validate that pypdf can actually read it before returning success
        try:
            PdfReader(file_path)
        except Exception as pdf_err:
            os.remove(file_path)
            return False

        return True
    except requests.exceptions.RequestException as e:
        print(f"Error downloading PDF: {e}")
        return False


def create_paid_stamp(info_lines=None):
    """
    Creates a PDF in memory containing a rotated, transparent "PAID" stamp and extra info.
    """
    if info_lines is None:
        info_lines = [("CK#NO:", "N/A"), ("AMOUNT", "N/A"), ("DATE", "N/A"), ("BY", "N/A")]

    packet = io.BytesIO()
    # Create a new PDF with ReportLab
    can = canvas.Canvas(packet, pagesize=letter)

    # --- Stamp Customization ---
    stamp_text = "PAID"
    x_position = 260  # Horizontal position from left edge
    y_position = 710  # Vertical position from bottom edge
    rotation = 0  # Angle of rotation
    font_size = 30
    opacity = 0.8  # 0.0 (transparent) to 1.0 (opaque)

    # Extra info
    info_font_size = 10
    info_gap = 12  # vertical gap between lines

    # -------------------------

    can.saveState()
    # Move the origin to the desired stamp location
    can.translate(x_position, y_position)
    # Rotate the coordinate system
    can.rotate(rotation)

    # Set font, size, and color with transparency for "PAID"
    can.setFont("Helvetica-Bold", font_size)
    can.setFillColor(colors.red, alpha=opacity)
    can.drawCentredString(0, 0, stamp_text)

    # Draw extra info below "PAID"
    can.setFont("Helvetica-Bold", info_font_size)
    info_x_offset = font_size + 5  # space to the right of "PAID"
    for i, (label, value) in enumerate(info_lines):
        # Draw label in red
        can.setFillColor(colors.red, alpha=opacity)
        can.drawString(-info_x_offset, -(i + 1.5) * info_gap, label)
        # Draw value in black
        can.setFillColor(colors.black, alpha=opacity)
        label_width = can.stringWidth(label, "Helvetica-Bold", info_font_size)
        can.drawString(-info_x_offset + label_width + 5, -(i + 1.5) * info_gap, value)
    can.restoreState()

    can.save()

    # Move to the beginning of the BytesIO buffer
    packet.seek(0)
    return packet


def add_stamp_to_pdf(original_pdf_path, stamped_pdf_path, info_lines=None,paymentModeName="other"):
    """
    Overlays the "PAID" stamp onto the first page of the original PDF.
    """
    # print(f"Stamping {original_pdf_path}...")
    try:
        # Create the stamp PDF in memory
        stamp_data = create_paid_stamp(info_lines)
        stamp_pdf = PdfReader(stamp_data)
        stamp_page = stamp_pdf.pages[0]

        # Open the original PDF to be stamped
        original_pdf = PdfReader("./media/pdf/original/" + original_pdf_path)
        writer = PdfWriter()

        first_page = original_pdf.pages[0]

        first_page.merge_page(stamp_page)

        writer.add_page(first_page)

        if len(original_pdf.pages) > 1:
            for page_num in range(1, len(original_pdf.pages)):
                writer.add_page(original_pdf.pages[page_num])

        # create directory ./media/pdf/{paymentModeName}/ if not exists
        if not os.path.exists(f"./media/pdf/{paymentModeName}/"):
            os.makedirs(f"./media/pdf/{paymentModeName}/")

        with open(f"./media/pdf/{paymentModeName}/" + stamped_pdf_path, "wb") as f:
            writer.write(f)

        # remove the original file if needed
        os.remove(f"./media/pdf/original/{original_pdf_path}")

        # print(f"Successfully created stamped PDF: {stamped_pdf_path}")

    except Exception as e:
        print(f"An error occurred during the stamping process: {e}")
        # remove the original file if needed
        if os.path.exists(f"./media/pdf/original/{original_pdf_path}"):
            os.remove(f"./media/pdf/original/{original_pdf_path}")
        raise e


def _build_pdf_urls(entry, token, urlMain):
    """
    Build a prioritized list of PDF download URLs to try for a payment entry.
    Returns list of (url, description) tuples.
    """
    invoiceId = entry.get("orderId", None)
    parentPaymentId = entry.get("parentPaymentId", None)
    customerId = entry.get("customerId", None)
    date = entry.get("paymentInsertedTimestamp", None)
    accessToken = token.accessToken if token else ""

    urls = []

    # 1. If we have a specific invoice, try the invoice PDF
    if invoiceId:
        urls.append((
            f"{urlMain}/services/pdf/sales-order/invoice/{invoiceId}?token={accessToken}&zone=America%2FNew_York&storeIdList=1%2C2&defaultStoreId=1&showSkuOnSalePage=false",
            "single invoice PDF"
        ))

    # 2. If we have a parentPaymentId, try the payment invoice PDF
    if parentPaymentId:
        urls.append((
            f"{urlMain}/services/pdf/payment/invoice/{parentPaymentId}?type=customer&token={accessToken}&zone=America%2FNew_York&storeIdList=1%2C2&defaultStoreId=1",
            "payment invoice PDF"
        ))

    # 3. Try the customer statement PDF as fallback
    if customerId and date:
        urls.append((
            f"{urlMain}/services/pdf/cusomter/statement?startDate={date}&endDate={date}&isAccrual=true&customerIds={customerId}&point=erp&token={accessToken}&zone=America/New_York&storeIdList=1,2&defaultStoreId=1",
            "customer statement PDF"
        ))

    # 4. Try the customer transaction PDF as last resort
    if customerId and date:
        urls.append((
            f"{urlMain}/services/pdf/customer/transaction?startDate={date}&endDate={date}&customerIds={customerId}&customer=true&token={accessToken}&zone=America/New_York&storeIdList=1,2&defaultStoreId=1",
            "customer transaction PDF"
        ))

    return urls


def _process_payment_entry(entry, token, urlMain, count, total):
    """
    Processes a single payment entry and returns the JSON string to yield.

    Tries multiple PDF download URLs in priority order. If the primary URL fails
    (non-PDF response, corrupt file, network error), it falls back to alternative
    endpoints before giving up.

    Raises an exception on retryable failures so the caller can retry.
    """
    transactionId = entry.get("transactionId", None)
    invoiceId = entry.get("orderId", None)
    paymentAmount = entry.get("paymentAmount", None)
    date = entry.get("paymentInsertedTimestamp", None)
    parentPaymentId = entry.get("parentPaymentId", None)
    customerId = entry.get("customerId", None)
    paymentModeName = entry.get("paymentModeName", "other")

    # Skip if no transaction ID at all
    if not transactionId:
        msg = f"Skipping payment with no transaction ID for customer: {customerId} Parent Payment ID: {parentPaymentId}"
        return json.dumps({"error": msg}, indent=4)

    # If parentPaymentId exists, fetch child payments to determine the approach
    if parentPaymentId:
        headers = {
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9",
            "Authorization": ("Bearer " + token.accessToken if token else ""),
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Pragma": "no-cache",
            "Referer": f"{urlMain}/sales/paymentReceived",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }
        response = requests.get(
            f"{urlMain}/api/customer/paymentDetails?storeIds=1,2,3,4,5&parentPaymentId={parentPaymentId}&page=0&size=999",
            headers=headers,
            timeout=30,
        )
        if response.json().get("hasError", False):
            return json.dumps({"error": "Failed to fetch child payment details"}, indent=4)

        childPayments = response.json()["result"]["content"]

        # If single child, update invoiceId from child
        if len(childPayments) == 1:
            child_orderId = childPayments[0].get("orderId", None)
            if child_orderId:
                invoiceId = child_orderId

    # Build prioritized list of PDF URLs to try
    # Override orderId in entry temporarily for URL building
    entry_for_urls = {**entry, "orderId": invoiceId}
    pdf_urls = _build_pdf_urls(entry_for_urls, token, urlMain)

    if not pdf_urls:
        msg = f"No PDF URLs could be built for customer: {customerId}, parentPaymentId: {parentPaymentId}"
        return json.dumps({"error": msg}, indent=4)

    invoiceName = f"{parentPaymentId}-{customerId}-{date.split(' ')[0] if date else 'nodate'}"
    original_file = f"{invoiceName}_original.pdf"
    stamped_file = f"{invoiceName}_with_paid_stamp.pdf"

    # Try each URL in priority order until one works
    downloaded = False
    for url, url_desc in pdf_urls:
        if download_pdf(url, original_file):
            downloaded = True
            break

    if not downloaded:
        tried = ", ".join([desc for _, desc in pdf_urls])
        msg = f"All PDF download attempts failed for customer: {customerId}, Parent Payment ID: {parentPaymentId}. Tried: {tried}"
        return json.dumps({"error": msg}, indent=4)

    # Stamp the PDF
    checkLabel = (
        "CK#NO:" if transactionId and "CK#" in transactionId
        else ("CC#NO:" if transactionId and "CC" in transactionId
              else ("ACH#NO:" if transactionId and "ACH" in transactionId
                    else "TX#NO:"))
    )
    info_lines = [
        (checkLabel, str(transactionId) if transactionId else "N/A"),
        ("AMOUNT", str(paymentAmount) if paymentAmount else "N/A"),
        ("DATE", str(date) if date else "N/A"),
        ("BY", entry.get("createdByName", "N/A")),
    ]
    add_stamp_to_pdf(original_file, stamped_file, info_lines, paymentModeName)
    return json.dumps({
        "status": "processed",
        "customerId": customerId,
        "transactionId": transactionId,
        "data": entry,
        "percent": round((count / total) * 100)
    }, indent=4)


def stampMaker(data, token, urlMain, username):
    print(f"Processing {len(data)} payments for stamping...")
    total = len(data)
    count = 1
    max_retries = 3
    for entry in data:
        customerId = entry.get("customerId", None)
        parentPaymentId = entry.get("parentPaymentId", None)
        for attempt in range(1, max_retries + 1):
            try:
                yield _process_payment_entry(entry, token, urlMain, count, total)
                break
            except Exception as e:
                import sys
                exc_type, exc_obj, exc_tb = sys.exc_info()
                line_number = exc_tb.tb_lineno
                print(f"Error occurred at line {line_number} (attempt {attempt}/{max_retries}): {str(e)}")
                if attempt < max_retries:
                    print(f"Retrying payment for customer: {customerId} and Parent Payment ID: {parentPaymentId} (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(2)
                    continue
                yield json.dumps({"error": f"An error occurred while processing payment for customer: {customerId} and Parent Payment ID: {parentPaymentId} after {max_retries} attempts. Error: {str(e)}"}, indent=4)
        count += 1

    # zip all stamped files from ./media/pdf/ and save it to ./media/zip/stamped_invoices.zip
    # and remove all stamped files from ./media/pdf/
    # and send the zip file as response
    zip_filename = f"stamped_invoices_{username}.zip"
    zip_filepath = f"./media/zip/{zip_filename}"

    with zipfile.ZipFile(zip_filepath, "w") as zipf:
        for root, dirs, files in os.walk("./media/pdf/"):
            for file in files:
                if file.endswith("_with_paid_stamp.pdf"):
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, "./media/pdf/")
                    zipf.write(file_path, arcname=arcname)
                    os.remove(file_path)
    yield json.dumps({"zipUrl": f"/media/zip/{zip_filename}"}, indent=4)


def _process_invoice_by_id(invoice_id, token, urlMain, count, total):
    """
    Download and stamp a single invoice PDF by invoice/order ID.
    Used when the user provides explicit invoice IDs (bypasses payment-date filters).
    """
    accessToken = token.accessToken if token else ""
    headers = {
        "Accept": "application/json, text/plain",
        "Authorization": f"Bearer {accessToken}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    }

    customer_name = None
    customer_id = None
    company = None
    amount = None
    date = None
    created_by = "N/A"

    try:
        order_resp = requests.get(
            f"{urlMain}/api/order/{invoice_id}/withCustomer?storeIds=1,2,3,4,5",
            headers=headers,
            timeout=30,
        )
        order_json = order_resp.json()
        if not order_json.get("hasError", True):
            result = order_json.get("result") or {}
            order = result.get("order") or result
            customer = result.get("customer") or {}
            customer_name = (
                customer.get("name")
                or customer.get("customerName")
                or order.get("customerName")
            )
            customer_id = customer.get("id") or order.get("customerId")
            company = customer.get("company") or customer.get("companyName") or order.get("companyName")
            amount = order.get("totalAmount") or order.get("amount") or order.get("orderTotal")
            date = order.get("insertedTimestamp") or order.get("orderDate") or order.get("dueDate")
            created_by = order.get("createdByName") or order.get("salesPersonName") or "N/A"
    except Exception as e:
        print(f"Could not fetch order metadata for invoice {invoice_id}: {e}")

    pdf_url = (
        f"{urlMain}/services/pdf/sales-order/invoice/{invoice_id}"
        f"?token={accessToken}&zone=America%2FNew_York&storeIdList=1%2C2&defaultStoreId=1&showSkuOnSalePage=false"
    )
    invoice_name = f"invoice-{invoice_id}"
    original_file = f"{invoice_name}_original.pdf"
    stamped_file = f"{invoice_name}_with_paid_stamp.pdf"

    if not download_pdf(pdf_url, original_file):
        return json.dumps({"error": f"Failed to download PDF for invoice ID: {invoice_id}"}, indent=4)

    date_str = str(date).split(" ")[0] if date else "N/A"
    info_lines = [
        ("INV#:", str(invoice_id)),
        ("AMOUNT", str(amount) if amount is not None else "N/A"),
        ("DATE", date_str),
        ("BY", str(created_by) if created_by else "N/A"),
    ]
    add_stamp_to_pdf(original_file, stamped_file, info_lines, "invoice-id")

    return json.dumps({
        "status": "processed",
        "customerId": customer_id,
        "transactionId": f"INV-{invoice_id}",
        "data": {
            "customerName": customer_name,
            "company": company,
            "orderId": invoice_id,
            "paymentAmount": float(amount) if isinstance(amount, (int, float)) else None,
        },
        "percent": round((count / total) * 100),
    }, indent=4)


def stampMakerByInvoiceIds(invoice_ids, token, urlMain, username):
    print(f"Processing {len(invoice_ids)} invoices by ID for stamping...")
    total = len(invoice_ids)
    count = 1
    max_retries = 3
    for invoice_id in invoice_ids:
        for attempt in range(1, max_retries + 1):
            try:
                yield _process_invoice_by_id(invoice_id, token, urlMain, count, total)
                break
            except Exception as e:
                import sys
                exc_type, exc_obj, exc_tb = sys.exc_info()
                line_number = exc_tb.tb_lineno
                print(f"Error at line {line_number} for invoice {invoice_id} (attempt {attempt}/{max_retries}): {str(e)}")
                if attempt < max_retries:
                    time.sleep(2)
                    continue
                yield json.dumps({
                    "error": f"Failed to process invoice ID {invoice_id} after {max_retries} attempts. Error: {str(e)}"
                }, indent=4)
        count += 1

    zip_filename = f"stamped_invoices_{username}.zip"
    zip_filepath = f"./media/zip/{zip_filename}"

    with zipfile.ZipFile(zip_filepath, "w") as zipf:
        for root, dirs, files in os.walk("./media/pdf/"):
            for file in files:
                if file.endswith("_with_paid_stamp.pdf"):
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, "./media/pdf/")
                    zipf.write(file_path, arcname=arcname)
                    os.remove(file_path)
    yield json.dumps({"zipUrl": f"/media/zip/{zip_filename}"}, indent=4)


def _fetch_invoice_ids_from_order_list(url_main, token, start_date, end_date, customer_name=None, company_name=None, dba_name=None):
    """
    Resolve invoice IDs via /api/order/list — the ERP endpoint that actually supports
    customerName / companyName / dbaName filters (paymentDetails does not).
    """
    from urllib.parse import quote_plus

    headers = {
        "Accept": "application/json, text/plain",
        "Authorization": f"Bearer {token.accessToken}" if token else "",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-mobile": "?0",
    }

    invoice_ids = []
    seen = set()
    page = 0
    page_size = 500
    max_pages = 200  # safety cap

    while page < max_pages:
        list_url = (
            f"{url_main}/api/order/list?storeIds=1,2,3,4,5"
            f"&page={page}&size={page_size}&showEmployeeSpecificData=false"
            f"&startDate={start_date}+00:00:00&endDate={end_date}+23:59:59"
        )
        if customer_name:
            list_url += f"&customerName={quote_plus(customer_name)}"
        if company_name:
            list_url += f"&companyName={quote_plus(company_name)}"
        if dba_name:
            list_url += f"&dbaName={quote_plus(dba_name)}"

        response = requests.get(list_url, headers=headers, timeout=60)
        payload = response.json()
        if payload.get("hasError", False):
            print("Error fetching order list for name filters:", payload)
            break

        result = payload.get("result") or {}
        content = result.get("content") or []
        for order in content:
            order_id = order.get("id")
            if order_id is None:
                continue
            order_id_str = str(order_id)
            if order_id_str not in seen:
                seen.add(order_id_str)
                invoice_ids.append(order_id_str)

        total_pages = result.get("totalPages")
        if total_pages is not None:
            if page + 1 >= int(total_pages):
                break
        elif len(content) < page_size:
            break

        page += 1

    return invoice_ids


class StampInvoiceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        website = request.GET.get("website", "101GA")
        idToken = 2 if website == "Rivercity" else 1
        url = "https://erp.rivercitywholesale.com" if website == "Rivercity" else "https://erp.101distributorsga.com"
        token = SalesgentToken.objects.filter(id=idToken).first()
        startDate = request.GET.get("startDate", None)
        endDate = request.GET.get("endDate", None)
        username = request.GET.get("username", "unknown")
        customerName = (request.GET.get("customerName") or "").strip()
        companyName = (request.GET.get("companyName") or "").strip()
        dbaName = (request.GET.get("dbaName") or "").strip()
        invoice_ids_raw = (request.GET.get("invoiceIds") or "").strip()

        if not token:
            return Response({"error": "Authentication token not found"}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

        # create folder ./media/pdf/ if not exists
        if not os.path.exists("./media/pdf/"):
            os.makedirs("./media/pdf/")
        # create folder ./media/pdf/original/ if not exists
        if not os.path.exists("./media/pdf/original/"):
            os.makedirs("./media/pdf/original/")
        # create folder ./media/zip/ if not exists
        if not os.path.exists("./media/zip/"):
            os.makedirs("./media/zip/")

        # Invoice ID mode: exclusive — ignore date/name filters, loop IDs directly
        if invoice_ids_raw:
            invoice_ids = []
            seen = set()
            for part in invoice_ids_raw.replace("\n", ",").replace(";", ",").split(","):
                invoice_id = part.strip()
                if invoice_id and invoice_id not in seen:
                    seen.add(invoice_id)
                    invoice_ids.append(invoice_id)
            if not invoice_ids:
                return Response({"error": "No valid invoice IDs provided"}, status=http_status.HTTP_400_BAD_REQUEST)

            streaming_response = StreamingHttpResponse(
                stampMakerByInvoiceIds(invoice_ids, token, url, username),
                content_type="text/event-stream",
            )
            streaming_response["Cache-Control"] = "no-cache"
            return streaming_response

        if not startDate or not endDate:
            return Response({"error": "startDate and endDate are required when invoiceIds are not provided"}, status=http_status.HTTP_400_BAD_REQUEST)

        # Name filters (customer / company / DBA) — use order/list (same API as Invoice List).
        # paymentDetails has no DBA field and ignores these query params.
        if customerName or companyName or dbaName:
            invoice_ids = _fetch_invoice_ids_from_order_list(
                url,
                token,
                startDate,
                endDate,
                customer_name=customerName or None,
                company_name=companyName or None,
                dba_name=dbaName or None,
            )
            print(
                f"Name filters via order/list — customerName={customerName!r}, companyName={companyName!r}, "
                f"dbaName={dbaName!r}; matched {len(invoice_ids)} invoice(s)"
            )
            streaming_response = StreamingHttpResponse(
                stampMakerByInvoiceIds(invoice_ids, token, url, username),
                content_type="text/event-stream",
            )
            streaming_response["Cache-Control"] = "no-cache"
            return streaming_response

        headers = {
            "sec-ch-ua-platform": '"Windows"',
            "Authorization": f"Bearer {token.accessToken}" if token else "",
            "Referer": f"{url}/sales/paymentReceived",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain",
            "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
            "sec-ch-ua-mobile": "?0",
        }

        # No name filters — stamp from payment details in the date range (original behavior)
        payment_details_url = (
            f"{url}/api/customer/paymentDetails?storeIds=1,2,3,4,5"
            f"&startDate={startDate}+00:00:00&endDate={endDate}+23:59:59&size=100000"
        )

        response = requests.get(
            payment_details_url,
            headers=headers,
        )
        if response.json().get("hasError", False):
            print("Error fetching payment details:", response.json())
            return Response({"error": "Failed to fetch payment details"}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        data = response.json()["result"]["content"]

        streaming_response = StreamingHttpResponse(stampMaker(data, token, url, username), content_type="text/event-stream")
        streaming_response["Cache-Control"] = "no-cache"
        return streaming_response

class DownloadStampedInvoicesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.GET.get("username", "unknown")
        zip_filename = f"stamped_invoices_{username}.zip"
        zip_filepath = f"./media/zip/{zip_filename}"
        if os.path.exists(zip_filepath):
            file_response = FileResponse(open(zip_filepath, "rb"), as_attachment=True, filename=zip_filename, content_type="application/zip")
            return file_response
        else:
            return Response({"error": "No stamped invoices available for download."}, status=http_status.HTTP_404_NOT_FOUND)
