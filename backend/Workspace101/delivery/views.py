from django.shortcuts import render
from django.http import JsonResponse
import requests
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from api.models import SalesgentToken, Customer, Invoice, ModulePermissions
from .models import DeliveryDriver, DeliveryTruck, DeliverySheet
from datetime import datetime
from django.contrib.auth.models import User, Group
from django.db import transaction

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
            response = requests.get("https://erp.101distributorsga.com/api/order/" + str(invoiceId) + "/withCustomer?storeIds=1,2", headers=headers)
            data = response.json()
            if data["hasError"]:
                return JsonResponse({"error": data["error"]})
            else:
                return JsonResponse(data["result"], safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class TruckInfo(APIView):
    def get(self, request):
        """
        Fetches the list of delivery drivers and trucks.
        """
        deliveryDriver = DeliveryDriver.objects.all()
        deliveryTruck = DeliveryTruck.objects.all()
        data = {}
        data["trucks"] = []
        data["drivers"] = []

        for truck in deliveryTruck:
            data["trucks"].append(
                {
                    "truckNo": truck.truckNo,
                    "truckName": truck.truckName,
                }
            )
        for driver in deliveryDriver:
            data["drivers"].append(
                {
                    "driverName": driver.driverName,
                    "driverLicense": driver.driverLicense,
                }
            )

        return JsonResponse(data)


class UploadDeliveryEntry(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Uploads a single delivery entry to the DeliverySheet table.
        """
        try:
            data = request.data
            
            # Get or create customer
            customer_id = data.get('customerId')
            customer_name = data.get('customerName')
            
            customer = None
            if customer_id and customer_id != 'N/A':
                try:
                    customer = Customer.objects.get(id=customer_id)
                except Customer.DoesNotExist:
                    pass
            
            if not customer and customer_name:
                customer, created = Customer.objects.get_or_create(
                    name=customer_name,
                    defaults={'name': customer_name}
                )
            
            if not customer:
                return JsonResponse({"error": "Customer information is required"}, status=400)
            
            # Get or create invoice - using invoice number as the ID
            invoice_number = data.get('invoiceNumber')
            order_id = data.get('orderId')
            
            invoice = None
            if invoice_number:
                try:
                    # Try to find existing invoice by ID (assuming invoice number is the ID)
                    invoice = Invoice.objects.get(id=invoice_number)
                except (Invoice.DoesNotExist, ValueError):
                    # Create new invoice if not found
                    invoice = Invoice.objects.create(
                        id=invoice_number,
                        customerId=customer,
                        customerName=customer_name,
                        status=data.get('status', 'Pending')
                    )
            
            if not invoice:
                return JsonResponse({"error": "Invoice information is required"}, status=400)
            
            # Get truck
            truck_no = data.get('truckNo')
            try:
                truck = DeliveryTruck.objects.get(truckNo=truck_no)
            except DeliveryTruck.DoesNotExist:
                return JsonResponse({"error": f"Truck with number {truck_no} not found"}, status=400)
            
            # Get driver (optional)
            driver = None
            driver_license = data.get('driverLicense')
            if driver_license:
                try:
                    driver = DeliveryDriver.objects.get(driverLicense=driver_license)
                except DeliveryDriver.DoesNotExist:
                    return JsonResponse({"error": f"Driver with license {driver_license} not found"}, status=400)
            
            # Parse date
            try:
                date_created = data.get('dateCreated')
                if date_created:
                    date_obj = datetime.fromisoformat(date_created.replace('Z', '+00:00')).date()
                else:
                    date_obj = datetime.now().date()
            except (ValueError, TypeError):
                date_obj = datetime.now().date()
            
            # Create delivery sheet entry
            delivery_entry = DeliverySheet.objects.create(
                invoice=invoice,
                customer=customer,
                box=data.get('caseCount', 1),
                checkAmount=data.get('checkAmount'),
                cashAmount=data.get('cashAmount'),
                payment_status=data.get('paymentStatus') == 'paid',
                status=False,  # Not delivered yet
                date=date_obj,
                truck=truck,
                driver=driver
            )
            
            return JsonResponse({
                "success": True,
                "message": f"Delivery entry for invoice {invoice_number} created successfully",
                "delivery_id": delivery_entry.id
            })
            
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)



class ListDeliveries(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Returns all DeliverySheet entries for a given date, grouped by truck.
        Query param: date (YYYY-MM-DD)
        """
        date_str = request.GET.get('date')
        if not date_str:
            return JsonResponse({"error": "date query parameter is required (YYYY-MM-DD)"}, status=400)
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        deliveries = DeliverySheet.objects.filter(date=date_obj)
        grouped = {}
        for delivery in deliveries:
            truck = delivery.truck
            truck_key = truck.truckNo
            if truck_key not in grouped:
                grouped[truck_key] = {
                    "truckNo": truck.truckNo,
                    "truckName": truck.truckName,
                    "deliveries": []
                }
            grouped[truck_key]["deliveries"].append({
                "id": delivery.id,
                "invoice": str(delivery.invoice),
                "customer": str(delivery.customer),
                "box": delivery.box,
                "checkAmount": float(delivery.checkAmount) if delivery.checkAmount is not None else None,
                "cashAmount": float(delivery.cashAmount) if delivery.cashAmount is not None else None,
                "payment_status": delivery.payment_status,
                "status": delivery.status,
                "date": delivery.date.isoformat(),
                "driver": str(delivery.driver) if delivery.driver else None,
                "insertedTimestamp": delivery.insertedTimestamp.isoformat() if delivery.insertedTimestamp else None,
                "deliveryTimestamp": delivery.deliveryTimestamp.isoformat() if delivery.deliveryTimestamp else None
            })
        # Return as a list of trucks with deliveries
        return JsonResponse({"trucks": list(grouped.values())}, safe=False)


class DashboardStats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Returns dashboard statistics for deliveries on a given date (defaults to today).
        """
        admin = request.GET.get('admin') == 'true'
        user = request.GET.get('user', None)
        date_str = request.GET.get('date')
        if not date_str:
            date_obj = datetime.now().date()
        else:
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                # 2025-08-06
            except ValueError:
                return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)
        deliveries = []
        if not admin:
            driver = DeliveryDriver.objects.filter(user__email=user).first()
            print(driver)
            deliveries = DeliverySheet.objects.filter(date=date_obj, driver=driver)
        else:
            deliveries = DeliverySheet.objects.filter(date=date_obj)

        # Group deliveries by truck and calculate stats
        grouped = {}
        total_invoices = 0
        paid_invoices = 0
        unpaid_invoices = 0
        total_cases = 0
        
        for delivery in deliveries:
            truck = delivery.truck
            truck_key = truck.truckNo
            
            if truck_key not in grouped:
                grouped[truck_key] = {
                    "truckNo": truck.truckNo,
                    "truckName": truck.truckName,
                    "driver": str(delivery.driver) if delivery.driver else None,
                    "deliveries": []
                }
            
            delivery_data = {
                "id": delivery.id,
                "invoice": str(delivery.invoice),
                "customer": str(delivery.customer),
                "box": delivery.box,
                "checkAmount": float(delivery.checkAmount) if delivery.checkAmount is not None else None,
                "cashAmount": float(delivery.cashAmount) if delivery.cashAmount is not None else None,
                "payment_status": delivery.payment_status,
                "status": delivery.status,
                "date": delivery.date.isoformat(),
                "insertedTimestamp": delivery.insertedTimestamp.isoformat() if delivery.insertedTimestamp else None,
                "deliveryTimestamp": delivery.deliveryTimestamp.isoformat() if delivery.deliveryTimestamp else None
            }
            
            grouped[truck_key]["deliveries"].append(delivery_data)
            
            # Calculate stats
            total_invoices += 1
            total_cases += delivery.box
            
            if delivery.payment_status:
                paid_invoices += 1
            else:
                unpaid_invoices += 1
        
        # Prepare response
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
        
        return JsonResponse(response_data, safe=False)


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
                return JsonResponse({"error": "Invoice not found"}, status=404)
            
            invoice_data = {
                "id": str(delivery.invoice.id),
                "invoiceNumber": str(delivery.invoice.id),
                "customerId": str(delivery.customer.id) if delivery.customer else None,
                "customerName": str(delivery.customer) if delivery.customer else None,
                "caseCount": delivery.box,
                "checkAmount": float(delivery.checkAmount) if delivery.checkAmount is not None else None,
                "cashAmount": float(delivery.cashAmount) if delivery.cashAmount is not None else None,
                "paymentStatus": "paid" if delivery.payment_status else "not_paid",
                "dateCreated": delivery.insertedTimestamp.isoformat() if delivery.insertedTimestamp else None,
                "dateUpdated": delivery.deliveryTimestamp.isoformat() if delivery.deliveryTimestamp else None,
                "status": "delivered" if delivery.status else "pending"
            }
            
            return JsonResponse(invoice_data)
            
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    def post(self, request, invoice_id):
        """
        Update payment information for an invoice.
        """
        try:
            # Find the delivery entry by invoice ID
            delivery = DeliverySheet.objects.filter(invoice_id=invoice_id).first()
            
            if not delivery:
                return JsonResponse({"error": "Invoice not found"}, status=404)
            
            # Update payment information
            data = request.data
            
            if 'checkAmount' in data:
                delivery.checkAmount = data['checkAmount'] if data['checkAmount'] else None
                
            if 'cashAmount' in data:
                delivery.cashAmount = data['cashAmount'] if data['cashAmount'] else None
                
            if 'paymentStatus' in data:
                delivery.payment_status = data['paymentStatus'] == 'paid'
                
            # Update delivery timestamp when payment is recorded
            if delivery.payment_status:
                delivery.deliveryTimestamp = datetime.now()
            
            delivery.save()
            
            return JsonResponse({
                "success": True,
                "message": f"Payment for invoice {invoice_id} updated successfully"
            })
            
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


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
                return JsonResponse({
                    "id": truck.id,
                    "truckNo": truck.truckNo,
                    "truckName": truck.truckName,
                })
            else:
                trucks = DeliveryTruck.objects.all()
                trucks_data = []
                for truck in trucks:
                    trucks_data.append({
                        "id": truck.id,
                        "truckNo": truck.truckNo,
                        "truckName": truck.truckName,
                    })
                return JsonResponse({"trucks": trucks_data})
        except DeliveryTruck.DoesNotExist:
            return JsonResponse({"error": "Truck not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    def post(self, request):
        """
        Create a new truck
        """
        try:
            data = request.data
            truck_no = data.get('truckNo')
            truck_name = data.get('truckName')
            
            if not truck_no or not truck_name:
                return JsonResponse({"error": "truckNo and truckName are required"}, status=400)
            
            # Check if truck number already exists
            if DeliveryTruck.objects.filter(truckNo=truck_no).exists():
                return JsonResponse({"error": "Truck number already exists"}, status=400)
            
            truck = DeliveryTruck.objects.create(
                truckNo=truck_no,
                truckName=truck_name
            )
            
            return JsonResponse({
                "success": True,
                "message": "Truck created successfully",
                "truck": {
                    "id": truck.id,
                    "truckNo": truck.truckNo,
                    "truckName": truck.truckName,
                }
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    def put(self, request, truck_id):
        """
        Update an existing truck
        """
        try:
            truck = DeliveryTruck.objects.get(id=truck_id)
            data = request.data
            
            if 'truckNo' in data:
                # Check if new truck number already exists for other trucks
                if DeliveryTruck.objects.filter(truckNo=data['truckNo']).exclude(id=truck_id).exists():
                    return JsonResponse({"error": "Truck number already exists"}, status=400)
                truck.truckNo = data['truckNo']
            
            if 'truckName' in data:
                truck.truckName = data['truckName']
            
            truck.save()
            
            return JsonResponse({
                "success": True,
                "message": "Truck updated successfully",
                "truck": {
                    "id": truck.id,
                    "truckNo": truck.truckNo,
                    "truckName": truck.truckName,
                }
            })
        except DeliveryTruck.DoesNotExist:
            return JsonResponse({"error": "Truck not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    def delete(self, request, truck_id):
        """
        Delete a truck
        """
        try:
            truck = DeliveryTruck.objects.get(id=truck_id)
            
            # Check if truck is being used in any delivery sheet
            if DeliverySheet.objects.filter(truck=truck).exists():
                return JsonResponse({"error": "Cannot delete truck as it is being used in delivery sheets"}, status=400)
            
            truck.delete()
            
            return JsonResponse({
                "success": True,
                "message": "Truck deleted successfully"
            })
        except DeliveryTruck.DoesNotExist:
            return JsonResponse({"error": "Truck not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


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
                return JsonResponse({
                    "id": driver.id,
                    "driverLicense": driver.driverLicense,
                    "driverName": driver.driverName,
                    "user": {
                        "id": driver.user.id if driver.user else None,
                        "username": driver.user.username if driver.user else None,
                        "email": driver.user.email if driver.user else None,
                        "first_name": driver.user.first_name if driver.user else None,
                        "last_name": driver.user.last_name if driver.user else None,
                        "is_active": driver.user.is_active if driver.user else None,
                    } if driver.user else None
                })
            else:
                drivers = DeliveryDriver.objects.all()
                drivers_data = []
                for driver in drivers:
                    drivers_data.append({
                        "id": driver.id,
                        "driverLicense": driver.driverLicense,
                        "driverName": driver.driverName,
                        "user": {
                            "id": driver.user.id if driver.user else None,
                            "username": driver.user.username if driver.user else None,
                            "email": driver.user.email if driver.user else None,
                            "first_name": driver.user.first_name if driver.user else None,
                            "last_name": driver.user.last_name if driver.user else None,
                            "is_active": driver.user.is_active if driver.user else None,
                        } if driver.user else None
                    })
                return JsonResponse({"drivers": drivers_data})
        except DeliveryDriver.DoesNotExist:
            return JsonResponse({"error": "Driver not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    def post(self, request):
        """
        Create a new driver with user account
        """
        try:
            data = request.data
            driver_license = data.get('driverLicense')
            username = data.get('username')
            email = data.get('email')
            first_name = data.get('first_name')
            last_name = data.get('last_name')
            password = data.get('password')
            
            if not all([driver_license, username, email, first_name, last_name, password]):
                return JsonResponse({"error": "All fields are required: driverLicense, username, email, first_name, last_name, password"}, status=400)
            
            # Check if driver license already exists
            if DeliveryDriver.objects.filter(driverLicense=driver_license).exists():
                return JsonResponse({"error": "Driver license already exists"}, status=400)
            
            # Check if username already exists
            if User.objects.filter(username=username).exists():
                return JsonResponse({"error": "Username already exists"}, status=400)
            
            # Check if email already exists
            if User.objects.filter(email=email).exists():
                return JsonResponse({"error": "Email already exists"}, status=400)
            
            with transaction.atomic():
                # Create user
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    password=password
                )
                
                # Add user to "Truck Driver" group
                truck_driver_group, created = Group.objects.get_or_create(name='Truck Driver')
                user.groups.add(truck_driver_group)
                
                # Create driver
                driver = DeliveryDriver.objects.create(
                    user=user,
                    driverLicense=driver_license
                )

                ModulePermissions.objects.create(
                    user=user,
                    delivery=True
                )

                return JsonResponse({
                    "success": True,
                    "message": "Driver created successfully",
                    "driver": {
                        "id": driver.id,
                        "driverLicense": driver.driverLicense,
                        "driverName": driver.driverName,
                        "user": {
                            "id": user.id,
                            "username": user.username,
                            "email": user.email,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                            "is_active": user.is_active,
                        }
                    }
                })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    def put(self, request, driver_id):
        """
        Update an existing driver
        """
        try:
            driver = DeliveryDriver.objects.get(id=driver_id)
            data = request.data
            
            with transaction.atomic():
                if 'driverLicense' in data:
                    # Check if new driver license already exists for other drivers
                    if DeliveryDriver.objects.filter(driverLicense=data['driverLicense']).exclude(id=driver_id).exists():
                        return JsonResponse({"error": "Driver license already exists"}, status=400)
                    driver.driverLicense = data['driverLicense']
                
                # Update user information if provided
                if driver.user:
                    user = driver.user
                    
                    if 'username' in data:
                        # Check if new username already exists for other users
                        if User.objects.filter(username=data['username']).exclude(id=user.id).exists():
                            return JsonResponse({"error": "Username already exists"}, status=400)
                        user.username = data['username']
                    
                    if 'email' in data:
                        # Check if new email already exists for other users
                        if User.objects.filter(email=data['email']).exclude(id=user.id).exists():
                            return JsonResponse({"error": "Email already exists"}, status=400)
                        user.email = data['email']
                    
                    if 'first_name' in data:
                        user.first_name = data['first_name']
                    
                    if 'last_name' in data:
                        user.last_name = data['last_name']
                    
                    if 'password' in data and data['password']:
                        user.set_password(data['password'])
                    
                    if 'is_active' in data:
                        user.is_active = data['is_active']
                    
                    user.save()
                
                driver.save()
                
                return JsonResponse({
                    "success": True,
                    "message": "Driver updated successfully",
                    "driver": {
                        "id": driver.id,
                        "driverLicense": driver.driverLicense,
                        "driverName": driver.driverName,
                        "user": {
                            "id": driver.user.id if driver.user else None,
                            "username": driver.user.username if driver.user else None,
                            "email": driver.user.email if driver.user else None,
                            "first_name": driver.user.first_name if driver.user else None,
                            "last_name": driver.user.last_name if driver.user else None,
                            "is_active": driver.user.is_active if driver.user else None,
                        } if driver.user else None
                    }
                })
        except DeliveryDriver.DoesNotExist:
            return JsonResponse({"error": "Driver not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    def delete(self, request, driver_id):
        """
        Delete a driver and their user account
        """
        try:
            driver = DeliveryDriver.objects.get(id=driver_id)
            
            # Check if driver is being used in any delivery sheet
            if DeliverySheet.objects.filter(driver=driver).exists():
                return JsonResponse({"error": "Cannot delete driver as they are assigned to delivery sheets"}, status=400)
            
            with transaction.atomic():
                user = driver.user
                driver.delete()
                
                # Delete the associated user account if it exists
                if user:
                    user.delete()
                
                return JsonResponse({
                    "success": True,
                    "message": "Driver deleted successfully"
                })
        except DeliveryDriver.DoesNotExist:
            return JsonResponse({"error": "Driver not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

