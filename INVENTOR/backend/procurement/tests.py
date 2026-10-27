from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from rest_framework.test import APIClient

from procurement.models import Supplier, PurchaseOrder, PurchaseOrderItem
from inventory.models import InventoryItem


User = get_user_model()


class ProcurementAPITests(TestCase):
    def setUp(self):
        # Procurement Officer: can create and manage draft procurement records.
        self.user = User.objects.create_user(
            username="procurement_test_user",
            password="TestPassword123!",
            role="PROCUREMENT",
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.supplier = Supplier.objects.create(
            name="Procurement Test Supplier",
            supplier_code="SUP-PROC-001",
            phone="0712345678",
        )

        self.item = InventoryItem.objects.create(
            code="INV-PROC-001",
            name="Test Cement",
            unit_of_measure="bags",
        )

        self.supplier_url = reverse("supplier-list")
        self.purchase_order_url = reverse("purchase-order-list")
        self.order_item_url = reverse("purchase-order-item-list")

    # Helper methods

    def create_purchase_order(
        self,
        order_number,
        status=PurchaseOrder.Status.DRAFT,
    ):
        return PurchaseOrder.objects.create(
            order_number=order_number,
            supplier=self.supplier,
            order_date=date.today(),
            created_by=self.user,
            status=status,
        )

    def add_order_item(self, order):
        return PurchaseOrderItem.objects.create(
            purchase_order=order,
            inventory_item=self.item,
            description="Test Cement",
            quantity=Decimal("10.00"),
            unit_of_measure="bags",
            unit_price=Decimal("15000.00"),
        )

    # Supplier tests

    def test_authenticated_user_can_create_supplier(self):
        response = self.client.post(
            self.supplier_url,
            {
                "name": "New Supplier",
                "supplier_code": "SUP-PROC-002",
                "contact_person": "Test Contact",
                "phone": "0755555555",
                "email": "supplier@example.com",
                "address": "Dar es Salaam",
                "tax_number": "",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            Supplier.objects.filter(
                supplier_code="SUP-PROC-002"
            ).exists()
        )

    def test_duplicate_supplier_code_is_rejected(self):
        response = self.client.post(
            self.supplier_url,
            {
                "name": "Duplicate Supplier",
                "supplier_code": self.supplier.supplier_code,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)

    def test_auditor_cannot_create_supplier(self):
        auditor = User.objects.create_user(
            username="procurement_test_auditor",
            password="AuditorPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.post(
            self.supplier_url,
            {
                "name": "Unauthorized Supplier",
                "supplier_code": "SUP-PROC-UNAUTHORIZED",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(
            Supplier.objects.filter(
                supplier_code="SUP-PROC-UNAUTHORIZED"
            ).exists()
        )

    # Purchase order tests

    def test_purchase_order_creation_uses_authenticated_user(self):
        response = self.client.post(
            self.purchase_order_url,
            {
                "order_number": "PO-PROC-001",
                "supplier": self.supplier.pk,
                "order_date": date.today().isoformat(),
                "expected_delivery_date": None,
                "status": "DRAFT",
                "notes": "Procurement test",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

        order = PurchaseOrder.objects.get(
            order_number="PO-PROC-001"
        )

        self.assertEqual(order.created_by, self.user)
        self.assertEqual(order.status, PurchaseOrder.Status.DRAFT)

    def test_purchase_order_item_line_total_is_calculated(self):
        order = self.create_purchase_order("PO-PROC-002")

        response = self.client.post(
            self.order_item_url,
            {
                "purchase_order": order.pk,
                "description": "Test Cement",
                "quantity": "10.00",
                "unit_of_measure": "bags",
                "unit_price": "15000.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)

        order_item = PurchaseOrderItem.objects.get(
            purchase_order=order,
            description="Test Cement",
        )

        self.assertEqual(
            order_item.line_total,
            Decimal("150000.0000"),
        )

    def test_purchase_order_item_can_link_inventory_item(self):
        order = self.create_purchase_order("PO-PROC-003")

        order_item = PurchaseOrderItem.objects.create(
            purchase_order=order,
            inventory_item=self.item,
            description="Test Cement",
            quantity=Decimal("10.00"),
            unit_of_measure="bags",
            unit_price=Decimal("15000.00"),
        )

        response = self.client.get(
            reverse(
                "purchase-order-item-detail",
                args=[order_item.pk],
            )
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data["inventory_item_id"],
            self.item.pk,
        )
        self.assertEqual(
            response.data["inventory_item_name"],
            self.item.name,
        )

    def test_purchase_order_item_received_quantity_is_read_only(self):
        order = self.create_purchase_order("PO-PROC-004")

        order_item = PurchaseOrderItem.objects.create(
            purchase_order=order,
            description="Test Cement",
            quantity=Decimal("10.00"),
            received_quantity=Decimal("3.00"),
            unit_of_measure="bags",
            unit_price=Decimal("15000.00"),
        )

        response = self.client.patch(
            reverse(
                "purchase-order-item-detail",
                args=[order_item.pk],
            ),
            {"received_quantity": "9.00"},
            format="json",
        )

        self.assertIn(response.status_code, [200, 400], response.data)

        order_item.refresh_from_db()
        self.assertEqual(
            order_item.received_quantity,
            Decimal("3.00"),
        )

    # Approval workflow tests

    def test_submit_draft_order_with_items(self):
        order = self.create_purchase_order("PO-WORKFLOW-001")
        self.add_order_item(order)

        response = self.client.post(
            reverse("purchase-order-submit", args=[order.pk])
        )

        self.assertEqual(response.status_code, 200, response.data)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.Status.PENDING)

    def test_cannot_submit_order_without_items(self):
        order = self.create_purchase_order("PO-WORKFLOW-002")

        response = self.client.post(
            reverse("purchase-order-submit", args=[order.pk])
        )

        self.assertEqual(response.status_code, 400, response.data)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.Status.DRAFT)

    def test_creator_cannot_approve_own_purchase_order(self):
        # A Manager may approve other people's orders, but not their own.
        manager = User.objects.create_user(
            username="procurement_manager_creator",
            password="ManagerPassword123!",
            role="MANAGER",
        )

        order = PurchaseOrder.objects.create(
            order_number="PO-WORKFLOW-003",
            supplier=self.supplier,
            order_date=date.today(),
            created_by=manager,
            status=PurchaseOrder.Status.PENDING,
        )

        self.client.force_authenticate(user=manager)

        response = self.client.post(
            reverse("purchase-order-approve", args=[order.pk])
        )

        self.assertEqual(response.status_code, 400, response.data)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.Status.PENDING)
        self.assertIsNone(order.approved_by)

    def test_different_user_can_approve_pending_order(self):
        order = self.create_purchase_order(
            "PO-WORKFLOW-004",
            status=PurchaseOrder.Status.PENDING,
        )
        self.add_order_item(order)

        approver = User.objects.create_user(
            username="procurement_approver",
            password="ApproverPassword123!",
            role="MANAGER",
        )
        self.client.force_authenticate(user=approver)

        response = self.client.post(
            reverse("purchase-order-approve", args=[order.pk])
        )

        self.assertEqual(response.status_code, 200, response.data)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.Status.APPROVED)
        self.assertEqual(order.approved_by, approver)

    def test_procurement_officer_cannot_approve_pending_order(self):
        order = self.create_purchase_order(
            "PO-WORKFLOW-008",
            status=PurchaseOrder.Status.PENDING,
        )
        self.add_order_item(order)

        response = self.client.post(
            reverse("purchase-order-approve", args=[order.pk])
        )

        self.assertEqual(response.status_code, 403, response.data)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.Status.PENDING)
        self.assertIsNone(order.approved_by)

    def test_cannot_approve_draft_order(self):
        order = self.create_purchase_order("PO-WORKFLOW-005")
        self.add_order_item(order)

        approver = User.objects.create_user(
            username="procurement_approver_2",
            password="ApproverPassword123!",
            role="MANAGER",
        )
        self.client.force_authenticate(user=approver)

        response = self.client.post(
            reverse("purchase-order-approve", args=[order.pk])
        )

        self.assertEqual(response.status_code, 400, response.data)

        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.Status.DRAFT)

    def test_cannot_edit_approved_purchase_order(self):
        order = self.create_purchase_order(
            "PO-WORKFLOW-006",
            status=PurchaseOrder.Status.APPROVED,
        )

        response = self.client.patch(
            reverse("purchase-order-detail", args=[order.pk]),
            {"notes": "Attempted change"},
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)

        order.refresh_from_db()
        self.assertNotEqual(order.notes, "Attempted change")

    def test_cannot_delete_approved_purchase_order(self):
        order = self.create_purchase_order(
            "PO-WORKFLOW-007",
            status=PurchaseOrder.Status.APPROVED,
        )

        response = self.client.delete(
            reverse("purchase-order-detail", args=[order.pk])
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertTrue(
            PurchaseOrder.objects.filter(pk=order.pk).exists()
        )

    # Authentication test

    def test_procurement_api_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.purchase_order_url)

        self.assertEqual(response.status_code, 401, response.data)
