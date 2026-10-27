from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "created_at",
        "actor",
        "action",
        "module",
        "object_type",
        "object_id",
        "ip_address",
    )

    list_filter = ("action", "module", "created_at")

    search_fields = (
        "actor__username",
        "module",
        "object_type",
        "object_id",
        "object_repr",
    )

    readonly_fields = (
        "actor",
        "action",
        "module",
        "object_type",
        "object_id",
        "object_repr",
        "changes",
        "ip_address",
        "created_at",
    )

    ordering = ("-created_at", "-id")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False