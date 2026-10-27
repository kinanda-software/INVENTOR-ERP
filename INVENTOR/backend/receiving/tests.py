
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from procurement.models import (
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
)
from receiving.models import GoodsReceipt, GoodsReceiptLine
from receiving.serializers import GoodsReceiptSerializer


User = get_user_model()


class GoodsReceiptSerializerTests(TestCase):
    def setUp(self):
        # Create a test user.
        self.user = User.objects.create_user(
            username="receiving_test_user",
            password="TestPassword123!",
        )

        # Create a supplier.
        self.supplier = Supplier.objects.create(
            name="Test Supplier",
            supplier_code="SUP-TEST-001",
        )

        # Create a purchase order.
        self.purchase_order = PurchaseOrder.objects.create(
            order_number="PO-TEST-001",
            supplier=self.supplier,
            order_date=date.today(),
            created_by=self.user,
        )

        # Create a purchase-order item.
        self.order_item = PurchaseOrderItem.objects.create(
            purchase_order=self.purchase_order,
            description="Test cement",
            quantity=Decimal("100.00"),
            unit_of_measure="bags",
            unit_price=Decimal("15000.00"),
        )

    def valid_payload(self):
        return {
            "purchase_order": self.purchase_order.pk,
            "delivery_date": date.today().isoformat(),
            "quantity_received": "10.00",
            "notes": "Test delivery",
            "lines": [
                {
                    "purchase_order_item": self.order_item.pk,
                    "quantity_received": "10.00",
                }
            ],
        }

    def test_valid_receipt_passes_validation(self):
        serializer = GoodsReceiptSerializer(
            data=self.valid_payload()
        )

        self.assertTrue(
            serializer.is_valid(),
            msg=str(serializer.errors),
        )

    def test_receipt_without_lines_is_rejected(self):
        payload = self.valid_payload()
        payload.pop("lines")

        serializer = GoodsReceiptSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("lines", serializer.errors)

    def test_empty_lines_are_rejected(self):
        payload = self.valid_payload()
        payload["lines"] = []

        serializer = GoodsReceiptSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("lines", serializer.errors)

    def test_mismatched_receipt_total_is_rejected(self):
        payload = self.valid_payload()
        payload["quantity_received"] = "15.00"

        serializer = GoodsReceiptSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("quantity_received", serializer.errors)

    def test_duplicate_purchase_order_items_are_rejected(self):
        payload = self.valid_payload()
        payload["quantity_received"] = "20.00"
        payload["lines"] = [
            {
                "purchase_order_item": self.order_item.pk,
                "quantity_received": "10.00",
            },
            {
                "purchase_order_item": self.order_item.pk,
                "quantity_received": "10.00",
            },
        ]

        serializer = GoodsReceiptSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("lines", serializer.errors)

    def test_item_from_another_purchase_order_is_rejected(self):
        other_order = PurchaseOrder.objects.create(
            order_number="PO-TEST-002",
            supplier=self.supplier,
            order_date=date.today(),
            created_by=self.user,
        )

        other_item = PurchaseOrderItem.objects.create(
            purchase_order=other_order,
            description="Test steel",
            quantity=Decimal("50.00"),
            unit_of_measure="pcs",
            unit_price=Decimal("25000.00"),
        )

        payload = self.valid_payload()
        payload["lines"] = [
            {
                "purchase_order_item": other_item.pk,
                "quantity_received": "10.00",
            }
        ]

        serializer = GoodsReceiptSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("lines", serializer.errors)

    def test_receipt_can_be_created_with_valid_lines(self):
        serializer = GoodsReceiptSerializer(
            data=self.valid_payload()
        )

        self.assertTrue(
            serializer.is_valid(),
            msg=str(serializer.errors),
        )

        receipt = serializer.save(received_by=self.user)

        self.assertTrue(
            GoodsReceipt.objects.filter(pk=receipt.pk).exists()
        )

        self.assertEqual(receipt.quantity_received, Decimal("10.00"))

        self.assertEqual(receipt.lines.count(), 1)

        receipt_line = receipt.lines.get()

        self.assertEqual(
            receipt_line.purchase_order_item_id,
            self.order_item.pk,
        )

        self.assertEqual(
            receipt_line.quantity_received,
            Decimal("10.00"),
        )

        self.assertFalse(receipt_line.stock_posted)

    def test_update_with_mismatched_total_is_rejected(self):
        receipt = GoodsReceipt.objects.create(
            receipt_number="GRN-TEST-001",
            purchase_order=self.purchase_order,
            delivery_date=date.today(),
            quantity_received=Decimal("10.00"),
            received_by=self.user,
        )

        GoodsReceiptLine.objects.create(
            receipt=receipt,
            purchase_order_item=self.order_item,
            quantity_received=Decimal("10.00"),
        )

        serializer = GoodsReceiptSerializer(
            instance=receipt,
            data={"quantity_received": "15.00"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("quantity_received", serializer.errors)

    def test_purchase_order_cannot_be_changed_on_update(self):
        other_order = PurchaseOrder.objects.create(
            order_number="PO-TEST-003",
            supplier=self.supplier,
            order_date=date.today(),
            created_by=self.user,
        )

        receipt = GoodsReceipt.objects.create(
            receipt_number="GRN-TEST-002",
            purchase_order=self.purchase_order,
            delivery_date=date.today(),
            quantity_received=Decimal("10.00"),
            received_by=self.user,
        )

        GoodsReceiptLine.objects.create(
            receipt=receipt,
            purchase_order_item=self.order_item,
            quantity_received=Decimal("10.00"),
        )

        serializer = GoodsReceiptSerializer(
            instance=receipt,
            data={"purchase_order": other_order.pk},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("purchase_order", serializer.errors)


# Create your tests here.
