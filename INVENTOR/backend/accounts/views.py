
from django.db import transaction
from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated

from accounts.models import User
from accounts.serializers import UserSerializer


class IsAdministratorRole(BasePermission):
    message = "Only administrators can manage user accounts."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == User.Role.ADMIN
        )


class UserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdministratorRole]

    def ensure_another_active_admin_exists(self, user):
        """Prevent removing the final active administrator."""
        if user.role != User.Role.ADMIN or not user.is_active:
            return

        another_admin_exists = User.objects.filter(
            role=User.Role.ADMIN,
            is_active=True,
        ).exclude(pk=user.pk).exists()

        if not another_admin_exists:
            raise ValidationError({
                "detail": (
                    "You cannot deactivate or demote the last active "
                    "administrator. Activate another administrator first."
                )
            })

    @transaction.atomic
    def perform_update(self, serializer):
        current_user = serializer.instance
        new_role = serializer.validated_data.get(
            "role", current_user.role
        )
        new_is_active = serializer.validated_data.get(
            "is_active", current_user.is_active
        )

        # Check whether this update would remove the user's
        # active administrator status.
        if (
            current_user.role == User.Role.ADMIN
            and current_user.is_active
            and (new_role != User.Role.ADMIN or not new_is_active)
        ):
            self.ensure_another_active_admin_exists(current_user)

        serializer.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        # DELETE deactivates the account instead of deleting its history.
        self.ensure_another_active_admin_exists(instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
