
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrator"
        MANAGER = "MANAGER", "Manager"
        PROCUREMENT = "PROCUREMENT", "Procurement Officer"
        STOREKEEPER = "STOREKEEPER", "Storekeeper"
        ACCOUNTANT = "ACCOUNTANT", "Accountant"
        TRUCKING = "TRUCKING", "Trucking Officer"
        AUDITOR = "AUDITOR", "Auditor"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.AUDITOR,
    )

    department = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    def __str__(self):
        return f"{self.username} ({self.role})"
