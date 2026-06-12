from django.shortcuts import render
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status
from api.models import SalesgentToken, Customer, Invoice, ModulePermissions
from .models import DeliveryDriver, DeliveryTruck, DeliverySheet
from .serializers import (
    DeliveryTruckSerializer, DeliveryDriverSerializer, DeliveryUserSerializer,
    DeliveryEntryItemSerializer, DeliveryTruckGroupSerializer, DashboardStatsSerializer,
    InvoiceDetailSerializer,
)
from datetime import datetime
from django.contrib.auth.models import User, Group
from django.db.models.expressions import RawSQL
from django.db.models import F, JSONField, Func
from django.db import transaction
from collections import defaultdict

from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


# Create your views here.
class ScanInvoice(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        invoiceId = request.data.get("invoiceId")
        token = SalesgentToken.objects.filter(id=1).first()
        headers = {
            "Accept": "application/json, text/plain",
            "Accept-Language": "en-US,en;q=0.9,gu;q=0.8,ru;q=0.7,hi;q=0.6",
            "Authorization": "Bearer " + token.accessToken if token else "",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Pragma": "no-cache",
            "Referer": "https://erp.101distributorsga.com/sales/orders/" + str(invoiceId),
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }
        try:
            response = requests.get("https://erp.101distributorsga.com/api/order/" + str(invoiceId) + "/withCustomer?storeIds=1,2,3,4,5", headers=headers)
            data = response.json()
            if data["hasError"]:
                return Response({"error": data["error"]}, status=http_status.HTTP_200_OK)
            else:
                return Response(data["result"], status=http_status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


class TruckInfo(APIView):
    def get(self, request):
        """
        Fetches the list of delivery drivers and trucks.
        """
        deliveryDriver = DeliveryDriver.objects.all()
        deliveryTruck = DeliveryTruck.objects.all()
        trucks_data = DeliveryTruckSerializer(deliveryTruck, many=True).data
        drivers_data = DeliveryDriverSerializer(deliveryDriver, many=True).data

        return Response({"trucks": trucks_data, "drivers": drivers_data})


class UploadDeliveryEntry(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Uploads a single delivery entry to the DeliverySheet table.
        """
        try:
            data = request.data

            # Get or create customer
            customer_id = data.get("customerId")
            customer_name = data.get("customerName")

            customer = None
            if customer_id and customer_id != "N/A":
                try:
                    customer = Customer.objects.get(id=customer_id)
                except Customer.DoesNotExist:
                    pass

            if not customer and customer_name:
                customer, created = Customer.objects.get_or_create(name=customer_name, defaults={"name": customer_name})

            if not customer:
                return Response({"error": "Customer information is required"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Get or create invoice - using invoice number as the ID
            invoice_number = data.get("invoiceNumber")
            order_id = data.get("orderId")

            invoice = None
            if invoice_number:
                try:
                    # Try to find existing invoice by ID (assuming invoice number is the ID)
                    invoice = Invoice.objects.get(id=invoice_number)
                except (Invoice.DoesNotExist, ValueError):
                    # Create new invoice if not found
                    invoice = Invoice.objects.create(id=invoice_number, customerId=customer, customerName=customer_name, status=data.get("status", "Pending"))

            if not invoice:
                return Response({"error": "Invoice information is required"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Get truck
            truck_no = data.get("truckNo")
            try:
                truck = DeliveryTruck.objects.get(truckNo=truck_no)
            except DeliveryTruck.DoesNotExist:
                return Response({"error": f"Truck with number {truck_no} not found"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Get driver (optional)
            driver = None
            driver_license = data.get("driverLicense")
            if driver_license:
                try:
                    driver = DeliveryDriver.objects.get(driverLicense=driver_license)
                except DeliveryDriver.DoesNotExist:
                    return Response({"error": f"Driver with license {driver_license} not found"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Parse date
            try:
                date_created = data.get("dateCreated")
                if date_created:
                    date_obj = datetime.fromisoformat(date_created.replace("Z", "+00:00")).date()
                else:
                    date_obj = datetime.now().date()
            except (ValueError, TypeError):
                date_obj = datetime.now().date()

            # Create delivery sheet entry
            delivery_entry = DeliverySheet.objects.create(invoice=invoice, customer=customer, box=data.get("caseCount", 1), checkAmount=data.get("checkAmount"), cashAmount=data.get("cashAmount"), payment_status=data.get("paymentStatus") == "paid", status=False, date=date_obj, truck=truck, driver=driver)  # Not delivered yet

            return Response({"success": True, "message": f"Delivery entry for invoice {invoice_number} created successfully", "delivery_id": delivery_entry.id})

        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


class ListDeliveries(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Returns all DeliverySheet entries for a given date, grouped by truck.
        Query param: date (YYYY-MM-DD)
        """
        date_str = request.GET.get("date")
        if not date_str:
            return Response({"error": "date query parameter is required (YYYY-MM-DD)"}, status=http_status.HTTP_400_BAD_REQUEST)
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=http_status.HTTP_400_BAD_REQUEST)

        deliveries_data = DeliverySheet.objects.filter(date=date_obj).values(
            'id', 'invoice__id', 'customer__id', 'customer__name', 'customer__company', 'box', 'checkAmount',
            'cashAmount', 'payment_status', 'status', 'date', 'truck__truckNo',
            'truck__truckName', 'driver__user__first_name', 'insertedTimestamp', 'deliveryTimestamp'
        ).order_by('truck__truckNo')

        grouped = defaultdict(lambda: {"deliveries": [], "truckNo": None, "truckName": None, "driver": None})

        for delivery in deliveries_data:
            truckNo = delivery['truck__truckNo']
            if not grouped[truckNo]['truckNo']:
                grouped[truckNo]['truckNo'] = truckNo
                grouped[truckNo]['truckName'] = delivery['truck__truckName']
                grouped[truckNo]['driver'] = delivery['driver__user__first_name']

            grouped[truckNo]['deliveries'].append({
                'id': delivery['id'],
                'invoice': str(delivery['invoice__id']),
                'customer': str(delivery['customer__name']),
                'customerId': str(delivery['customer__id']) if delivery['customer__id'] else None,
                'customerCompany': str(delivery['customer__company']) if delivery['customer__company'] else None,
                'box': delivery['box'],
                'checkAmount': float(delivery['checkAmount']) if delivery['checkAmount'] is not None else None,
                'cashAmount': float(delivery['cashAmount']) if delivery['cashAmount'] is not None else None,
                'payment_status': delivery['payment_status'],
                'status': delivery['status'],
                'date': delivery['date'].isoformat() if delivery['date'] else None,
                'driver': delivery['driver__user__first_name'],
                'insertedTimestamp': delivery['insertedTimestamp'].isoformat() if delivery['insertedTimestamp'] else None,
                'deliveryTimestamp': delivery['deliveryTimestamp'].isoformat() if delivery['deliveryTimestamp'] else None
            })

        return Response({"trucks": list(grouped.values())}, status=http_status.HTTP_200_OK)



class DashboardStats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Returns dashboard statistics for deliveries on a given date (defaults to today).
        Groups DeliverySheet entries by truck, similar to ListDeliveries.
        Query param: date (YYYY-MM-DD)
        """
        date_str = request.GET.get("date")
        if not date_str:
            date_obj = datetime.now().date()
        else:
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=http_status.HTTP_400_BAD_REQUEST)

        deliveries_data = DeliverySheet.objects.filter(date=date_obj).values(
            'id', 'invoice__id', 'customer__id', 'customer__name','customer__company', 'box', 'checkAmount',
            'cashAmount', 'payment_status', 'status', 'date', 'truck__truckNo',
            'truck__truckName', 'driver__user__first_name', 'insertedTimestamp', 'deliveryTimestamp'
        ).order_by('truck__truckNo')

        grouped = defaultdict(lambda: {"deliveries": [], "truckNo": None, "truckName": None, "driver": None})
        total_invoices = 0
        paid_invoices = 0
        unpaid_invoices = 0
        total_cases = 0

        for delivery in deliveries_data:
            truckNo = delivery['truck__truckNo']
            if not grouped[truckNo]['truckNo']:
                grouped[truckNo]['truckNo'] = truckNo
                grouped[truckNo]['truckName'] = delivery['truck__truckName']
                grouped[truckNo]['driver'] = delivery['driver__user__first_name']

            grouped[truckNo]['deliveries'].append({
                'id': delivery['id'],
                'invoice': str(delivery['invoice__id']),
                'customer': str(delivery['customer__name']),
                'customerCompany': str(delivery['customer__company']) if delivery['customer__company'] else None,
                'customerId': str(delivery['customer__id']) if delivery['customer__id'] else None,
                'box': delivery['box'],
                'checkAmount': float(delivery['checkAmount']) if delivery['checkAmount'] is not None else None,
                'cashAmount': float(delivery['cashAmount']) if delivery['cashAmount'] is not None else None,
                'payment_status': delivery['payment_status'],
                'status': delivery['status'],
                'date': delivery['date'].isoformat() if delivery['date'] else None,
                'driver': delivery['driver__user__first_name'],
                'insertedTimestamp': delivery['insertedTimestamp'].isoformat() if delivery['insertedTimestamp'] else None,
                'deliveryTimestamp': delivery['deliveryTimestamp'].isoformat() if delivery['deliveryTimestamp'] else None
            })

            total_invoices += 1
            total_cases += delivery['box'] if delivery['box'] else 0
            if delivery['payment_status']:
                paid_invoices += 1
            else:
                unpaid_invoices += 1

        response_data = {
            "date": date_obj.isoformat(),
            "stats": {
                "totalInvoices": total_invoices,
                "paidInvoices": paid_invoices,
                "unpaidInvoices": unpaid_invoices,
                "totalCases": total_cases
            },
            "trucks": list(grouped.values())
        }

        return Response(response_data, status=http_status.HTTP_200_OK)


class InvoiceDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id):
        """
        Get invoice details by invoice ID from DeliverySheet.
        """
        try:
            # Try to find the delivery entry by invoice ID
            delivery = DeliverySheet.objects.filter(invoice__id=invoice_id).first()

            if not delivery:
                return Response({"error": "Invoice not found"}, status=http_status.HTTP_404_NOT_FOUND)

            invoice_data = {"id": str(delivery.invoice.id), "invoiceNumber": str(delivery.invoice.id), "customerId": str(delivery.customer.id) if delivery.customer else None, "customerName": str(delivery.customer) if delivery.customer else None, "caseCount": delivery.box, "checkAmount": float(delivery.checkAmount) if delivery.checkAmount is not None else None, "cashAmount": float(delivery.cashAmount) if delivery.cashAmount is not None else None, "paymentStatus": "paid" if delivery.payment_status else "not_paid", "dateCreated": delivery.insertedTimestamp.isoformat() if delivery.insertedTimestamp else None, "dateUpdated": delivery.deliveryTimestamp.isoformat() if delivery.deliveryTimestamp else None, "status": "delivered" if delivery.status else "pending"}

            return Response(invoice_data)

        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, invoice_id):
        """
        Update payment information for an invoice.
        """
        try:
            # Find the delivery entry by invoice ID
            delivery = DeliverySheet.objects.filter(invoice_id=invoice_id).first()

            if not delivery:
                return Response({"error": "Invoice not found"}, status=http_status.HTTP_404_NOT_FOUND)

            # Update payment information
            data = request.data

            if "checkAmount" in data:
                delivery.checkAmount = data["checkAmount"] if data["checkAmount"] else None

            if "cashAmount" in data:
                delivery.cashAmount = data["cashAmount"] if data["cashAmount"] else None

            if "paymentStatus" in data:
                delivery.payment_status = data["paymentStatus"] == "paid"

            # Update delivery timestamp when payment is recorded
            if delivery.payment_status:
                delivery.deliveryTimestamp = datetime.now()

            delivery.save()

            return Response({"success": True, "message": f"Payment for invoice {invoice_id} updated successfully"})

        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


# CRUD Operations for Trucks
class TruckCRUD(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, truck_id=None):
        """
        Get all trucks or a specific truck by ID
        """
        try:
            if truck_id:
                truck = DeliveryTruck.objects.get(id=truck_id)
                return Response(DeliveryTruckSerializer(truck).data)
            else:
                trucks = DeliveryTruck.objects.all()
                trucks_data = DeliveryTruckSerializer(trucks, many=True).data
                return Response({"trucks": trucks_data})
        except DeliveryTruck.DoesNotExist:
            return Response({"error": "Truck not found"}, status=http_status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """
        Create a new truck
        """
        try:
            data = request.data
            truck_no = data.get("truckNo")
            truck_name = data.get("truckName")

            if not truck_no or not truck_name:
                return Response({"error": "truckNo and truckName are required"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Check if truck number already exists
            if DeliveryTruck.objects.filter(truckNo=truck_no).exists():
                return Response({"error": "Truck number already exists"}, status=http_status.HTTP_400_BAD_REQUEST)

            truck = DeliveryTruck.objects.create(truckNo=truck_no, truckName=truck_name)

            return Response({
                    "success": True,
                    "message": "Truck created successfully",
                    "truck": DeliveryTruckSerializer(truck).data,
                })
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, truck_id):
        """
        Update an existing truck
        """
        try:
            truck = DeliveryTruck.objects.get(id=truck_id)
            data = request.data

            if "truckNo" in data:
                # Check if new truck number already exists for other trucks
                if DeliveryTruck.objects.filter(truckNo=data["truckNo"]).exclude(id=truck_id).exists():
                    return Response({"error": "Truck number already exists"}, status=http_status.HTTP_400_BAD_REQUEST)
                truck.truckNo = data["truckNo"]

            if "truckName" in data:
                truck.truckName = data["truckName"]

            truck.save()

            return Response({
                    "success": True,
                    "message": "Truck updated successfully",
                    "truck": DeliveryTruckSerializer(truck).data,
                })
        except DeliveryTruck.DoesNotExist:
            return Response({"error": "Truck not found"}, status=http_status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, truck_id):
        """
        Delete a truck
        """
        try:
            truck = DeliveryTruck.objects.get(id=truck_id)

            # Check if truck is being used in any delivery sheet
            if DeliverySheet.objects.filter(truck=truck).exists():
                return Response({"error": "Cannot delete truck as it is being used in delivery sheets"}, status=http_status.HTTP_400_BAD_REQUEST)

            truck.delete()

            return Response({"success": True, "message": "Truck deleted successfully"})
        except DeliveryTruck.DoesNotExist:
            return Response({"error": "Truck not found"}, status=http_status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


# CRUD Operations for Drivers
class DriverCRUD(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, driver_id=None):
        """
        Get all drivers or a specific driver by ID
        """
        try:
            if driver_id:
                driver = DeliveryDriver.objects.get(id=driver_id)
                return Response(DeliveryDriverSerializer(driver).data)
            else:
                drivers = DeliveryDriver.objects.all()
                drivers_data = DeliveryDriverSerializer(drivers, many=True).data
                return Response({"drivers": drivers_data})
        except DeliveryDriver.DoesNotExist:
            return Response({"error": "Driver not found"}, status=http_status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """
        Create a new driver with user account
        """
        try:
            data = request.data
            driver_license = data.get("driverLicense")
            username = data.get("username")
            email = data.get("email")
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            password = data.get("password")

            if not all([driver_license, username, email, first_name, last_name, password]):
                return Response({"error": "All fields are required: driverLicense, username, email, first_name, last_name, password"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Check if driver license already exists
            if DeliveryDriver.objects.filter(driverLicense=driver_license).exists():
                return Response({"error": "Driver license already exists"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Check if username already exists
            if User.objects.filter(username=username).exists():
                return Response({"error": "Username already exists"}, status=http_status.HTTP_400_BAD_REQUEST)

            # Check if email already exists
            if User.objects.filter(email=email).exists():
                return Response({"error": "Email already exists"}, status=http_status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                # Create user
                user = User.objects.create_user(username=username, email=email, first_name=first_name, last_name=last_name, password=password)

                # Add user to "Truck Driver" group
                truck_driver_group, created = Group.objects.get_or_create(name="Truck Driver")
                user.groups.add(truck_driver_group)

                # Create driver
                driver = DeliveryDriver.objects.create(user=user, driverLicense=driver_license)

                ModulePermissions.objects.create(user=user, delivery=True)

                return Response({
                        "success": True,
                        "message": "Driver created successfully",
                        "driver": DeliveryDriverSerializer(driver).data,
                    })
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, driver_id):
        """
        Update an existing driver
        """
        try:
            driver = DeliveryDriver.objects.get(id=driver_id)
            data = request.data

            with transaction.atomic():
                if "driverLicense" in data:
                    # Check if new driver license already exists for other drivers
                    if DeliveryDriver.objects.filter(driverLicense=data["driverLicense"]).exclude(id=driver_id).exists():
                        return Response({"error": "Driver license already exists"}, status=http_status.HTTP_400_BAD_REQUEST)
                    driver.driverLicense = data["driverLicense"]

                # Update user information if provided
                if driver.user:
                    user = driver.user

                    if "username" in data:
                        # Check if new username already exists for other users
                        if User.objects.filter(username=data["username"]).exclude(id=user.id).exists():
                            return Response({"error": "Username already exists"}, status=http_status.HTTP_400_BAD_REQUEST)
                        user.username = data["username"]

                    if "email" in data:
                        # Check if new email already exists for other users
                        if User.objects.filter(email=data["email"]).exclude(id=user.id).exists():
                            return Response({"error": "Email already exists"}, status=http_status.HTTP_400_BAD_REQUEST)
                        user.email = data["email"]

                    if "first_name" in data:
                        user.first_name = data["first_name"]

                    if "last_name" in data:
                        user.last_name = data["last_name"]

                    if "password" in data and data["password"]:
                        user.set_password(data["password"])

                    if "is_active" in data:
                        user.is_active = data["is_active"]

                    user.save()

                driver.save()

                return Response({
                        "success": True,
                        "message": "Driver updated successfully",
                        "driver": DeliveryDriverSerializer(driver).data,
                    })
        except DeliveryDriver.DoesNotExist:
            return Response({"error": "Driver not found"}, status=http_status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, driver_id):
        """
        Delete a driver and their user account
        """
        try:
            driver = DeliveryDriver.objects.get(id=driver_id)

            # Check if driver is being used in any delivery sheet
            if DeliverySheet.objects.filter(driver=driver).exists():
                return Response({"error": "Cannot delete driver as they are assigned to delivery sheets"}, status=http_status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                user = driver.user
                driver.delete()

                # Delete the associated user account if it exists
                if user:
                    user.delete()

                return Response({"success": True, "message": "Driver deleted successfully"})
        except DeliveryDriver.DoesNotExist:
            return Response({"error": "Driver not found"}, status=http_status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
