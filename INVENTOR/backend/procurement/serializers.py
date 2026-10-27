
from rest_framework import serializers

from .models import Supplier, PurchaseOrder, PurchaseOrderItem


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.ReadOnlyField()

    inventory_item_id = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )

    inventory_item_name = serializers.CharField(
        source="inventory_item.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "purchase_order",
            "description",
            "quantity",
            "received_quantity",
            "inventory_item_id",
            "inventory_item_name",
            "unit_of_measure",
            "unit_price",
            "line_total",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "received_quantity",
            "inventory_item_id",
            "inventory_item_name",
            "created_at",
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Quantity must be greater than zero."
            )
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Unit price cannot be negative."
            )
        return value

    def validate(self, attrs):
        purchase_order = attrs.get(
            "purchase_order",
            getattr(self.instance, "purchase_order", None),
        )

        inventory_item = attrs.get(
            "inventory_item",
            getattr(self.instance, "inventory_item", None),
        )

        if inventory_item and not inventory_item.is_active:
            raise serializers.ValidationError({
                "inventory_item": (
                    "Cannot order an inactive inventory item."
                )
            })

        if (
            purchase_order
            and purchase_order.status != PurchaseOrder.Status.DRAFT
        ):
            raise serializers.ValidationError({
                "purchase_order": (
                    "Items can only be added to or changed on draft orders."
                )
            })

        return attrs


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(
        source="supplier.name",
        read_only=True,
    )

    items = PurchaseOrderItemSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "order_number",
            "supplier",
            "supplier_name",
            "order_date",
            "expected_delivery_date",
            "status",
            "notes",
            "created_by",
            "approved_by",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "approved_by",
            "created_at",
            "updated_at",
        ]

    def validate_supplier(self, value):
        if not value.is_active:
            raise serializers.ValidationError(
                "Cannot create an order for an inactive supplier."
            )
        return value
