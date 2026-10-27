
from decimal import Decimal

from rest_framework import serializers

from procurement.models import PurchaseOrder
from receiving.models import GoodsReceipt
from .models import SupplierInvoice, SupplierPayment, Expense


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(
        source="supplier.name",
        read_only=True,
    )
    purchase_order_number = serializers.CharField(
        source="purchase_order.order_number",
        read_only=True,
        allow_null=True,
    )
    goods_receipt_number = serializers.CharField(
        source="goods_receipt.receipt_number",
        read_only=True,
        allow_null=True,
    )
    amount_paid = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    balance_due = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    payment_status = serializers.CharField(read_only=True)

    class Meta:
        model = SupplierInvoice
        fields = [
            "id",
            "invoice_number",
            "supplier",
            "supplier_name",
            "purchase_order",
            "purchase_order_number",
            "goods_receipt",
            "goods_receipt_number",
            "invoice_date",
            "due_date",
            "amount",
            "currency",
            "amount_paid",
            "balance_due",
            "payment_status",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError(
                "Invoice amount must be greater than zero."
            )
        return value

    def validate(self, attrs):
        supplier = attrs.get(
            "supplier",
            getattr(self.instance, "supplier", None),
        )
        purchase_order = attrs.get(
            "purchase_order",
            getattr(self.instance, "purchase_order", None),
        )
        goods_receipt = attrs.get(
            "goods_receipt",
            getattr(self.instance, "goods_receipt", None),
        )
        invoice_date = attrs.get(
            "invoice_date",
            getattr(self.instance, "invoice_date", None),
        )
        due_date = attrs.get(
            "due_date",
            getattr(self.instance, "due_date", None),
        )

        if invoice_date and due_date and due_date < invoice_date:
            raise serializers.ValidationError({
                "due_date": "Due date cannot be earlier than invoice date."
            })

        if purchase_order and supplier:
            if purchase_order.supplier_id != supplier.pk:
                raise serializers.ValidationError({
                    "supplier": (
                        "Supplier must match the purchase order supplier."
                    )
                })

        if goods_receipt:
            if goods_receipt.status != GoodsReceipt.Status.COMPLETED:
                raise serializers.ValidationError({
                    "goods_receipt": (
                        "Only completed goods receipts can be linked "
                        "to a supplier invoice."
                    )
                })

            if purchase_order is None:
                raise serializers.ValidationError({
                    "purchase_order": (
                        "Select the purchase order linked to this receipt."
                    )
                })

            if goods_receipt.purchase_order_id != purchase_order.pk:
                raise serializers.ValidationError({
                    "goods_receipt": (
                        "The goods receipt must belong to the selected "
                        "purchase order."
                    )
                })

            if supplier and goods_receipt.purchase_order.supplier_id != supplier.pk:
                raise serializers.ValidationError({
                    "supplier": (
                        "Supplier must match the goods receipt supplier."
                    )
                })

        return attrs


class SupplierPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source="invoice.invoice_number",
        read_only=True,
    )

    class Meta:
        model = SupplierPayment
        fields = [
            "id",
            "invoice",
            "invoice_number",
            "payment_reference",
            "amount",
            "payment_date",
            "payment_method",
            "notes",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]

    def validate_amount(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError(
                "Payment amount must be greater than zero."
            )
        return value


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = [
            "id",
            "expense_number",
            "category",
            "description",
            "amount",
            "expense_date",
            "currency",
            "payment_method",
            "reference",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError(
                "Expense amount must be greater than zero."
            )
        return value
