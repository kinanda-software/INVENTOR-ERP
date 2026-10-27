from rest_framework import viewsets
from accounts.permissions import AuditLogPermission
from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username",
        read_only=True,
        default=None,
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_username",
            "action",
            "module",
            "object_type",
            "object_id",
            "object_repr",
            "changes",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [AuditLogPermission]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor").all()

        module = self.request.query_params.get("module")
        action = self.request.query_params.get("action")
        object_type = self.request.query_params.get("object_type")
        object_id = self.request.query_params.get("object_id")

        if module:
            queryset = queryset.filter(module__iexact=module)

        if action:
            queryset = queryset.filter(action__iexact=action)

        if object_type:
            queryset = queryset.filter(object_type__iexact=object_type)

        if object_id:
            queryset = queryset.filter(object_id=object_id)

        return queryset