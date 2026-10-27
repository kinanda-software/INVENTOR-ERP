
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from rest_framework.test import APIClient

from audit.models import AuditLog
from inventory.models import InventoryItem, StockBalance, StockMovement


User = get_user_model()


class InventoryAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
    username="inventory_test_user",
    password="TestPassword123!",
    role="STOREKEEPER",
)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.item = InventoryItem.objects.create(
            code="INV-TEST-001",
            name="Test Cement",
            unit_of_measure="bags",
            is_active=True,
        )

        self.balance = StockBalance.objects.create(
            item=self.item,
            quantity_on_hand=Decimal("50.00"),
        )

        self.movement_url = reverse("stock-movement-record")
        self.item_list_url = reverse("inventory-item-list")

    def movement_payload(self, movement_type, quantity, reference):
        return {
            "item": self.item.pk,
            "movement_type": movement_type,
            "quantity": str(quantity),
            "reference": reference,
            "notes": "Inventory API test",
        }

    def test_receipt_movement_increases_stock(self):
        response = self.client.post(
            self.movement_url,
            self.movement_payload(
                "RECEIPT",
                "20.00",
                "TEST-REC-001",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("70.00"),
        )

        self.assertEqual(
            StockMovement.objects.filter(
                reference="TEST-REC-001",
            ).count(),
            1,
        )

        self.assertEqual(
            AuditLog.objects.filter(
                action=AuditLog.Action.STOCK_RECEIPT,
                module="inventory",
                changes__reference="TEST-REC-001",
            ).count(),
            1,
            "A successful receipt must create one audit record.",
        )

    def test_issue_movement_decreases_stock(self):
        response = self.client.post(
            self.movement_url,
            self.movement_payload(
                "ISSUE",
                "15.00",
                "TEST-ISS-001",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("35.00"),
        )

        self.assertEqual(
            AuditLog.objects.filter(
                action=AuditLog.Action.STOCK_ISSUE,
                module="inventory",
                changes__reference="TEST-ISS-001",
            ).count(),
            1,
            "A successful issue must create one audit record.",
        )

    def test_issue_greater_than_available_stock_is_rejected(self):
        response = self.client.post(
            self.movement_url,
            self.movement_payload(
                "ISSUE",
                "60.00",
                "TEST-ISS-002",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("50.00"),
        )

        self.assertFalse(
            StockMovement.objects.filter(
                reference="TEST-ISS-002",
            ).exists()
        )

        self.assertFalse(
            AuditLog.objects.filter(
                module="inventory",
                changes__reference="TEST-ISS-002",
            ).exists(),
            "A rejected issue must not create an audit record.",
        )

    def test_zero_quantity_is_rejected(self):
        response = self.client.post(
            self.movement_url,
            self.movement_payload(
                "RECEIPT",
                "0.00",
                "TEST-ZERO-001",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("50.00"),
        )

        self.assertFalse(
            StockMovement.objects.filter(
                reference="TEST-ZERO-001",
            ).exists()
        )

        self.assertFalse(
            AuditLog.objects.filter(
                module="inventory",
                changes__reference="TEST-ZERO-001",
            ).exists(),
        )

    def test_negative_quantity_is_rejected(self):
        response = self.client.post(
            self.movement_url,
            self.movement_payload(
                "RECEIPT",
                "-5.00",
                "TEST-NEG-001",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("50.00"),
        )

        self.assertFalse(
            StockMovement.objects.filter(
                reference="TEST-NEG-001",
            ).exists()
        )

        self.assertFalse(
            AuditLog.objects.filter(
                module="inventory",
                changes__reference="TEST-NEG-001",
            ).exists(),
        )

    def test_adjustment_movement_is_rejected_by_record_endpoint(self):
        response = self.client.post(
            self.movement_url,
            self.movement_payload(
                "ADJUSTMENT",
                "5.00",
                "TEST-ADJ-001",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("50.00"),
        )

        self.assertFalse(
            StockMovement.objects.filter(
                reference="TEST-ADJ-001",
            ).exists()
        )

        self.assertFalse(
            AuditLog.objects.filter(
                module="inventory",
                changes__reference="TEST-ADJ-001",
            ).exists(),
            "A rejected adjustment must not create an audit record.",
        )

    def test_creating_inventory_item_creates_zero_balance(self):
        response = self.client.post(
            self.item_list_url,
            {
                "code": "INV-TEST-002",
                "name": "Test Steel",
                "description": "Steel bars for testing",
                "unit_of_measure": "pcs",
                "is_active": True,
                "category": "Construction",
                "warehouse": "Main Warehouse",
                "reorder_level": "10.00",
                "unit_cost": "5000.00",
                "supplier": "Test Supplier",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

        created_item = InventoryItem.objects.get(
            code="INV-TEST-002",
        )

        self.assertEqual(
            created_item.stock_balance.quantity_on_hand,
            Decimal("0.00"),
        )

        self.assertEqual(
            AuditLog.objects.filter(
                action=AuditLog.Action.CREATE,
                module="inventory",
                object_type="InventoryItem",
                object_id=str(created_item.pk),
            ).count(),
            1,
            "Creating an inventory item must create one audit record.",
        )

    def test_inventory_api_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.item_list_url)

        self.assertEqual(response.status_code, 401, response.data)

        def test_auditor_cannot_record_stock_movement(self):
         auditor = User.objects.create_user(
            username="inventory_auditor",
            password="TestPassword123!",
            role="AUDITOR",
        )
         self.client.force_authenticate(user=auditor)

        response = self.client.post(
            self.movement_url,
            self.movement_payload(
                "ISSUE",
                "5.00",
                "TEST-AUDIT-ISSUE-001",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 401, response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("50.00"),
        )

        self.assertFalse(
            StockMovement.objects.filter(
                reference="TEST-AUDIT-ISSUE-001",
            ).exists()
        )

    def test_auditor_cannot_create_inventory_item(self):
        auditor = User.objects.create_user(
            username="inventory_auditor_create",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.post(
            self.item_list_url,
            {
                "code": "INV-AUDIT-001",
                "name": "Unauthorized Item",
                "unit_of_measure": "pcs",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403, response.data)

        self.assertFalse(
            InventoryItem.objects.filter(
                code="INV-AUDIT-001",
            ).exists()
        )

    def test_auditor_can_read_inventory_items(self):
        auditor = User.objects.create_user(
            username="inventory_auditor_read",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.get(self.item_list_url)

        self.assertEqual(response.status_code, 200, response.data)

    def test_duplicate_receipt_reference_does_not_increase_stock_twice(self):
        payload = self.movement_payload(
            "RECEIPT",
            "20.00",
            "TEST-DUP-REC-001",
        )

        first_response = self.client.post(
            self.movement_url,
            payload,
            format="json",
        )

        self.assertEqual(
            first_response.status_code,
            201,
            first_response.data,
        )

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("70.00"),
        )

        second_response = self.client.post(
            self.movement_url,
            payload,
            format="json",
        )

        self.assertEqual(
            second_response.status_code,
            400,
            second_response.data,
        )

        self.assertIn("reference", second_response.data)

        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.quantity_on_hand,
            Decimal("70.00"),
            "Duplicate receipt must not increase stock twice.",
        )

        self.assertEqual(
            StockMovement.objects.filter(
                item=self.item,
                movement_type="RECEIPT",
                reference="TEST-DUP-REC-001",
            ).count(),
            1,
        )

        self.assertEqual(
            AuditLog.objects.filter(
                action=AuditLog.Action.STOCK_RECEIPT,
                module="inventory",
                changes__reference="TEST-DUP-REC-001",
            ).count(),
            1,
            "A duplicate receipt must not create another audit record.",
        )
