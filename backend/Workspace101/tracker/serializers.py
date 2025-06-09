from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Salesman, LocationPoint, DailyActivity, AdminSettings,
    PlannedRoute, RouteStop, SystemNotification
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']

class SalesmanSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = Salesman
        fields = '__all__'

class AdminSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminSettings
        fields = '__all__'

class SystemNotificationSerializer(serializers.ModelSerializer):
    salesman = SalesmanSerializer(read_only=True)
    class Meta:
        model = SystemNotification
        fields = '__all__'

class DailyActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyActivity
        fields = '__all__'

# For Salesman Views
class RouteStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteStop
        fields = ['id', 'location_name', 'address', 'latitude', 'longitude', 'order', 'status', 'visited_at']

class PlannedRouteReadSerializer(serializers.ModelSerializer):
    stops = RouteStopSerializer(many=True, read_only=True)
    class Meta:
        model = PlannedRoute
        fields = ['id', 'date', 'name', 'status', 'stops']

class RouteStopWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteStop
        fields = ['location_name', 'address', 'latitude', 'longitude', 'order']


class PlannedRouteWriteSerializer(serializers.ModelSerializer):
    stops = RouteStopWriteSerializer(many=True)
    class Meta:
        model = PlannedRoute
        fields = ['date', 'name', 'stops']

# Input-only serializers for validation
class SalesmanStatusUpdateSerializer(serializers.Serializer):
    latitude = serializers.FloatField(required=True)
    longitude = serializers.FloatField(required=True)
    battery = serializers.IntegerField(required=True, min_value=0, max_value=100)

class SalesmanTrackingStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['active', 'offline'], required=True)

class RouteStopStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['visited', 'skipped'], required=True)

class AddRouteStopSerializer(serializers.Serializer):
    location_name = serializers.CharField(max_length=255)
    address = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()