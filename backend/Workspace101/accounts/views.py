import os
from django.http import JsonResponse, StreamingHttpResponse
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
from rest_framework.permissions import IsAuthenticated


# Create your views here.
class InvoicesView(View):

    def get(self, request):
        token = SalesgentToken.objects.filter(id=1).first()
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
            "Referer": "https://erp.101distributorsga.com/sales",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }
        url = "https://erp.101distributorsga.com/api/order/list?storeIds=1,2&page=" + str(page) + "&size=" + str(size) + "&showEmployeeSpecificData=false"
        if startDate and endDate:
            url += f"&startDate={startDate}+00:00:00&endDate={endDate}+23:59:59"
        response = requests.get(
            url,
            headers=headers,
        )
        return JsonResponse(response.json(), safe=False)


def download_pdf(url, save_path):
    """Downloads a PDF from a given URL and saves it to a local path."""
    print(f"Downloading PDF from {url}...")
    try:
        response = requests.get(url, timeout=30)
        # Raise an exception for bad status codes (4xx or 5xx)
        response.raise_for_status()
        with open("./media/pdf/" + save_path, "wb") as f:
            f.write(response.content)
        print(f"Successfully downloaded and saved to {save_path}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error downloading PDF: {e}")
        return False


def create_paid_stamp(info_lines=None):
    """
    Creates a PDF in memory containing a rotated, transparent "PAID" stamp and extra info.
    """
    if info_lines is None:
        info_lines = [("CK#NO:", "N/A"), ("AMOUNT", "N/A"), ("DATE", "N/A")]

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
    can.setFont("Helvetica", info_font_size)
    info_x_offset = font_size + 10  # space to the right of "PAID"
    for i, (label, value) in enumerate(info_lines):
        # Draw label in red
        can.setFillColor(colors.red, alpha=opacity)
        can.drawString(-info_x_offset, -(i + 1.5) * info_gap, label)
        # Draw value in black
        can.setFillColor(colors.black, alpha=opacity)
        label_width = can.stringWidth(label, "Helvetica", info_font_size)
        can.drawString(-info_x_offset + label_width + 5, -(i + 1.5) * info_gap, value)
    can.restoreState()

    can.save()

    # Move to the beginning of the BytesIO buffer
    packet.seek(0)
    return packet


def add_stamp_to_pdf(original_pdf_path, stamped_pdf_path, info_lines=None):
    """
    Overlays the "PAID" stamp onto the first page of the original PDF.
    """
    print(f"Stamping {original_pdf_path}...")
    try:
        # Create the stamp PDF in memory
        stamp_data = create_paid_stamp(info_lines)
        stamp_pdf = PdfReader(stamp_data)
        stamp_page = stamp_pdf.pages[0]

        # Open the original PDF to be stamped
        original_pdf = PdfReader("./media/pdf/" + original_pdf_path)
        writer = PdfWriter()

        first_page = original_pdf.pages[0]

        first_page.merge_page(stamp_page)

        writer.add_page(first_page)

        if len(original_pdf.pages) > 1:
            for page_num in range(1, len(original_pdf.pages)):
                writer.add_page(original_pdf.pages[page_num])

        with open("./media/pdf/" + stamped_pdf_path, "wb") as f:
            writer.write(f)

        # remove the original file if needed
        os.remove("./media/pdf/" + original_pdf_path)

        print(f"Successfully created stamped PDF: {stamped_pdf_path}")

    except Exception as e:
        print(f"An error occurred during the stamping process: {e}")


def stampMaker(data, token):
    print(f"Processing {len(data)} payments for stamping...")
    total = len(data)
    count = 1
    for entry in data:
        transactionId = entry.get("transactionId", None)
        invoiceId = entry.get("orderId", None)
        paymentAmount = entry.get("paymentAmount", None)
        date = entry.get("paymentInsertedTimestamp", None)
        parentPaymentId = entry.get("parentPaymentId", None)
        customerId = entry.get("customerId", None)
        if parentPaymentId:
            headers = {
                "Accept": "application/json, text/plain",
                "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
                "Authorization": ("Bearer " + token.accessToken if token else ""),
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Pragma": "no-cache",
                "Referer": "https://erp.101distributorsga.com/sales/paymentReceived",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
                "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            }

            response = requests.get(
                f"https://erp.101distributorsga.com/api/customer/paymentDetails?storeIds=1,2&parentPaymentId={parentPaymentId}&page=0&size=999",
                headers=headers,
            )
            if response.json().get("hasError", False):
                yield json.dumps({"error": "Failed to fetch child payment details"}, indent=4)
            else:
                childPayments = response.json()["result"]["content"]
                if len(childPayments) == 1:
                    invoiceId = childPayments[0].get("orderId", None)
                    if transactionId:
                        url = f"https://erp.101distributorsga.com/services/pdf/sales-order/invoice/{invoiceId}?token={token}&zone=America%2FNew_York&storeIdList=1%2C2&defaultStoreId=1&showSkuOnSalePage=false"
                        invoiceName = f"Statement-{customerId}-{date.split(' ')[0]}"
                        original_file = f"{invoiceName}_original.pdf"
                        stamped_file = f"{invoiceName}_with_paid_stamp.pdf"
                        if download_pdf(url, original_file):
                            checkLabel = "CK#NO:" if "CK#" in transactionId else ("CC#NO:" if "CC" in transactionId else ("ACH#NO:" if "ACH" in transactionId else "TX#NO:"))
                            info_lines = [
                                (
                                    checkLabel,
                                    (str(transactionId) if transactionId else "N/A"),
                                ),
                                (
                                    "AMOUNT",
                                    (str(paymentAmount) if paymentAmount else "N/A"),
                                ),
                                ("DATE", str(date) if date else "N/A"),
                            ]
                            add_stamp_to_pdf(original_file, stamped_file, info_lines)
                            yield json.dumps({"status": "processed", "customerId": customerId, "transactionId": transactionId,"data": entry,"percent": round((count / total) * 100)}, indent=4)
                        else:
                            yield json.dumps({"error": "Failed to download invoice PDF for customer: " + str(customerId) + " Parent Payment ID: " + str(parentPaymentId)}, indent=4)
                    else:
                        yield json.dumps({"error": "Skipping payment with no transaction ID for customer: " + str(customerId) + " Parent Payment ID: " + str(parentPaymentId)}, indent=4)
                else:
                    if transactionId:
                        url = f"https://erp.101distributorsga.com/services/pdf/cusomter/statement?startDate={date}&endDate={date}&isAccrual=true&customerIds={customerId}&point=erp&token={token}&zone=America/New_York&storeIdList=1,2&defaultStoreId=1"
                        invoiceName = f"Statement-{customerId}-{date.split(' ')[0]}"
                        original_file = f"{invoiceName}_original.pdf"
                        stamped_file = f"{invoiceName}_with_paid_stamp.pdf"
                        if download_pdf(url, original_file):
                            checkLabel = "CK#NO:" if "CK#" in transactionId else ("CC#NO:" if "CC" in transactionId else ("ACH#NO:" if "ACH" in transactionId else "TX#NO:"))
                            info_lines = [
                                (
                                    checkLabel,
                                    (str(transactionId) if transactionId else "N/A"),
                                ),
                                (
                                    "AMOUNT",
                                    (str(paymentAmount) if paymentAmount else "N/A"),
                                ),
                                ("DATE", str(date) if date else "N/A"),
                            ]
                            add_stamp_to_pdf(original_file, stamped_file, info_lines)
                            yield json.dumps({"status": "processed", "customerId": customerId, "transactionId": transactionId,"data": entry,"percent": round((count / total) * 100)}, indent=4)
                        else:
                            yield json.dumps({"error": "Failed to download statement PDF for customer: " + str(customerId) + " Parent Payment ID: " + str(parentPaymentId)}, indent=4)
                    else:
                        yield json.dumps({"error": "Skipping payment with no transaction ID for customer: " + str(customerId) + " Parent Payment ID: " + str(parentPaymentId)}, indent=4)
        else:
            if transactionId:
                url = f"https://erp.101distributorsga.com/services/pdf/sales-order/invoice/{invoiceId}?token={token}&zone=America%2FNew_York&storeIdList=1%2C2&defaultStoreId=1&showSkuOnSalePage=false"
                invoiceName = f"Statement-{customerId}-{date.split(' ')[0]}"
                original_file = f"{invoiceName}_original.pdf"
                stamped_file = f"{invoiceName}_with_paid_stamp.pdf"
                if download_pdf(url, original_file):
                    checkLabel = "CK#NO:" if "CK#" in transactionId else ("CC#NO:" if "CC" in transactionId else ("ACH#NO:" if "ACH" in transactionId else "TX#NO:"))
                    info_lines = [
                        (
                            checkLabel,
                            str(transactionId) if transactionId else "N/A",
                        ),
                        (
                            "AMOUNT",
                            str(paymentAmount) if paymentAmount else "N/A",
                        ),
                        ("DATE", str(date) if date else "N/A"),
                    ]
                    add_stamp_to_pdf(original_file, stamped_file, info_lines)
                    yield json.dumps({"status": "processed", "customerId": customerId, "transactionId": transactionId,"data": entry,"percent": round((count / total) * 100)}, indent=4)
                else:
                    yield json.dumps({"error": "Failed to download statement PDF for customer: " + str(customerId) + " Parent Payment ID: " + str(parentPaymentId)}, indent=4)
            else:
                yield json.dumps({"error": "Skipping payment with no transaction ID for customer: " + str(customerId) + " Parent Payment ID: " + str(parentPaymentId)}, indent=4)
        count += 1
    # zip all stamped files from ./media/pdf/ and save it to ./media/zip/stamped_invoices.zip
    # and remove all stamped files from ./media/pdf/
    # and send the zip file as response
    zip_filename = "stamped_invoices.zip"
    zip_filepath = f"./media/zip/{zip_filename}"
    import zipfile

    with zipfile.ZipFile(zip_filepath, "w") as zipf:
        for root, dirs, files in os.walk("./media/pdf/"):
            for file in files:
                if file.endswith("_with_paid_stamp.pdf"):
                    zipf.write(
                        os.path.join(root, file),
                        arcname=file,
                    )
                    os.remove(os.path.join(root, file))
    yield json.dumps({"zipUrl": f"/media/zip/{zip_filename}"}, indent=4)


class StampInvoiceView(View):

    def get(self, request):
        token = SalesgentToken.objects.filter(id=1).first()
        startDate = request.GET.get("startDate", None)
        endDate = request.GET.get("endDate", None)

        headers = {
            "sec-ch-ua-platform": '"Windows"',
            "Authorization": f"Bearer {token.accessToken}" if token else "",
            "Referer": "https://erp.101distributorsga.com/sales/paymentReceived",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain",
            "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
            "sec-ch-ua-mobile": "?0",
        }

        response = requests.get(
            f"https://erp.101distributorsga.com/api/customer/paymentDetails?storeIds=1,2&startDate={startDate}+00:00:00&endDate={endDate}+23:59:59&size=100000",
            headers=headers,
        )
        if response.json().get("hasError", False):
            print("Error fetching payment details:", response.json())
            return JsonResponse({"error": "Failed to fetch payment details"}, status=500)
        data = response.json()["result"]["content"]

        response = StreamingHttpResponse(stampMaker(data, token), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        return response

class DownloadStampedInvoicesView(View):
    def get(self, request):
        zip_filename = "stamped_invoices.zip"
        zip_filepath = f"./media/zip/{zip_filename}"
        if os.path.exists(zip_filepath):
            with open(zip_filepath, "rb") as f:
                response = StreamingHttpResponse(f, content_type="application/zip")
                response["Content-Disposition"] = f'attachment; filename="{zip_filename}"'
                return response
        else:
            return JsonResponse({"error": "No stamped invoices available for download."}, status=404)