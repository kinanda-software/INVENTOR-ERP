
from types import SimpleNamespace

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from accounts.permissions import RoleBasedPermission, AuditLogPermission


class RoleBasedPermissionTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = RoleBasedPermission()

    def make_request(
        self,
        method="get",
        role="PROCUREMENT",
        authenticated=True,
    ):
        request = getattr(self.factory, method)("/test/")
        request.user = SimpleNamespace(
            is_authenticated=authenticated,
            role=role,
        )
        return request

    def make_view(self, action, role_permissions=None):
        return SimpleNamespace(
            action=action,
            role_permissions=role_permissions or {},
        )

    def test_allowed_role_can_perform_action(self):
        request = self.make_request(role="PROCUREMENT")
        view = self.make_view(
            "create",
            {"create": {"PROCUREMENT", "ADMIN"}},
        )

        self.assertTrue(
            self.permission.has_permission(request, view)
        )

    def test_unauthorized_role_is_denied(self):
        request = self.make_request(role="STOREKEEPER")
        view = self.make_view(
            "approve",
            {"approve": {"MANAGER", "ADMIN"}},
        )

        self.assertFalse(
            self.permission.has_permission(request, view)
        )

    def test_unlisted_action_is_denied(self):
        request = self.make_request(role="PROCUREMENT")
        view = self.make_view(
            "destroy",
            {"create": {"PROCUREMENT", "ADMIN"}},
        )

        self.assertFalse(
            self.permission.has_permission(request, view)
        )

    def test_missing_role_configuration_denies_access(self):
        request = self.make_request(role="ADMIN")
        view = self.make_view("list")

        self.assertFalse(
            self.permission.has_permission(request, view)
        )

    def test_unauthenticated_user_is_denied(self):
        request = self.make_request(authenticated=False)
        view = self.make_view(
            "list",
            {"list": {"ADMIN", "AUDITOR"}},
        )

        self.assertFalse(
            self.permission.has_permission(request, view)
        )

    def test_object_permission_respects_configured_role(self):
        request = self.make_request(role="PROCUREMENT")
        view = self.make_view(
            "retrieve",
            {"retrieve": {"PROCUREMENT", "ADMIN"}},
        )

        self.assertTrue(
            self.permission.has_object_permission(
                request, view, object()
            )
        )

    def test_object_permission_denies_unauthorized_role(self):
        request = self.make_request(role="STOREKEEPER")
        view = self.make_view(
            "approve",
            {"approve": {"MANAGER", "ADMIN"}},
        )

        self.assertFalse(
            self.permission.has_object_permission(
                request, view, object()
            )
        )


class AuditLogPermissionTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = AuditLogPermission()

    def make_request(
        self,
        method="get",
        role="AUDITOR",
        authenticated=True,
    ):
        request = getattr(
            self.factory, method
        )("/api/audit/logs/")

        request.user = SimpleNamespace(
            is_authenticated=authenticated,
            role=role,
        )
        return request

    def test_auditor_can_read_audit_logs(self):
        request = self.make_request(role="AUDITOR")

        self.assertTrue(
            self.permission.has_permission(
                request, SimpleNamespace()
            )
        )

    def test_admin_can_read_audit_logs(self):
        request = self.make_request(role="ADMIN")

        self.assertTrue(
            self.permission.has_permission(
                request, SimpleNamespace()
            )
        )

    def test_accountant_cannot_read_audit_logs(self):
        request = self.make_request(role="ACCOUNTANT")

        self.assertFalse(
            self.permission.has_permission(
                request, SimpleNamespace()
            )
        )

    def test_auditor_cannot_modify_audit_logs(self):
        request = self.make_request(
            method="post",
            role="AUDITOR",
        )

        self.assertFalse(
            self.permission.has_permission(
                request, SimpleNamespace()
            )
        )

    def test_unauthenticated_user_cannot_read_audit_logs(self):
        request = self.make_request(authenticated=False)

        self.assertFalse(
            self.permission.has_permission(
                request, SimpleNamespace()
            )
        )

    def test_auditor_object_permission_allows_read(self):
        request = self.make_request(role="AUDITOR")

        self.assertTrue(
            self.permission.has_object_permission(
                request, SimpleNamespace(), object()
            )
        )

    def test_accountant_object_permission_denies_read(self):
        request = self.make_request(role="ACCOUNTANT")

        self.assertFalse(
            self.permission.has_object_permission(
                request, SimpleNamespace(), object()
            )
        )
