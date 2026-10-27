from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Vehicle(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "Available", "Available"
        ON_TRIP = "On Trip", "On Trip"
        MAINTENANCE = "Maintenance", "Maintenance"

    registration = models.CharField(max_length=20, unique=True)
    make = models.CharField(max_length=80)
    model = models.CharField(max_length=80)
    type = models.CharField(max_length=50, default="Cargo Truck")

    capacity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    driver = models.CharField(max_length=150, blank=True, default="")
    driver_phone = models.CharField(max_length=30, blank=True, default="")

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )

    mileage = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )

    fuel_type = models.CharField(max_length=30, default="Diesel")
    last_service = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["registration"]

    def save(self, *args, **kwargs):
        self.registration = self.registration.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.registration


class Trip(models.Model):
    class Status(models.TextChoices):
        PLANNED = "Planned", "Planned"
        IN_PROGRESS = "In Progress", "In Progress"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"

    reference = models.CharField(
        max_length=30,
        unique=True,
        blank=True,
    )

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.PROTECT,
        related_name="trips",
    )

    driver = models.CharField(max_length=150)
    origin = models.CharField(max_length=150)
    destination = models.CharField(max_length=150)

    cargo = models.CharField(
        max_length=200,
        default="General Cargo",
    )

    cargo_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )

    departure_date = models.DateField()
    expected_arrival = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED,
    )

    client = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-departure_date", "-id"]

    def save(self, *args, **kwargs):
        # Generate a permanent reference after Django assigns the ID.
        if not self.reference:
            super().save(*args, **kwargs)

            self.reference = (
                f"TRP-{timezone.localdate().year}-{self.pk:03d}"
            )

            super().save(
                update_fields=["reference", "updated_at"]
            )
            return

        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference or f"Trip {self.pk}"


class TripExpense(models.Model):
    class Category(models.TextChoices):
        FUEL = "Fuel", "Fuel"
        TOLL = "Toll", "Toll"
        MAINTENANCE = "Maintenance", "Maintenance"
        ACCOMMODATION = "Accommodation", "Accommodation"
        OTHER = "Other", "Other"

    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="expenses",
    )

    category = models.CharField(
        max_length=30,
        choices=Category.choices,
    )

    description = models.CharField(max_length=250)

    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    expense_date = models.DateField(default=timezone.localdate)

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="trucking_expenses",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-expense_date", "-id"]

    def __str__(self):
        return (
            f"{self.trip.reference} - "
            f"{self.category} - {self.amount}"
        )