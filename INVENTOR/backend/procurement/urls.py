
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet,
    PurchaseOrderViewSet,
    PurchaseOrderItemViewSet,
)

router = DefaultRouter()

router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("purchase-order-items", PurchaseOrderItemViewSet, basename="purchase-order-item")

urlpatterns = router.urls
