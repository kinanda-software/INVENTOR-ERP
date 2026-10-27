
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import GoodsReceipt
from .serializers import GoodsReceiptSerializer


class GoodsReceiptViewSet(viewsets.ModelViewSet):
    queryset = (
        GoodsReceipt.objects
        .select_related(
            "purchase_order",
            "purchase_order__supplier",
            "received_by",
            "inspected_by",
        )
        .all()
    )

    serializer_class = GoodsReceiptSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)

    def perform_update(self, serializer):
        new_status = serializer.validated_data.get("status")

        if new_status in [
            GoodsReceipt.Status.COMPLETED,
            GoodsReceipt.Status.REJECTED,
        ]:
            serializer.save(inspected_by=self.request.user)
        else:
            serializer.save()


# Create your views here.
