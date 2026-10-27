
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework import serializers, viewsets

from accounts.permissions import RoleBasedPermission
from inventory.models import StockBalance, StockMovement
from procurement.models import PurchaseOrderItem
from .models import GoodsReceipt, GoodsReceiptLine
from .serializers import GoodsReceiptSerializer


class GoodsReceiptViewSet(viewsets.ModelViewSet):
    queryset = (
        GoodsReceipt.objects
        .select_related(
            "purchase_order",
            "purchase_order__supplier",
            "received_by",
            "inspected_by",
        )
        .prefetch_related("lines")
        .all()
    )

    serializer_class = GoodsReceiptSerializer
    permission_classes = [RoleBasedPermission]

    # Roles allowed to view goods receipts.
    RECEIPT_READ_ROLES = {
        "ADMIN",
        "MANAGER",
        "PROCUREMENT",
        "STOREKEEPER",
        "ACCOUNTANT",
        "TRUCKING",
        "AUDITOR",
    }

    # Only Storekeepers and Administrators can manage receipts.
    RECEIPT_MANAGE_ROLES = {
        "ADMIN",
        "STOREKEEPER",
    }

    # Only explicitly configured actions are permitted.
    role_permissions = {
        "list": RECEIPT_READ_ROLES,
        "retrieve": RECEIPT_READ_ROLES,
        "create": RECEIPT_MANAGE_ROLES,
        "update": RECEIPT_MANAGE_ROLES,
        "partial_update": RECEIPT_MANAGE_ROLES,
        "destroy": {"ADMIN"},
        "metadata": RECEIPT_READ_ROLES,
    }

    def perform_create(self, serializer):
        # New receipts must start pending inspection.
        if serializer.validated_data.get("status") in [
            GoodsReceipt.Status.COMPLETED,
            GoodsReceipt.Status.REJECTED,
        ]:
            raise serializers.ValidationError({
                "status": (
                    "A new goods receipt must start as pending inspection."
                )
            })

        serializer.save(
            received_by=self.request.user,
            status=GoodsReceipt.Status.PENDING_INSPECTION,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        # Lock the receipt while its status is being changed.
        receipt = GoodsReceipt.objects.select_for_update().get(
            pk=serializer.instance.pk
        )

        old_status = receipt.status
        new_status = serializer.validated_data.get("status", old_status)

        # Completed and rejected receipts cannot be reopened.
        if (
            old_status in [
                GoodsReceipt.Status.COMPLETED,
                GoodsReceipt.Status.REJECTED,
            ]
            and new_status != old_status
        ):
            raise serializers.ValidationError({
                "status": (
                    "A completed or rejected receipt cannot be reopened."
                )
            })

        # Save and post stock in the same database transaction.
        if new_status in [
            GoodsReceipt.Status.COMPLETED,
            GoodsReceipt.Status.REJECTED,
        ]:
            receipt = serializer.save(inspected_by=self.request.user)
        else:
            receipt = serializer.save()

        # Stock is posted only when the receipt transitions to COMPLETED.
        if (
            old_status != GoodsReceipt.Status.COMPLETED
            and new_status == GoodsReceipt.Status.COMPLETED
        ):
            self._post_receipt_to_inventory(receipt)

    def _post_receipt_to_inventory(self, receipt):
        """
        Post a completed goods receipt to inventory exactly once.

        Receipt status, stock balances, stock movements, and purchase-order
        received quantities are handled within the same transaction.
        """

        purchase_order = receipt.purchase_order

        # Only approved purchase orders may be received.
        if purchase_order.status != "APPROVED":
            raise serializers.ValidationError({
                "purchase_order": (
                    "Only an approved purchase order can be received. "
                    f"Current status: {purchase_order.status}."
                )
            })

        lines = list(
            GoodsReceiptLine.objects
            .filter(receipt=receipt)
            .order_by("id")
        )

        if not lines:
            raise serializers.ValidationError({
                "lines": (
                    "This receipt has no receipt lines. Add valid receipt "
                    "lines before completing the inspection."
                )
            })

        total_quantity = sum(
            (line.quantity_received for line in lines),
            start=Decimal("0"),
        )

        if total_quantity != receipt.quantity_received:
            raise serializers.ValidationError({
                "quantity_received": (
                    "The receipt quantity must equal the sum of its "
                    "receipt line quantities."
                )
            })

        for receipt_line in lines:
            if receipt_line.stock_posted:
                # Never add stock again for a line already posted.
                continue

            # Lock only the PurchaseOrderItem row to avoid PostgreSQL
            # errors involving the nullable inventory_item relationship.
            order_item = (
                PurchaseOrderItem.objects
                .select_for_update(of=("self",))
                .select_related("purchase_order", "inventory_item")
                .get(pk=receipt_line.purchase_order_item_id)
            )

            if order_item.purchase_order_id != purchase_order.id:
                raise serializers.ValidationError({
                    "lines": (
                        "A receipt line does not belong to this "
                        "purchase order."
                    )
                })

            inventory_item = order_item.inventory_item

            if inventory_item is None:
                raise serializers.ValidationError({
                    "lines": (
                        f"Purchase-order item '{order_item.description}' "
                        "is not linked to an inventory product. Link the "
                        "correct product before completing this receipt."
                    )
                })

            if not inventory_item.is_active:
                raise serializers.ValidationError({
                    "lines": (
                        f"Inventory product '{inventory_item.name}' "
                        "is inactive."
                    )
                })

            if receipt_line.quantity_received <= 0:
                raise serializers.ValidationError({
                    "lines": "Received quantities must be greater than zero."
                })

            already_received = (
                order_item.received_quantity or Decimal("0")
            )
            remaining_quantity = order_item.quantity - already_received

            if receipt_line.quantity_received > remaining_quantity:
                raise serializers.ValidationError({
                    "lines": (
                        f"Cannot receive {receipt_line.quantity_received} "
                        f"for '{order_item.description}'. Only "
                        f"{max(remaining_quantity, Decimal('0'))} "
                        "remains on the purchase order."
                    )
                })

            movement_reference = (
                f"{receipt.receipt_number}-LINE-{receipt_line.id}"
            )

            # Detect an inconsistent previous stock posting.
            movement_exists = StockMovement.objects.filter(
                movement_type=StockMovement.MovementType.RECEIPT,
                reference=movement_reference,
                item=inventory_item,
            ).exists()

            if movement_exists:
                raise serializers.ValidationError({
                    "lines": (
                        f"A stock movement already exists for receipt "
                        f"line {receipt_line.id}, but that line is not "
                        "marked as posted. Investigate this inconsistency "
                        "before retrying."
                    )
                })

            # Lock an existing balance or create the first balance.
            try:
                stock_balance = (
                    StockBalance.objects
                    .select_for_update()
                    .get(item=inventory_item)
                )
            except StockBalance.DoesNotExist:
                stock_balance = StockBalance.objects.create(
                    item=inventory_item,
                    quantity_on_hand=Decimal("0"),
                )

            # Add the accepted quantity to inventory.
            stock_balance.quantity_on_hand += (
                receipt_line.quantity_received
            )
            stock_balance.save(
                update_fields=["quantity_on_hand", "updated_at"]
            )

            # Record the inventory transaction.
            StockMovement.objects.create(
                item=inventory_item,
                movement_type=StockMovement.MovementType.RECEIPT,
                quantity=receipt_line.quantity_received,
                reference=movement_reference,
                notes=(
                    f"Goods receipt {receipt.receipt_number}; "
                    f"purchase order {purchase_order.order_number}."
                ),
                created_by=self.request.user,
            )

            # Update the purchase-order line received quantity.
            order_item.received_quantity = (
                already_received + receipt_line.quantity_received
            )
            order_item.save(update_fields=["received_quantity"])

            # Mark the receipt line as posted.
            receipt_line.stock_posted = True
            receipt_line.save(update_fields=["stock_posted"])

        # Mark the purchase order RECEIVED only when all its items
        # have been fully received.
        all_order_items = PurchaseOrderItem.objects.filter(
            purchase_order=purchase_order
        )

        if (
            all_order_items.exists()
            and not all_order_items.filter(
                received_quantity__lt=F("quantity")
            ).exists()
        ):
            purchase_order.status = "RECEIVED"
            purchase_order.save(update_fields=["status"])
