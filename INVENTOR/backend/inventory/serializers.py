
from rest_framework import serializers

from .models import InventoryItem, StockBalance, StockMovement


class InventoryItemSerializer(serializers.ModelSerializer):
    quantity_on_hand = serializers.DecimalField(
        source="stock_balance.quantity_on_hand",
        max_digits=14,
        decimal_places=2,
        read_only=True,
        default=None,
    )

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "code",
            "name",
            "description",
            "unit_of_measure",
            "is_active",
            "quantity_on_hand",
            "created_at",
            "updated_at",
            "category",
            "warehouse",
            "reorder_level",
            "unit_cost",
            "supplier",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StockBalanceSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = StockBalance
        fields = [
            "id",
            "item",
            "item_code",
            "item_name",
            "quantity_on_hand",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]



class StockMovementSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "item",
            "item_code",
            "item_name",
            "movement_type",
            "quantity",
            "reference",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
        ]
        # Use custom validation to return duplicate errors under "reference".
        validators = []

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Quantity must be greater than zero."
            )
        return value

    def validate(self, attrs):
        item = attrs.get(
            "item",
            getattr(self.instance, "item", None),
        )
        movement_type = attrs.get(
            "movement_type",
            getattr(self.instance, "movement_type", None),
        )
        reference = attrs.get(
            "reference",
            getattr(self.instance, "reference", None),
        )

        if item is not None and movement_type and reference:
            duplicate_movements = StockMovement.objects.filter(
                item=item,
                movement_type=movement_type,
                reference=reference,
            )

            if self.instance is not None:
                duplicate_movements = duplicate_movements.exclude(
                    pk=self.instance.pk
                )

            if duplicate_movements.exists():
                raise serializers.ValidationError({
                    "reference": (
                        "A stock movement with this reference, "
                        "movement type, and item already exists."
                    )
                })

        return attrs
