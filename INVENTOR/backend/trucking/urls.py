
from rest_framework.routers import DefaultRouter

from .views import (
    VehicleViewSet,
    TripViewSet,
    TripExpenseViewSet,
)

router = DefaultRouter()

router.register(
    "vehicles",
    VehicleViewSet,
    basename="trucking-vehicle",
)

router.register(
    "trips",
    TripViewSet,
    basename="trucking-trip",
)

router.register(
    "expenses",
    TripExpenseViewSet,
    basename="trucking-expense",
)

urlpatterns = router.urls
