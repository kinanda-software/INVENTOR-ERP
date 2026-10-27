from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import RoleBasedPermission

from .models import SupplierInvoice, SupplierPayment, Expense
from .serializers import (
    SupplierInvoiceSerializer,
    SupplierPaymentSerializer,
    ExpenseSerializer,
)


FINANCE_READ_ROLES = {
    "ADMIN",
    "MANAGER",
    "PROCUREMENT",
    "STOREKEEPER",
    "ACCOUNTANT",
    "TRUCKING",
    "AUDITOR",
}

FINANCE_WRITE_ROLES = {
    "ADMIN",
    "ACCOUNTANT",
}


class SupplierInvoiceViewSet(viewsets.ModelViewSet):
    queryset = (
        SupplierInvoice.objects
        .select_related(
            "supplier",
            "purchase_order",
            "goods_receipt",
            "created_by",
        )
        .prefetch_related("payments")
        .all()
    )
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": FINANCE_READ_ROLES,
        "retrieve": FINANCE_READ_ROLES,
        "summary": FINANCE_READ_ROLES,
        "create": FINANCE_WRITE_ROLES,
        "update": FINANCE_WRITE_ROLES,
        "partial_update": FINANCE_WRITE_ROLES,
        "destroy": {"ADMIN"},
    }

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        invoice = self.get_object()

        if invoice.payments.exists():
            raise ValidationError(
                "An invoice with recorded payments cannot be edited."
            )

        serializer.save()

    def perform_destroy(self, instance):
        if instance.payments.exists():
            raise ValidationError(
                "An invoice with recorded payments cannot be deleted."
            )

        instance.delete()

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        invoices = self.get_queryset()
        today = timezone.localdate()

        total_invoiced = (
            invoices.aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        total_paid = (
            SupplierPayment.objects.filter(
                invoice__in=invoices
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )

        outstanding = Decimal("0")
        overdue = Decimal("0")

        for invoice in invoices:
            balance = invoice.balance_due
            if balance > 0:
                outstanding += balance
                if invoice.due_date < today:
                    overdue += balance

        return Response({
            "currency": "TZS",
            "invoice_count": invoices.count(),
            "total_invoiced": str(total_invoiced),
            "total_paid": str(total_paid),
            "outstanding_balance": str(outstanding),
            "overdue_balance": str(overdue),
        })


class SupplierPaymentViewSet(viewsets.ModelViewSet):
    queryset = (
        SupplierPayment.objects
        .select_related("invoice", "invoice__supplier", "created_by")
        .all()
    )
    serializer_class = SupplierPaymentSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": FINANCE_READ_ROLES,
        "retrieve": FINANCE_READ_ROLES,
        "create": FINANCE_WRITE_ROLES,
        "update": FINANCE_WRITE_ROLES,
        "partial_update": FINANCE_WRITE_ROLES,
        "destroy": FINANCE_WRITE_ROLES,
    }

    def create(self, request, *args, **kwargs):
        # Lock the invoice to prevent concurrent payments from
        # exceeding the outstanding balance.
        with transaction.atomic():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            invoice_id = serializer.validated_data["invoice"].pk

            invoice = (
                SupplierInvoice.objects
                .select_for_update()
                .get(pk=invoice_id)
            )

            amount = serializer.validated_data["amount"]
            amount_paid = (
                invoice.payments.aggregate(total=Sum("amount"))["total"]
                or Decimal("0")
            )
            balance = invoice.amount - amount_paid

            if amount > balance:
                raise ValidationError({
                    "amount": (
                        f"Payment exceeds the outstanding balance of "
                        f"{balance} TZS."
                    )
                })

            payment = serializer.save(created_by=request.user)
            output = self.get_serializer(payment)

            return Response(
                output.data,
                status=status.HTTP_201_CREATED,
            )

    def update(self, request, *args, **kwargs):
        raise ValidationError(
            "Recorded payments cannot be edited. Record a correcting "
            "transaction using an approved finance procedure."
        )

    def partial_update(self, request, *args, **kwargs):
        raise ValidationError(
            "Recorded payments cannot be edited. Record a correcting "
            "transaction using an approved finance procedure."
        )

    def destroy(self, request, *args, **kwargs):
        raise ValidationError(
            "Recorded payments cannot be deleted. Record a correcting "
            "transaction using an approved finance procedure."
        )


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("created_by").all()
    serializer_class = ExpenseSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": FINANCE_READ_ROLES,
        "retrieve": FINANCE_READ_ROLES,
        "create": FINANCE_WRITE_ROLES,
        "update": FINANCE_WRITE_ROLES,
        "partial_update": FINANCE_WRITE_ROLES,
        "destroy": {"ADMIN"},
    }

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class FinanceSummaryView(APIView):
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "get": FINANCE_READ_ROLES,
    }

    def get(self, request):
        invoices = SupplierInvoice.objects.all()
        payments = SupplierPayment.objects.all()
        expenses = Expense.objects.all()
        today = timezone.localdate()

        total_invoiced = (
            invoices.aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        total_paid = (
            payments.aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        total_expenses = (
            expenses.aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )

        outstanding = Decimal("0")
        overdue = Decimal("0")

        for invoice in invoices.prefetch_related("payments"):
            balance = invoice.balance_due
            if balance > 0:
                outstanding += balance
                if invoice.due_date < today:
                    overdue += balance

        return Response({
            "currency": "TZS",
            "invoice_count": invoices.count(),
            "payment_count": payments.count(),
            "expense_count": expenses.count(),
            "total_invoiced": str(total_invoiced),
            "total_supplier_payments": str(total_paid),
            "outstanding_balance": str(outstanding),
            "overdue_balance": str(overdue),
            "total_expenses": str(total_expenses),
        })