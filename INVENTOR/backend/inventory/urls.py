
from rest_framework.routers import DefaultRouter

from .views import (
    InventoryItemViewSet,
    StockBalanceViewSet,
    StockMovementViewSet,
)

router = DefaultRouter()

router.register("items", InventoryItemViewSet, basename="inventory-item")
router.register("balances", StockBalanceViewSet, basename="stock-balance")
router.register(
    "movements",
    StockMovementViewSet,
    basename="stock-movement",
)

urlpatterns = router.urls

