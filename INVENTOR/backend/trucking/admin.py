
from django.contrib import admin

from .models import Trip, TripExpense, Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = (
        "registration",
        "make",
        "model",
        "capacity",
        "driver",
        "status",
    )
    list_filter = ("status", "type", "fuel_type")
    search_fields = ("registration", "make", "model", "driver")


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "vehicle",
        "driver",
        "origin",
        "destination",
        "departure_date",
        "status",
    )
    list_filter = ("status", "departure_date")
    search_fields = (
        "reference",
        "vehicle__registration",
        "driver",
        "origin",
        "destination",
        "client",
    )
    readonly_fields = ("reference", "created_at", "updated_at")


@admin.register(TripExpense)
class TripExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "trip",
        "category",
        "description",
        "amount",
        "expense_date",
        "recorded_by",
    )
    list_filter = ("category", "expense_date")
    search_fields = (
        "trip__reference",
        "description",
        "trip__vehicle__registration",
    )
    readonly_fields = ("created_at",)


# Register your models here.
