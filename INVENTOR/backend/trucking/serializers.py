
from rest_framework import serializers
from .models import Vehicle, Trip, TripExpense


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class TripSerializer(serializers.ModelSerializer):
    vehicle_registration = serializers.CharField(
        source="vehicle.registration",
        read_only=True,
    )
    total_expenses = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = "__all__"
        read_only_fields = (
            "id",
            "reference",
            "created_at",
            "updated_at",
            "total_expenses",
        )

    def get_total_expenses(self, obj):
        return sum(
            expense.amount for expense in obj.expenses.all()
        )


class TripExpenseSerializer(serializers.ModelSerializer):
    trip_reference = serializers.CharField(
        source="trip.reference",
        read_only=True,
    )
    recorded_by = serializers.PrimaryKeyRelatedField(
        read_only=True,
    )

    class Meta:
        model = TripExpense
        fields = "__all__"
        read_only_fields = ("id", "recorded_by", "created_at")

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["recorded_by"] = request.user
        else:
            raise serializers.ValidationError(
                "An authenticated user is required."
            )

        return super().create(validated_data)
