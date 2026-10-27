
from rest_framework import serializers

from .models import GoodsReceipt


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
