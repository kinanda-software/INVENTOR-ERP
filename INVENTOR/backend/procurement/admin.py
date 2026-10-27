
from django.contrib import admin
from .models import Supplier, PurchaseOrder, PurchaseOrderItem


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = (
        "supplier_code",
        "name",
        "phone",
        "email",
        "is_active",
    )
    search_fields = ("supplier_code", "name", "phone", "email")
    list_filter = ("is_active",)


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "supplier",
        "order_date",
        "status",
        "created_by",
    )
    search_fields = ("order_number", "supplier__name")
    list_filter = ("status", "order_date")
    inlines = [PurchaseOrderItemInline]
