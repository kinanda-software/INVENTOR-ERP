
from django.conf import settings
from django.db import models


class InventoryItem(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    unit_of_measure = models.CharField(max_length=30, default="pcs")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    category = models.CharField(max_length=100, default="Other")
    warehouse = models.CharField(
        max_length=100,
        default="Main Warehouse",
    )
    reorder_level = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=10,
    )
    unit_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
    )
    supplier = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class StockBalance(models.Model):
    item = models.OneToOneField(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="stock_balance",
    )
    quantity_on_hand = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["item__name"]

    def __str__(self):
        return f"{self.item.code}: {self.quantity_on_hand}"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        RECEIPT = "RECEIPT", "Goods receipt"
        ISSUE = "ISSUE", "Stock issue"
        ADJUSTMENT = "ADJUSTMENT", "Stock adjustment"

    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    movement_type = models.CharField(
        max_length=20,
        choices=MovementType.choices,
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    reference = models.CharField(max_length=100)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["movement_type", "reference", "item"],
                name="unique_stock_movement_reference_item",
            ),
        ]

    def __str__(self):
        return (
            f"{self.movement_type}: {self.item.code} "
            f"({self.quantity}) - {self.reference}"
        )
