
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class SupplierInvoice(models.Model):
    class PaymentStatus(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        PART_PAID = "PART_PAID", "Partially paid"
        PAID = "PAID", "Paid"
        OVERDUE = "OVERDUE", "Overdue"

    invoice_number = models.CharField(max_length=60)
    supplier = models.ForeignKey(
        "procurement.Supplier",
        on_delete=models.PROTECT,
        related_name="finance_invoices",
    )
    purchase_order = models.ForeignKey(
        "procurement.PurchaseOrder",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="finance_invoices",
    )
    goods_receipt = models.ForeignKey(
        "receiving.GoodsReceipt",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="finance_invoices",
    )
    invoice_date = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="TZS")
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_supplier_invoices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-invoice_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["supplier", "invoice_number"],
                name="unique_supplier_invoice_number",
            ),
        ]

    @property
    def amount_paid(self):
        result = self.payments.aggregate(
            total=Sum("amount")
        )["total"]

        return (
            result
            if result is not None
            else Decimal("0.00")
        )

    @property
    def balance_due(self):
        return self.amount - self.amount_paid

    
    @property
    def payment_status(self):
        if self.balance_due <= 0:
            return self.PaymentStatus.PAID

        if self.due_date < timezone.localdate():
            return self.PaymentStatus.OVERDUE

        if self.amount_paid > 0:
            return self.PaymentStatus.PART_PAID

        return self.PaymentStatus.UNPAID


    def __str__(self):
        return f"{self.invoice_number} - {self.supplier.name}"


class SupplierPayment(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank transfer"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile money"
        CHEQUE = "CHEQUE", "Cheque"
        OTHER = "OTHER", "Other"

    invoice = models.ForeignKey(
        SupplierInvoice,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    payment_reference = models.CharField(max_length=80, unique=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_supplier_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-id"]

    def __str__(self):
        return f"{self.payment_reference} - {self.amount}"


class Expense(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank transfer"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile money"
        CHEQUE = "CHEQUE", "Cheque"
        OTHER = "OTHER", "Other"

    expense_number = models.CharField(max_length=60, unique=True)
    category = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    expense_date = models.DateField()
    currency = models.CharField(max_length=3, default="TZS")
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
    )
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_expenses",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-id"]

    def __str__(self):
        return f"{self.expense_number} - {self.amount} - {self.description}"


# Create your models here.
