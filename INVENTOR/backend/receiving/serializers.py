
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import GoodsReceipt, GoodsReceiptLine


class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    description = serializers.CharField(
        source="purchase_order_item.description",
        read_only=True,
    )

    inventory_item_id = serializers.IntegerField(
        source="purchase_order_item.inventory_item_id",
        read_only=True,
        allow_null=True,
    )

    inventory_item_name = serializers.CharField(
        source="purchase_order_item.inventory_item.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = GoodsReceiptLine
        fields = [
            "id",
            "purchase_order_item",
            "description",
            "inventory_item_id",
            "inventory_item_name",
            "quantity_received",
            "stock_posted",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "description",
            "inventory_item_id",
            "inventory_item_name",
            "stock_posted",
            "created_at",
        ]

    def validate_quantity_received(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Quantity received must be greater than zero."
            )

        return value


class GoodsReceiptSerializer(serializers.ModelSerializer):
    purchase_order_number = serializers.CharField(
        source="purchase_order.order_number",
        read_only=True,
    )

    supplier_name = serializers.CharField(
        source="purchase_order.supplier.name",
        read_only=True,
    )

    received_by_username = serializers.CharField(
        source="received_by.username",
        read_only=True,
        allow_null=True,
    )

    inspected_by_username = serializers.CharField(
        source="inspected_by.username",
        read_only=True,
        allow_null=True,
    )

    lines = GoodsReceiptLineSerializer(
        many=True,
        required=False,
    )

    class Meta:
        model = GoodsReceipt

        fields = [
            "id",
            "receipt_number",
            "purchase_order",
            "purchase_order_number",
            "supplier_name",
            "delivery_date",
            "quantity_received",
            "status",
            "notes",
            "received_by",
            "received_by_username",
            "inspected_by",
            "inspected_by_username",
            "lines",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "receipt_number",
            "received_by",
            "inspected_by",
            "created_at",
            "updated_at",
        ]

    def validate_quantity_received(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Quantity received must be greater than zero."
            )

        return value

    def validate(self, attrs):
        lines = attrs.get("lines")
        instance = self.instance

        # A new goods receipt must contain at least one line.
        if instance is None and not lines:
            raise serializers.ValidationError({
                "lines": "At least one receipt line is required."
            })

        # Do not allow a receipt's purchase order to be changed
        # after the receipt has been created.
        if instance is not None:
            new_purchase_order = attrs.get(
                "purchase_order",
                instance.purchase_order,
            )

            if new_purchase_order.pk != instance.purchase_order_id:
                raise serializers.ValidationError({
                    "purchase_order": (
                        "The purchase order cannot be changed "
                        "after a goods receipt has been created."
                    )
                })

        # Validate submitted receipt lines.
        if lines is not None:
            if not lines:
                raise serializers.ValidationError({
                    "lines": "At least one receipt line is required."
                })

            purchase_order = attrs.get("purchase_order")

            if purchase_order is None and instance is not None:
                purchase_order = instance.purchase_order

            if purchase_order is None:
                raise serializers.ValidationError({
                    "purchase_order": "A purchase order is required."
                })

            # Prevent the same purchase-order item from appearing
            # more than once in one receipt.
            item_ids = [
                line["purchase_order_item"].pk
                for line in lines
            ]

            if len(item_ids) != len(set(item_ids)):
                raise serializers.ValidationError({
                    "lines": (
                        "Each purchase-order item may appear only once "
                        "in a receipt."
                    )
                })

            # Ensure every line belongs to the selected purchase order.
            for line in lines:
                order_item = line["purchase_order_item"]

                if order_item.purchase_order_id != purchase_order.pk:
                    raise serializers.ValidationError({
                        "lines": (
                            f"Purchase-order item {order_item.pk} "
                            "does not belong to the selected "
                            "purchase order."
                        )
                    })

            total_quantity = sum(
                (
                    line["quantity_received"]
                    for line in lines
                ),
                start=Decimal("0"),
            )

        elif instance is not None:
            # When updating without submitting lines, validate against
            # the receipt's existing lines.
            total_quantity = sum(
                instance.lines.values_list(
                    "quantity_received",
                    flat=True,
                ),
                start=Decimal("0"),
            )

        else:
            total_quantity = Decimal("0")

        # The receipt total must always match its line quantities.
        expected_quantity = attrs.get(
            "quantity_received",
            instance.quantity_received if instance is not None else None,
        )

        if expected_quantity is not None:
            if total_quantity != expected_quantity:
                raise serializers.ValidationError({
                    "quantity_received": (
                        "The total quantity must equal the sum "
                        "of the receipt line quantities."
                    )
                })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])

        receipt = GoodsReceipt.objects.create(
            **validated_data
        )

        for line_data in lines_data:
            GoodsReceiptLine.objects.create(
                receipt=receipt,
                **line_data,
            )

        return receipt

    @transaction.atomic
    def update(self, instance, validated_data):
        # Receipt lines cannot be changed through this endpoint.
        # Create a separate correction workflow if corrections
        # are required.
        lines_data = validated_data.pop("lines", None)

        if lines_data is not None:
            raise serializers.ValidationError({
                "lines": (
                    "Receipt lines cannot be changed through this "
                    "update endpoint. Create a new receipt if "
                    "corrections are needed."
                )
            })

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        return instance
