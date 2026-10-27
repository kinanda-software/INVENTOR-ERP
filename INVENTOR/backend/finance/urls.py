
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SupplierInvoiceViewSet,
    SupplierPaymentViewSet,
    ExpenseViewSet,
    FinanceSummaryView,
)

router = DefaultRouter()
router.register(
    "invoices",
    SupplierInvoiceViewSet,
    basename="supplier-invoice",
)
router.register(
    "payments",
    SupplierPaymentViewSet,
    basename="supplier-payment",
)
router.register(
    "expenses",
    ExpenseViewSet,
    basename="expense",
)

urlpatterns = [
    path("summary/", FinanceSummaryView.as_view(), name="finance-summary"),
    path("", include(router.urls)),
]
