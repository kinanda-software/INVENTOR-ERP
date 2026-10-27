
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from procurement.models import PurchaseOrder


class GoodsReceipt(models.Model):
    class Status(models.TextChoices):
        PENDING_INSPECTION = "PENDING_INSPECTION", "Pending inspection"
        COMPLETED = "COMPLETED", "Completed"
        REJECTED = "REJECTED", "Rejected"

    receipt_number = models.CharField(
        max_length=40,
        unique=True,
        editable=False,
    )

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name="goods_receipts",
    )

    delivery_date = models.DateField()
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING_INSPECTION,
    )

    notes = models.TextField(blank=True)

    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods_receipts_received",
    )

    inspected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods_receipts_inspected",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            year = timezone.localdate().year
            unique_part = uuid.uuid4().hex[:8].upper()
            self.receipt_number = f"GRN-{year}-{unique_part}"

        super().save(*args, **kwargs)

    def __str__(self):
        return self.receipt_number
