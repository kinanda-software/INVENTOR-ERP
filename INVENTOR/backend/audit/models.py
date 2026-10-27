
from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Created"
        UPDATE = "UPDATE", "Updated"
        DELETE = "DELETE", "Deleted"
        SUBMIT = "SUBMIT", "Submitted"
        APPROVE = "APPROVE", "Approved"
        REJECT = "REJECT", "Rejected"
        COMPLETE = "COMPLETE", "Completed"
        CANCEL = "CANCEL", "Cancelled"
        STOCK_RECEIPT = "STOCK_RECEIPT", "Stock received"
        STOCK_ISSUE = "STOCK_ISSUE", "Stock issued"
        LOGIN = "LOGIN", "Login"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    action = models.CharField(
        max_length=30,
        choices=Action.choices,
    )

    module = models.CharField(max_length=50)
    object_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    object_repr = models.CharField(max_length=255, blank=True)

    changes = models.JSONField(default=dict, blank=True)

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["module", "created_at"],
                name="audit_module_date_idx",
            ),
            models.Index(
                fields=["actor", "created_at"],
                name="audit_actor_date_idx",
            ),
            models.Index(
                fields=["object_type", "object_id"],
                name="audit_object_idx",
            ),
        ]

    def __str__(self):
        return (
            f"{self.action} - {self.module} - "
            f"{self.object_type} #{self.object_id}"
        )


# Create your models here.
