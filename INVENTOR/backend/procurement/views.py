
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.permissions import RoleBasedPermission
from .models import Supplier, PurchaseOrder, PurchaseOrderItem
from .serializers import (
    SupplierSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderItemSerializer,
)


# Read-only access for the roles that need to see procurement records.
PROCUREMENT_READ_ROLES = {
    "ADMIN",
    "MANAGER",
    "PROCUREMENT",
    "STOREKEEPER",
    "ACCOUNTANT",
    "TRUCKING",
    "AUDITOR",
}

# Only procurement officers and administrators manage supplier records.
PROCUREMENT_EDIT_ROLES = {"ADMIN", "PROCUREMENT"}


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by("name")
    serializer_class = SupplierSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": PROCUREMENT_READ_ROLES,
        "retrieve": PROCUREMENT_READ_ROLES,
        "create": PROCUREMENT_EDIT_ROLES,
        "update": PROCUREMENT_EDIT_ROLES,
        "partial_update": PROCUREMENT_EDIT_ROLES,
        "destroy": PROCUREMENT_EDIT_ROLES,
        "metadata": PROCUREMENT_READ_ROLES,
    }


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = (
        PurchaseOrder.objects
        .select_related("supplier", "created_by", "approved_by")
        .prefetch_related("items")
        .order_by("-created_at")
    )
    serializer_class = PurchaseOrderSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": PROCUREMENT_READ_ROLES,
        "retrieve": PROCUREMENT_READ_ROLES,
        "create": PROCUREMENT_EDIT_ROLES,
        "update": PROCUREMENT_EDIT_ROLES,
        "partial_update": PROCUREMENT_EDIT_ROLES,
        "destroy": PROCUREMENT_EDIT_ROLES,
        "submit": PROCUREMENT_EDIT_ROLES,
        "approve": {"ADMIN", "MANAGER"},
        "metadata": PROCUREMENT_READ_ROLES,
    }

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        order = self.get_object()

        if order.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError(
                "Only draft purchase orders can be edited."
            )

        serializer.save()

    def perform_destroy(self, instance):
        if instance.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError(
                "Only draft purchase orders can be deleted."
            )

        instance.delete()

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def submit(self, request, pk=None):
        order = self.get_object()

        if order.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError(
                "Only draft purchase orders can be submitted."
            )

        if not order.items.exists():
            raise ValidationError(
                "A purchase order must contain at least one item before submission."
            )

        order.status = PurchaseOrder.Status.PENDING
        order.save(update_fields=["status", "updated_at"])

        return Response(
            PurchaseOrderSerializer(
                order,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def approve(self, request, pk=None):
        order = self.get_object()

        if order.status != PurchaseOrder.Status.PENDING:
            raise ValidationError(
                "Only pending purchase orders can be approved."
            )

        if order.created_by_id == request.user.id:
            raise ValidationError(
                "You cannot approve your own purchase order."
            )

        order.status = PurchaseOrder.Status.APPROVED
        order.approved_by = request.user
        order.save(
            update_fields=["status", "approved_by", "updated_at"]
        )

        return Response(
            PurchaseOrderSerializer(
                order,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )


class PurchaseOrderItemViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrderItem.objects.select_related(
        "purchase_order"
    ).order_by("id")
    serializer_class = PurchaseOrderItemSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": PROCUREMENT_READ_ROLES,
        "retrieve": PROCUREMENT_READ_ROLES,
        "create": PROCUREMENT_EDIT_ROLES,
        "update": PROCUREMENT_EDIT_ROLES,
        "partial_update": PROCUREMENT_EDIT_ROLES,
        "destroy": PROCUREMENT_EDIT_ROLES,
        "metadata": PROCUREMENT_READ_ROLES,
    }

    def perform_create(self, serializer):
        order = serializer.validated_data["purchase_order"]

        if order.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError(
                "Items can only be added to draft purchase orders."
            )

        serializer.save()

    def perform_update(self, serializer):
        item = self.get_object()

        if item.purchase_order.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError(
                "Items on non-draft purchase orders cannot be edited."
            )

        serializer.save()

    def perform_destroy(self, instance):
        if instance.purchase_order.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError(
                "Items on non-draft purchase orders cannot be deleted."
            )

        instance.delete()
