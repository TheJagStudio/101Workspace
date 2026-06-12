from rest_framework import serializers
from django.contrib.auth.models import User
from .models import DeliveryDriver, DeliveryTruck, DeliverySheet


class DeliveryUserSerializer(serializers.ModelSerializer):
    """User serializer for delivery context."""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active']


class DeliveryTruckSerializer(serializers.ModelSerializer):
    """Serializer for DeliveryTruck model."""
    class Meta:
        model = DeliveryTruck
        fields = ['id', 'truckNo', 'truckName']


class DeliveryDriverSerializer(serializers.ModelSerializer):
    """Serializer for DeliveryDriver model with nested user info."""
    user = DeliveryUserSerializer(read_only=True)
    driverName = serializers.CharField(read_only=True)

    class Meta:
        model = DeliveryDriver
        fields = ['id', 'user', 'driverLicense', 'driverName']


class DeliverySheetSerializer(serializers.ModelSerializer):
    """Serializer for DeliverySheet model."""
    class Meta:
        model = DeliverySheet
        fields = [
            'id', 'invoice', 'customer', 'box', 'checkAmount', 'cashAmount',
            'payment_status', 'status', 'date', 'truck', 'driver',
            'insertedTimestamp', 'deliveryTimestamp',
        ]


# ---------- Response serializers for views with custom shapes ----------

class DeliveryEntryItemSerializer(serializers.Serializer):
    """Single delivery entry within a truck group."""
    id = serializers.IntegerField()
    invoice = serializers.CharField()
    customer = serializers.CharField()
    customerId = serializers.CharField(allow_null=True)
    customerCompany = serializers.CharField(allow_null=True)
    box = serializers.IntegerField()
    checkAmount = serializers.FloatField(allow_null=True)
    cashAmount = serializers.FloatField(allow_null=True)
    payment_status = serializers.BooleanField()
    status = serializers.BooleanField()
    date = serializers.CharField(allow_null=True)
    driver = serializers.CharField(allow_null=True)
    insertedTimestamp = serializers.CharField(allow_null=True)
    deliveryTimestamp = serializers.CharField(allow_null=True)


class DeliveryTruckGroupSerializer(serializers.Serializer):
    """Truck group containing multiple deliveries."""
    deliveries = DeliveryEntryItemSerializer(many=True)
    truckNo = serializers.CharField(allow_null=True)
    truckName = serializers.CharField(allow_null=True)
    driver = serializers.CharField(allow_null=True)


class DashboardStatsSerializer(serializers.Serializer):
    """Response for DashboardStatsView."""
    date = serializers.CharField()
    stats = serializers.DictField()
    trucks = DeliveryTruckGroupSerializer(many=True)


class InvoiceDetailSerializer(serializers.Serializer):
    """Response for InvoiceDetail GET."""
    id = serializers.CharField()
    invoiceNumber = serializers.CharField()
    customerId = serializers.CharField(allow_null=True)
    customerName = serializers.CharField(allow_null=True)
    caseCount = serializers.IntegerField()
    checkAmount = serializers.FloatField(allow_null=True)
    cashAmount = serializers.FloatField(allow_null=True)
    paymentStatus = serializers.CharField()
    dateCreated = serializers.CharField(allow_null=True)
    dateUpdated = serializers.CharField(allow_null=True)
    status = serializers.CharField()
