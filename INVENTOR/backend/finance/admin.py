
from django.contrib import admin

from .models import SupplierInvoice, SupplierPayment, Expense


@admin.register(SupplierInvoice)
class SupplierInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "supplier",
        "invoice_date",
        "due_date",
        "amount",
        "currency",
        "created_at",
    )
    search_fields = ("invoice_number", "supplier__name")
    list_filter = ("currency", "invoice_date", "due_date")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SupplierPayment)
class SupplierPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "payment_reference",
        "invoice",
        "amount",
        "payment_date",
        "payment_method",
    )
    search_fields = (
        "payment_reference",
        "invoice__invoice_number",
    )
    list_filter = ("payment_method", "payment_date")
    readonly_fields = ("created_at",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "expense_number",
        "category",
        "description",
        "amount",
        "currency",
        "expense_date",
        "payment_method",
    )
    search_fields = ("expense_number", "description", "category")
    list_filter = ("category", "currency", "payment_method", "expense_date")
    readonly_fields = ("created_at", "updated_at")


