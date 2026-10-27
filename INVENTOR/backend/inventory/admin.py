from django.contrib import admin

from .models import InventoryItem, StockBalance, StockMovement


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "unit_of_measure",
        "is_active",
    )
    search_fields = ("code", "name")
    list_filter = ("is_active", "unit_of_measure")
    ordering = ("code",)


@admin.register(StockBalance)
class StockBalanceAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "quantity_on_hand",
        "updated_at",
    )
    search_fields = ("item__code", "item__name")
    readonly_fields = ("updated_at",)
    ordering = ("item__code",)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "movement_type",
        "quantity",
        "reference",
        "created_by",
        "created_at",
    )
    search_fields = (
        "reference",
        "item__code",
        "item__name",
    )
    list_filter = ("movement_type", "created_at")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
