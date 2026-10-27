
from django.db import transaction
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from accounts.permissions import RoleBasedPermission

from .models import Vehicle, Trip, TripExpense
from .serializers import (
    VehicleSerializer,
    TripSerializer,
    TripExpenseSerializer,
)


TRUCKING_READ_ROLES = {
    "ADMIN",
    "MANAGER",
    "PROCUREMENT",
    "STOREKEEPER",
    "ACCOUNTANT",
    "TRUCKING",
    "AUDITOR",
}

TRUCKING_WRITE_ROLES = {
    "ADMIN",
    "TRUCKING",
}


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": TRUCKING_READ_ROLES,
        "retrieve": TRUCKING_READ_ROLES,
        "create": TRUCKING_WRITE_ROLES,
        "update": TRUCKING_WRITE_ROLES,
        "partial_update": TRUCKING_WRITE_ROLES,
        "destroy": {"ADMIN"},
    }


class TripViewSet(viewsets.ModelViewSet):
    queryset = (
        Trip.objects.select_related("vehicle")
        .prefetch_related("expenses")
    )
    serializer_class = TripSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": TRUCKING_READ_ROLES,
        "retrieve": TRUCKING_READ_ROLES,
        "create": TRUCKING_WRITE_ROLES,
        "update": TRUCKING_WRITE_ROLES,
        "partial_update": TRUCKING_WRITE_ROLES,
        "destroy": {"ADMIN"},
    }

    def perform_create(self, serializer):
        vehicle = serializer.validated_data["vehicle"]
        cargo_weight = serializer.validated_data["cargo_weight"]
        departure = serializer.validated_data["departure_date"]
        arrival = serializer.validated_data["expected_arrival"]
        trip_status = serializer.validated_data.get(
            "status", Trip.Status.PLANNED
        )

        if arrival < departure:
            raise ValidationError({
                "expected_arrival":
                    "Expected arrival cannot be before departure."
            })

        with transaction.atomic():
            vehicle = Vehicle.objects.select_for_update().get(
                pk=vehicle.pk
            )

            if vehicle.status != Vehicle.Status.AVAILABLE:
                raise ValidationError({
                    "vehicle":
                        "Only available vehicles can be assigned."
                })

            if cargo_weight > vehicle.capacity:
                raise ValidationError({
                    "cargo_weight":
                        f"Cargo exceeds vehicle capacity of "
                        f"{vehicle.capacity}."
                })

            serializer.save(vehicle=vehicle)

            # A planned trip does not make a vehicle busy.
            if trip_status == Trip.Status.IN_PROGRESS:
                vehicle.status = Vehicle.Status.ON_TRIP
                vehicle.save(
                    update_fields=["status", "updated_at"]
                )

    def perform_update(self, serializer):
        trip_id = self.get_object().pk

        with transaction.atomic():
            # Lock the latest trip record before updating it.
            trip = Trip.objects.select_for_update().get(pk=trip_id)

            old_vehicle_id = trip.vehicle_id
            new_vehicle = serializer.validated_data.get(
                "vehicle", trip.vehicle
            )
            new_vehicle_id = new_vehicle.pk

            new_status = serializer.validated_data.get(
                "status", trip.status
            )
            new_weight = serializer.validated_data.get(
                "cargo_weight", trip.cargo_weight
            )
            departure = serializer.validated_data.get(
                "departure_date", trip.departure_date
            )
            arrival = serializer.validated_data.get(
                "expected_arrival", trip.expected_arrival
            )

            if arrival < departure:
                raise ValidationError({
                    "expected_arrival":
                        "Expected arrival cannot be before departure."
                })

            if new_weight > new_vehicle.capacity:
                raise ValidationError({
                    "cargo_weight":
                        "Cargo exceeds vehicle capacity."
                })

            # Lock both vehicles in a consistent order.
            vehicle_ids = sorted({
                old_vehicle_id,
                new_vehicle_id,
            })

            locked_vehicles = {
                vehicle.pk: vehicle
                for vehicle in Vehicle.objects.select_for_update()
                .filter(pk__in=vehicle_ids)
                .order_by("pk")
            }

            old_vehicle = locked_vehicles[old_vehicle_id]
            new_vehicle = locked_vehicles[new_vehicle_id]

            # A different vehicle must be available before reassignment.
            if (
                new_vehicle_id != old_vehicle_id
                and new_vehicle.status != Vehicle.Status.AVAILABLE
            ):
                raise ValidationError({
                    "vehicle":
                        "The selected vehicle is not available."
                })

            # An active trip may keep using its own ON_TRIP vehicle.
            already_using_vehicle = (
                trip.status == Trip.Status.IN_PROGRESS
                and new_vehicle_id == old_vehicle_id
                and new_vehicle.status == Vehicle.Status.ON_TRIP
            )

            if new_status == Trip.Status.IN_PROGRESS:
                if (
                    new_vehicle.status != Vehicle.Status.AVAILABLE
                    and not already_using_vehicle
                ):
                    raise ValidationError({
                        "vehicle":
                            "The selected vehicle is not available."
                    })

            elif new_status == Trip.Status.PLANNED:
                if (
                    new_vehicle.status != Vehicle.Status.AVAILABLE
                    and not already_using_vehicle
                ):
                    raise ValidationError({
                        "vehicle":
                            "The selected vehicle is not available."
                    })

            # Save against the freshly locked trip record.
            serializer.instance = trip
            serializer.save(vehicle=new_vehicle)

            if new_status == Trip.Status.IN_PROGRESS:
                new_vehicle.status = Vehicle.Status.ON_TRIP
                new_vehicle.save(
                    update_fields=["status", "updated_at"]
                )

            # Release vehicles no longer needed by this trip.
            # Do not release a vehicle that another active trip uses.
            for vehicle_id in vehicle_ids:
                if (
                    new_status == Trip.Status.IN_PROGRESS
                    and vehicle_id == new_vehicle_id
                ):
                    continue

                vehicle = locked_vehicles[vehicle_id]

                if vehicle.status != Vehicle.Status.ON_TRIP:
                    continue

                another_active_trip = (
                    Trip.objects.filter(
                        vehicle_id=vehicle_id,
                        status=Trip.Status.IN_PROGRESS,
                    )
                    .exclude(pk=trip.pk)
                    .exists()
                )

                if not another_active_trip:
                    vehicle.status = Vehicle.Status.AVAILABLE
                    vehicle.save(
                        update_fields=["status", "updated_at"]
                    )


class TripExpenseViewSet(viewsets.ModelViewSet):
    queryset = (
        TripExpense.objects.select_related(
            "trip", "recorded_by", "trip__vehicle"
        )
    )
    serializer_class = TripExpenseSerializer
    permission_classes = [RoleBasedPermission]

    role_permissions = {
        "list": TRUCKING_READ_ROLES,
        "retrieve": TRUCKING_READ_ROLES,
        "create": TRUCKING_WRITE_ROLES,
        "update": TRUCKING_WRITE_ROLES,
        "partial_update": TRUCKING_WRITE_ROLES,
        "destroy": {"ADMIN"},
    }

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)
