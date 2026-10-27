from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from procurement.models import Supplier, PurchaseOrder
from finance.models import SupplierInvoice, SupplierPayment

User = get_user_model()


class FinanceAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
    username="finance_test_user",
    password="TestPassword123!",
    role="ACCOUNTANT",
)
        self.client.force_authenticate(user=self.user)

        self.supplier = Supplier.objects.create(
            name="Finance Test Supplier",
            supplier_code="SUP-FIN-001",
        )

        self.order = PurchaseOrder.objects.create(
            order_number="PO-FIN-001",
            supplier=self.supplier,
            order_date=date.today(),
            created_by=self.user,
        )

        self.invoice = SupplierInvoice.objects.create(
            invoice_number="INV-FIN-001",
            supplier=self.supplier,
            purchase_order=self.order,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            amount=Decimal("100000.00"),
            created_by=self.user,
        )

    def test_invoice_defaults_to_tzs(self):
        self.assertEqual(self.invoice.currency, "TZS")

    def test_invoice_balance_is_calculated(self):
        self.assertEqual(
            self.invoice.amount_paid,
            Decimal("0"),
        )
        self.assertEqual(
            self.invoice.balance_due,
            Decimal("100000.00"),
        )

    def test_partial_payment_updates_invoice_balance(self):
        response = self.client.post(
            reverse("supplier-payment-list"),
            {
                "invoice": self.invoice.pk,
                "payment_reference": "PAY-FIN-001",
                "amount": "40000.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "BANK",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.invoice.refresh_from_db()

        self.assertEqual(
            self.invoice.amount_paid,
            Decimal("40000.00"),
        )
        self.assertEqual(
            self.invoice.balance_due,
            Decimal("60000.00"),
        )
        self.assertEqual(
            self.invoice.payment_status,
            "PART_PAID",
        )

    def test_partially_paid_overdue_invoice_status(self):
        self.invoice.due_date = date.today() - timedelta(days=1)
        self.invoice.save()

        SupplierPayment.objects.create(
            invoice=self.invoice,
            payment_reference="PAY-OVERDUE-001",
            amount=Decimal("40000.00"),
            payment_date=date.today() - timedelta(days=2),
            payment_method="BANK",
            created_by=self.user,
        )

        self.assertEqual(
            self.invoice.balance_due,
            Decimal("60000.00"),
        )
        self.assertEqual(
            self.invoice.payment_status,
            "OVERDUE",
        )

    def test_payment_cannot_exceed_invoice_balance(self):
        response = self.client.post(
            reverse("supplier-payment-list"),
            {
                "invoice": self.invoice.pk,
                "payment_reference": "PAY-FIN-002",
                "amount": "120000.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "CASH",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.invoice.payments.count(), 0)

    def test_invoice_endpoint_creates_invoice(self):
        response = self.client.post(
            reverse("supplier-invoice-list"),
            {
                "invoice_number": "INV-FIN-002",
                "supplier": self.supplier.pk,
                "purchase_order": self.order.pk,
                "invoice_date": date.today().isoformat(),
                "due_date": (
                    date.today() + timedelta(days=14)
                ).isoformat(),
                "amount": "250000.00",
                "notes": "Test invoice",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            SupplierInvoice.objects.filter(
                supplier=self.supplier,
                invoice_number="INV-FIN-002",
            ).exists()
        )

    def test_finance_summary_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(
            reverse("finance-summary")
        )

        self.assertEqual(response.status_code, 401)

    def test_finance_summary_returns_tzs_totals(self):
        response = self.client.get(
            reverse("finance-summary")
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["currency"], "TZS")
        self.assertEqual(response.data["invoice_count"], 1)
        self.assertEqual(response.data["payment_count"], 0)
        self.assertEqual(response.data["expense_count"], 0)

        self.assertEqual(
            response.data["total_invoiced"],
            "100000.00",
        )
        self.assertEqual(
            response.data["total_supplier_payments"],
            "0",
        )
        self.assertEqual(
            response.data["outstanding_balance"],
            "100000.00",
        )
        self.assertEqual(
            response.data["overdue_balance"],
            "0",
        )
        self.assertEqual(
            response.data["total_expenses"],
            "0",
        )

    def test_auditor_cannot_create_invoice(self):
        auditor = User.objects.create_user(
            username="finance_auditor_invoice",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.post(
            reverse("supplier-invoice-list"),
            {
                "invoice_number": "INV-AUDIT-001",
                "supplier": self.supplier.pk,
                "purchase_order": self.order.pk,
                "invoice_date": date.today().isoformat(),
                "due_date": (
                    date.today() + timedelta(days=14)
                ).isoformat(),
                "amount": "25000.00",
                "notes": "Unauthorized invoice attempt",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(
            SupplierInvoice.objects.filter(
                invoice_number="INV-AUDIT-001"
            ).exists()
        )

    def test_auditor_cannot_record_supplier_payment(self):
        auditor = User.objects.create_user(
            username="finance_auditor_payment",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.post(
            reverse("supplier-payment-list"),
            {
                "invoice": self.invoice.pk,
                "payment_reference": "PAY-AUDIT-001",
                "amount": "10000.00",
                "payment_date": date.today().isoformat(),
                "payment_method": "BANK",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(
            SupplierPayment.objects.filter(
                payment_reference="PAY-AUDIT-001"
            ).exists()
        )

    def test_auditor_can_read_finance_summary(self):
        auditor = User.objects.create_user(
            username="finance_auditor_summary",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.get(
            reverse("finance-summary")
        )

        self.assertEqual(response.status_code, 200, response.data)


# Create your tests here.
