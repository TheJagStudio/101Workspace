from rest_framework import serializers
from django.contrib.auth.models import User
from api.models import ModulePermissions


class ModulePermissionsSerializer(serializers.ModelSerializer):
    """Serializer for ModulePermissions fields."""
    class Meta:
        model = ModulePermissions
        fields = [
            'purchase', 'tracker', 'delivery', 'catalog', 'accounts',
            'utility', 'supplychain', 'purchase_PO', 'purchase_Inventory',
            'purchase_Settings', 'tracker_Map', 'tracker_History',
            'tracker_Salesmen_List', 'tracker_Global_View', 'tracker_config',
            'tracker_Admin_Profile', 'tracker_Profile', 'utility_sticker',
            'utility_product_sync', 'accounts_invoice', 'delivery_admin',
        ]


class UserInfoSerializer(serializers.Serializer):
    """Serializer for user info response shape."""
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    is_active = serializers.BooleanField()
    permissions = serializers.DictField()
