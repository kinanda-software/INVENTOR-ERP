
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Vehicle, Trip, TripExpense


class TruckingAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()

        self.user = User.objects.create_user(
    username="trucking_test_user",
    password="TestPassword123!",
    role="TRUCKING",
)

        self.client.force_authenticate(user=self.user)

        self.vehicle = Vehicle.objects.create(
            registration="T 100 ABC",
            make="Isuzu",
            model="FVR",
            type="Cargo Truck",
            capacity=10,
            driver="Test Driver",
            driver_phone="0711111111",
            status=Vehicle.Status.AVAILABLE,
            mileage=1000,
            fuel_type="Diesel",
        )

        self.trip_data = {
            "vehicle": self.vehicle.pk,
            "driver": "Test Driver",
            "origin": "Dar es Salaam",
            "destination": "Dodoma",
            "cargo": "Building Materials",
            "cargo_weight": 8,
            "departure_date": "2026-10-21",
            "expected_arrival": "2026-10-22",
            "status": Trip.Status.PLANNED,
            "client": "Test Client",
        }

    def create_trip(self):
        """Create a trip and return its API response."""
        return self.client.post(
            "/api/trucking/trips/",
            self.trip_data,
            format="json",
        )

    def test_planned_trip_keeps_vehicle_available(self):
        response = self.create_trip()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        self.vehicle.refresh_from_db()

        self.assertEqual(
            self.vehicle.status,
            Vehicle.Status.AVAILABLE,
        )
        
    def test_auditor_cannot_create_vehicle(self):
        User = get_user_model()
        auditor = User.objects.create_user(
            username="trucking_auditor_vehicle",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.post(
            "/api/trucking/vehicles/",
            {
                "registration": "T 900 AUD",
                "make": "Isuzu",
                "model": "FVR",
                "type": "Cargo Truck",
                "capacity": 10,
                "driver": "Unauthorized Driver",
                "driver_phone": "0700000000",
                "status": Vehicle.Status.AVAILABLE,
                "mileage": 1000,
                "fuel_type": "Diesel",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )
        self.assertFalse(
            Vehicle.objects.filter(
                registration="T 900 AUD"
            ).exists()
        )

    def test_auditor_cannot_create_trip(self):
        User = get_user_model()
        auditor = User.objects.create_user(
            username="trucking_auditor_trip",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.create_trip()

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )
        self.assertFalse(Trip.objects.exists())

    def test_auditor_can_read_trucking_data(self):
        User = get_user_model()
        auditor = User.objects.create_user(
            username="trucking_auditor_read",
            password="TestPassword123!",
            role="AUDITOR",
        )
        self.client.force_authenticate(user=auditor)

        response = self.client.get("/api/trucking/vehicles/")

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )


    def test_starting_trip_marks_vehicle_on_trip(self):
        response = self.create_trip()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        trip_id = response.data["id"]

        response = self.client.patch(
            f"/api/trucking/trips/{trip_id}/",
            {"status": Trip.Status.IN_PROGRESS},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.vehicle.refresh_from_db()

        self.assertEqual(
            self.vehicle.status,
            Vehicle.Status.ON_TRIP,
        )

    def test_completing_trip_releases_vehicle(self):
        response = self.create_trip()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        trip_id = response.data["id"]

        start_response = self.client.patch(
            f"/api/trucking/trips/{trip_id}/",
            {"status": Trip.Status.IN_PROGRESS},
            format="json",
        )

        self.assertEqual(
            start_response.status_code,
            status.HTTP_200_OK,
            start_response.data,
        )

        response = self.client.patch(
            f"/api/trucking/trips/{trip_id}/",
            {"status": Trip.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.vehicle.refresh_from_db()

        self.assertEqual(
            self.vehicle.status,
            Vehicle.Status.AVAILABLE,
        )

    def test_trip_rejects_cargo_over_vehicle_capacity(self):
        invalid_trip = {
            **self.trip_data,
            "cargo_weight": 12,
        }

        response = self.client.post(
            "/api/trucking/trips/",
            invalid_trip,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertFalse(Trip.objects.exists())

        self.vehicle.refresh_from_db()

        self.assertEqual(
            self.vehicle.status,
            Vehicle.Status.AVAILABLE,
        )

    def test_create_trip_expense(self):
        trip_response = self.create_trip()

        self.assertEqual(
            trip_response.status_code,
            status.HTTP_201_CREATED,
            trip_response.data,
        )

        trip_id = trip_response.data["id"]

        expense_response = self.client.post(
            "/api/trucking/expenses/",
            {
                "trip": trip_id,
                "category": TripExpense.Category.FUEL,
                "description": "Fuel for Dodoma trip",
                "amount": "250000.00",
                "expense_date": "2026-10-21",
            },
            format="json",
        )

        self.assertEqual(
            expense_response.status_code,
            status.HTTP_201_CREATED,
            expense_response.data,
        )

        expense = TripExpense.objects.get(trip_id=trip_id)

        self.assertEqual(
            expense.category,
            TripExpense.Category.FUEL,
        )

        self.assertEqual(
            str(expense.amount),
            "250000.00",
        )

        self.assertEqual(
            expense.recorded_by,
            self.user,
        )

    def test_trip_total_expenses_updates(self):
        trip_response = self.create_trip()

        self.assertEqual(
            trip_response.status_code,
            status.HTTP_201_CREATED,
            trip_response.data,
        )

        trip_id = trip_response.data["id"]

        expenses = [
            {
                "trip": trip_id,
                "category": TripExpense.Category.FUEL,
                "description": "Fuel",
                "amount": "250000.00",
                "expense_date": "2026-10-21",
            },
            {
                "trip": trip_id,
                "category": TripExpense.Category.TOLL,
                "description": "Road tolls",
                "amount": "20000.00",
                "expense_date": "2026-10-21",
            },
        ]

        for expense_data in expenses:
            expense_response = self.client.post(
                "/api/trucking/expenses/",
                expense_data,
                format="json",
            )

            self.assertEqual(
                expense_response.status_code,
                status.HTTP_201_CREATED,
                expense_response.data,
            )

        response = self.client.get(
            f"/api/trucking/trips/{trip_id}/",
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertEqual(
            str(response.data["total_expenses"]),
            "270000.00",
        )

    def test_cancelling_active_trip_releases_vehicle(self):
        # Create a planned trip.
        response = self.create_trip()
        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )
        trip_id = response.data["id"]

        # Start the trip.
        response = self.client.patch(
            f"/api/trucking/trips/{trip_id}/",
            {"status": Trip.Status.IN_PROGRESS},
            format="json",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.vehicle.refresh_from_db()
        self.assertEqual(
            self.vehicle.status,
            Vehicle.Status.ON_TRIP,
        )

        # Cancel the active trip.
        response = self.client.patch(
            f"/api/trucking/trips/{trip_id}/",
            {"status": Trip.Status.CANCELLED},
            format="json",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.vehicle.refresh_from_db()
        self.assertEqual(
            self.vehicle.status,
            Vehicle.Status.AVAILABLE,
        )

    def test_cannot_reassign_trip_to_vehicle_on_another_active_trip(self):
        # Create and start the first trip using the original vehicle.
        first_response = self.create_trip()
        self.assertEqual(
            first_response.status_code,
            status.HTTP_201_CREATED,
            first_response.data,
        )
        first_trip_id = first_response.data["id"]

        start_response = self.client.patch(
            f"/api/trucking/trips/{first_trip_id}/",
            {"status": Trip.Status.IN_PROGRESS},
            format="json",
        )
        self.assertEqual(
            start_response.status_code,
            status.HTTP_200_OK,
            start_response.data,
        )

        # Create a second, available vehicle.
        second_vehicle = Vehicle.objects.create(
            registration="T 200 ABC",
            make="Isuzu",
            model="FVR",
            type="Cargo Truck",
            capacity=10,
            driver="Second Test Driver",
            driver_phone="0722222222",
            status=Vehicle.Status.AVAILABLE,
            mileage=1000,
            fuel_type="Diesel",
        )

        # Create another planned trip using the second vehicle.
        second_trip_data = {
            **self.trip_data,
            "vehicle": second_vehicle.pk,
        }
        second_response = self.client.post(
            "/api/trucking/trips/",
            second_trip_data,
            format="json",
        )
        self.assertEqual(
            second_response.status_code,
            status.HTTP_201_CREATED,
            second_response.data,
        )
        second_trip_id = second_response.data["id"]

        # Attempt to assign the second trip to the busy vehicle.
        response = self.client.patch(
            f"/api/trucking/trips/{second_trip_id}/",
            {"vehicle": self.vehicle.pk},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        # Confirm neither trip nor vehicle assignment was corrupted.
        second_trip = Trip.objects.get(pk=second_trip_id)
        self.assertEqual(second_trip.vehicle_id, second_vehicle.pk)

        self.vehicle.refresh_from_db()
        self.assertEqual(
            self.vehicle.status,
            Vehicle.Status.ON_TRIP,
        )
