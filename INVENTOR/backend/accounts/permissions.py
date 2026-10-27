
from rest_framework.permissions import BasePermission, SAFE_METHODS


class RoleBasedPermission(BasePermission):
    """
    Enforce explicitly configured role permissions for each API action.
    Actions without configured roles are denied by default.
    """

    message = "Your role does not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        role_permissions = getattr(view, "role_permissions", {})
        action = getattr(view, "action", None)

        # Support APIView classes that do not define a ViewSet action.
        if action is None:
            action = request.method.lower()

        allowed_roles = role_permissions.get(action, set())
        return user.role in allowed_roles

    def has_object_permission(self, request, view, obj):
        # Reuse the action-level role check.
        return self.has_permission(request, view)


class AuditLogPermission(BasePermission):
    """
    Allow only administrators and auditors to read audit logs.
    Prevent modification of audit logs through the API.
    """

    message = "Only administrators and auditors may access audit logs."

    allowed_roles = {"ADMIN", "AUDITOR"}

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.role not in self.allowed_roles:
            return False

        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        # Use the correct method signature.
        return self.has_permission(request, view)
