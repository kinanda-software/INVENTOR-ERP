
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.test import TestCase

from rest_framework.test import APIClient

from inventory.models import InventoryItem, StockBalance, StockMovement
from procurement.models import PurchaseOrder, PurchaseOrderItem, Supplier
from receiving.models import GoodsReceipt, GoodsReceiptLine


User = get_user_model()


class GoodsReceiptInventoryPostingTests(TestCase):
    def setUp(self):
        # Receiving operations must be tested using an authorized role.
        self.user = User.objects.create_user(
            username="inventory_posting_test",
            password="TestPassword123!",
            role=User.Role.STOREKEEPER,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.supplier = Supplier.objects.create(
            name="Posting Test Supplier",
            supplier_code="SUP-POST-001",
        )

        self.inventory_item = InventoryItem.objects.create(
            code="ITEM-POST-001",
            name="Test Cement",
            unit_of_measure="bags",
            is_active=True,
        )

        self.purchase_order = PurchaseOrder.objects.create(
            order_number="PO-POST-001",
            supplier=self.supplier,
            order_date=date.today(),
            status=PurchaseOrder.Status.APPROVED,
            created_by=self.user,
            approved_by=self.user,
        )

        self.order_item = PurchaseOrderItem.objects.create(
            purchase_order=self.purchase_order,
            inventory_item=self.inventory_item,
            description="Test Cement",
            quantity=Decimal("100.00"),
            received_quantity=Decimal("0.00"),
            unit_of_measure="bags",
            unit_price=Decimal("15000.00"),
        )

        self.receipt = GoodsReceipt.objects.create(
            purchase_order=self.purchase_order,
            delivery_date=date.today(),
            quantity_received=Decimal("10.00"),
            status=GoodsReceipt.Status.PENDING_INSPECTION,
            received_by=self.user,
        )

        self.receipt_line = GoodsReceiptLine.objects.create(
            receipt=self.receipt,
            purchase_order_item=self.order_item,
            quantity_received=Decimal("10.00"),
        )

        self.receipt_url = reverse(
            "goods-receipt-detail",
            args=[self.receipt.pk],
        )

    def complete_receipt(self):
        return self.client.patch(
            self.receipt_url,
            {"status": GoodsReceipt.Status.COMPLETED},
            format="json",
        )

    def test_completing_receipt_posts_stock_once(self):
        response = self.complete_receipt()

        self.assertEqual(response.status_code, 200, response.data)

        balance = StockBalance.objects.get(item=self.inventory_item)

        self.assertEqual(
            balance.quantity_on_hand,
            Decimal("10.00"),
        )

        self.order_item.refresh_from_db()
        self.receipt_line.refresh_from_db()
        self.purchase_order.refresh_from_db()

        self.assertEqual(
            self.order_item.received_quantity,
            Decimal("10.00"),
        )
        self.assertTrue(self.receipt_line.stock_posted)

        self.receipt.refresh_from_db()
        self.assertEqual(
            self.receipt.status,
            GoodsReceipt.Status.COMPLETED,
        )

        self.assertEqual(
            StockMovement.objects.filter(
                item=self.inventory_item,
                movement_type=StockMovement.MovementType.RECEIPT,
            ).count(),
            1,
        )

    def test_completing_receipt_again_does_not_duplicate_stock(self):
        first_response = self.complete_receipt()

        self.assertEqual(
            first_response.status_code,
            200,
            first_response.data,
        )

        second_response = self.complete_receipt()

        self.assertEqual(
            second_response.status_code,
            200,
            second_response.data,
        )

        balance = StockBalance.objects.get(item=self.inventory_item)

        self.assertEqual(
            balance.quantity_on_hand,
            Decimal("10.00"),
        )

        self.order_item.refresh_from_db()

        self.assertEqual(
            self.order_item.received_quantity,
            Decimal("10.00"),
        )

        self.assertEqual(
            StockMovement.objects.filter(
                item=self.inventory_item,
                movement_type=StockMovement.MovementType.RECEIPT,
            ).count(),
            1,
        )

    def test_unapproved_purchase_order_cannot_post_stock(self):
        self.purchase_order.status = PurchaseOrder.Status.DRAFT
        self.purchase_order.save(update_fields=["status"])

        response = self.complete_receipt()

        self.assertEqual(response.status_code, 400, response.data)

        self.receipt.refresh_from_db()
        self.order_item.refresh_from_db()
        self.receipt_line.refresh_from_db()

        self.assertEqual(
            self.receipt.status,
            GoodsReceipt.Status.PENDING_INSPECTION,
        )
        self.assertEqual(
            self.order_item.received_quantity,
            Decimal("0.00"),
        )
        self.assertFalse(self.receipt_line.stock_posted)

        self.assertFalse(
            StockBalance.objects.filter(
                item=self.inventory_item,
            ).exists()
        )
        self.assertFalse(
            StockMovement.objects.filter(
                item=self.inventory_item,
            ).exists()
        )

    def test_over_receiving_is_rejected_without_partial_stock_posting(self):
        self.receipt.quantity_received = Decimal("101.00")
        self.receipt.save(update_fields=["quantity_received"])

        self.receipt_line.quantity_received = Decimal("101.00")
        self.receipt_line.save(update_fields=["quantity_received"])

        response = self.complete_receipt()

        self.assertEqual(response.status_code, 400, response.data)

        self.receipt.refresh_from_db()
        self.order_item.refresh_from_db()
        self.receipt_line.refresh_from_db()

        self.assertEqual(
            self.receipt.status,
            GoodsReceipt.Status.PENDING_INSPECTION,
        )
        self.assertEqual(
            self.order_item.received_quantity,
            Decimal("0.00"),
        )
        self.assertFalse(self.receipt_line.stock_posted)

        self.assertFalse(
            StockBalance.objects.filter(
                item=self.inventory_item,
            ).exists()
        )
        self.assertFalse(
            StockMovement.objects.filter(
                item=self.inventory_item,
            ).exists()
        )
