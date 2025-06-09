from rest_framework import permissions

class BaseRolePermission(permissions.BasePermission):
    """
    Base permission class to check user role from the Salesman model.
    """
    required_role = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if the user has a related Salesman profile with the required role
        try:
            salesman_profile = request.user.salesmen.get() # Using related_name 'salesmen'
            return salesman_profile.user_type == self.required_role
        except Exception:
            return False

class IsAdmin(BaseRolePermission):
    """
    Allows access only to users with the 'admin' user_type.
    """
    required_role = 'admin'

class IsSalesman(BaseRolePermission):
    """
    Allows access only to users with the 'salesman' user_type.
    """
    required_role = 'salesman'