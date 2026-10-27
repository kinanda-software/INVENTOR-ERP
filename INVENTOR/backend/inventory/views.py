from django.db import IntegrityError, transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import RoleBasedPermission
from audit.models import AuditLog
from audit.services import log_action

from .models import InventoryItem, StockBalance, StockMovement
from .serializers import (
    InventoryItemSerializer,
    StockBalanceSerializer,
    StockMovementSerializer,
)


# Roles allowed to view inventory information.
INVENTORY_READ_ROLES = {
    "ADMIN",
    "MANAGER",
    "PROCUREMENT",
    "STOREKEEPER",
    "ACCOUNTANT",
    "TRUCKING",
    "AUDITOR",
}

# Roles allowed to create or modify inventory items and record stock.
INVENTORY_MANAGE_ROLES = {
    "ADMIN",
    "STOREKEEPER",
}


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.select_related("stock_balance").all()
    serializer_class = InventoryItemSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": INVENTORY_READ_ROLES,
        "retrieve": INVENTORY_READ_ROLES,
        "create": INVENTORY_MANAGE_ROLES,
        "update": INVENTORY_MANAGE_ROLES,
        "partial_update": INVENTORY_MANAGE_ROLES,
        "destroy": {"ADMIN"},
    }

    def perform_create(self, serializer):
        with transaction.atomic():
            item = serializer.save()

            StockBalance.objects.create(
                item=item,
                quantity_on_hand=0,
            )

            log_action(
                actor=self.request.user,
                action=AuditLog.Action.CREATE,
                module="inventory",
                obj=item,
                changes={
                    "code": item.code,
                    "name": item.name,
                    "initial_quantity": "0",
                },
                request=self.request,
            )


class StockBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockBalance.objects.select_related("item").all()
    serializer_class = StockBalanceSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": INVENTORY_READ_ROLES,
        "retrieve": INVENTORY_READ_ROLES,
    }


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related(
        "item", "created_by"
    ).all()
    serializer_class = StockMovementSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": INVENTORY_READ_ROLES,
        "retrieve": INVENTORY_READ_ROLES,
        "record": INVENTORY_MANAGE_ROLES,
    }

    @action(detail=False, methods=["post"], url_path="record")
    def record(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item = serializer.validated_data["item"]
        movement_type = serializer.validated_data["movement_type"]
        quantity = serializer.validated_data["quantity"]
        reference = serializer.validated_data["reference"]

        if movement_type not in [
            StockMovement.MovementType.RECEIPT,
            StockMovement.MovementType.ISSUE,
        ]:
            raise ValidationError({
                "movement_type": "Use RECEIPT or ISSUE."
            })

        try:
            with transaction.atomic():
                try:
                    balance = (
                        StockBalance.objects
                        .select_for_update()
                        .get(item=item)
                    )
                except StockBalance.DoesNotExist:
                    raise ValidationError({
                        "item": "This item has no stock balance."
                    })

                quantity_before = balance.quantity_on_hand

                if (
                    movement_type == StockMovement.MovementType.ISSUE
                    and quantity > quantity_before
                ):
                    raise ValidationError({
                        "quantity": (
                            f"Insufficient stock. Available: "
                            f"{quantity_before}."
                        )
                    })

                if movement_type == StockMovement.MovementType.RECEIPT:
                    balance.quantity_on_hand += quantity
                    audit_action = AuditLog.Action.STOCK_RECEIPT
                else:
                    balance.quantity_on_hand -= quantity
                    audit_action = AuditLog.Action.STOCK_ISSUE

                movement = serializer.save(created_by=request.user)

                balance.save(
                    update_fields=["quantity_on_hand", "updated_at"]
                )

                log_action(
                    actor=request.user,
                    action=audit_action,
                    module="inventory",
                    obj=movement,
                    changes={
                        "item_code": item.code,
                        "item_name": item.name,
                        "movement_type": movement_type,
                        "quantity": str(quantity),
                        "quantity_before": str(quantity_before),
                        "quantity_after": str(balance.quantity_on_hand),
                        "reference": reference,
                    },
                    request=request,
                )

        except IntegrityError:
            duplicate_exists = StockMovement.objects.filter(
                item=item,
                movement_type=movement_type,
                reference=reference,
            ).exists()

            if duplicate_exists:
                raise ValidationError({
                    "reference": (
                        "A stock movement with this reference already "
                        "exists for this item and movement type."
                    )
                })

            # Do not hide unrelated database integrity errors.
            raise

        return Response(
            {
                "movement": serializer.data,
                "quantity_on_hand": str(balance.quantity_on_hand),
            },
            status=status.HTTP_201_CREATED,
        )
