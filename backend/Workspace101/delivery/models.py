from django.db import models
from api.models import Customer,Invoice
from django.contrib.auth.models import User 

class DeliveryDriver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='delivery_driver_profile', null=True, blank=True)
    driverLicense = models.CharField(max_length=50)

    @property
    def driverName(self):
        if self.user:
            return f"{self.user.first_name} {self.user.last_name}"
        return "Unknown Driver"

    def __str__(self):
        return self.driverName


class DeliveryTruck(models.Model):
    truckNo = models.CharField(max_length=50)
    truckName = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.truckNo} - {self.truckName}"


class DeliverySheet(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    box = models.IntegerField()
    checkAmount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cashAmount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_status = models.BooleanField(default=False)
    status = models.BooleanField(default=False)
    date = models.DateField()
    truck = models.ForeignKey(DeliveryTruck, on_delete=models.CASCADE)
    driver = models.ForeignKey(DeliveryDriver, on_delete=models.CASCADE, null=True, blank=True)
    insertedTimestamp = models.DateTimeField(null=True, blank=True, auto_now_add=True)
    deliveryTimestamp = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.invoice} - {self.box} pcs"