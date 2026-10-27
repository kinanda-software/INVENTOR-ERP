from rest_framework import status
from rest_framework.test import APITestCase
from django.urls import reverse
from django.test import TestCase

from accounts.models import User
from audit.models import AuditLog
from audit.services import log_action
from inventory.models import InventoryItem


class AuditLogServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="audit_test_user",
            password="Test-Only-Password-123!",
            role=User.Role.ADMIN,
        )

    def create_inventory_item(self):
        return InventoryItem.objects.create(
            code="AUDIT-TEST-001",
            name="Audit Test Item",
        )

    def test_log_action_records_actor_and_object(self):
        item = self.create_inventory_item()

        log = log_action(
            actor=self.user,
            action=AuditLog.Action.CREATE,
            module="inventory",
            obj=item,
            changes={
                "name": {
                    "old": None,
                    "new": item.name,
                }
            },
        )

        self.assertEqual(log.actor, self.user)
        self.assertEqual(log.action, AuditLog.Action.CREATE)
        self.assertEqual(log.module, "inventory")
        self.assertEqual(log.object_type, "InventoryItem")
        self.assertEqual(log.object_id, str(item.pk))
        self.assertEqual(
            log.changes["name"]["new"],
            item.name,
        )

    def test_log_action_rejects_unsaved_objects(self):
        item = InventoryItem(
            code="AUDIT-UNSAVED-001",
            name="Unsaved Item",
        )

        with self.assertRaises(ValueError):
            log_action(
                actor=self.user,
                action=AuditLog.Action.CREATE,
                module="inventory",
                obj=item,
            )

class AuditLogAPIPermissionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="audit_api_admin",
            password="Test-Only-Password-123!",
            role=User.Role.ADMIN,
        )

        self.auditor = User.objects.create_user(
            username="audit_api_auditor",
            password="Test-Only-Password-123!",
            role=User.Role.AUDITOR,
        )

        self.accountant = User.objects.create_user(
            username="audit_api_accountant",
            password="Test-Only-Password-123!",
            role=User.Role.ACCOUNTANT,
        )

        self.url = reverse("audit-log-list")

    def test_admin_can_read_audit_logs(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_auditor_can_read_audit_logs(self):
        self.client.force_authenticate(user=self.auditor)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_accountant_cannot_read_audit_logs(self):
        self.client.force_authenticate(user=self.accountant)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_auditor_cannot_create_audit_log(self):
        self.client.force_authenticate(user=self.auditor)

        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
