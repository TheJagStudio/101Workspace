from rest_framework import serializers


class PaymentErrorSerializer(serializers.Serializer):
    """Error response for StampInvoiceView."""
    error = serializers.CharField()


class ZipUrlSerializer(serializers.Serializer):
    """Zip URL response from stampMaker."""
    zipUrl = serializers.CharField()


class StampInvoiceProgressSerializer(serializers.Serializer):
    """Progress item from stampMaker streaming."""
    status = serializers.CharField(required=False)
    customerId = serializers.IntegerField(required=False)
    transactionId = serializers.CharField(required=False)
    data = serializers.DictField(required=False)
    percent = serializers.IntegerField(required=False)
    error = serializers.CharField(required=False)
