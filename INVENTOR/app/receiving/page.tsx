
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ClipboardCheck,
  PackageCheck,
  Clock3,
  AlertTriangle,
  Search,
  Plus,
  X,
  Eye,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ApiReceipt = {
  id: number;
  receipt_number: string;
  purchase_order: number;
  purchase_order_number: string;
  supplier_name: string;
  delivery_date: string;
  quantity_received: number | string;
  status: "PENDING_INSPECTION" | "COMPLETED" | "REJECTED";
  notes: string;
};

type ApiPurchaseOrderItem = {
  id: number;
  purchase_order: number;
  description: string;
  quantity: number | string;
  received_quantity: number | string;
  inventory_item_id: number | null;
  inventory_item_name: string | null;
  unit_of_measure: string;
};

type ApiPurchaseOrder = {
  id: number;
  order_number: string;
  supplier_name: string;
  status: string;
  items: ApiPurchaseOrderItem[];
};

type ReceiptStatus = "Pending inspection" | "Completed" | "Rejected";

type Receipt = {
  id: number;
  receiptNumber: string;
  purchaseOrder: string;
  supplier: string;
  deliveryDate: string;
  items: number;
  status: ReceiptStatus;
  notes: string;
};

type ReceiptForm = {
  purchaseOrder: string;
  purchaseOrderItem: string;
  supplier: string;
  deliveryDate: string;
  items: string;
  notes: string;
};

const statusStyles: Record<ReceiptStatus, string> = {
  "Pending inspection": "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
};

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyForm(): ReceiptForm {
  return {
    purchaseOrder: "",
    purchaseOrderItem: "",
    supplier: "",
    deliveryDate: "",
    items: "1",
    notes: "",
  };
}

function getAuthHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

function getStatus(status: string): ReceiptStatus {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Rejected";
    default:
      return "Pending inspection";
  }
}

function getApiStatus(status: ReceiptStatus): string {
  switch (status) {
    case "Completed":
      return "COMPLETED";
    case "Rejected":
      return "REJECTED";
    default:
      return "PENDING_INSPECTION";
  }
}

function mapReceipt(data: ApiReceipt): Receipt {
  return {
    id: data.id,
    receiptNumber: data.receipt_number,
    purchaseOrder: data.purchase_order_number,
    supplier: data.supplier_name,
    deliveryDate: data.delivery_date,
    items: Number(data.quantity_received),
    status: getStatus(data.status),
    notes: data.notes || "",
  };
}

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (
    data !== null &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray((data as { results: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }

  return [];
}

async function parseResponse(response: Response): Promise<unknown> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    if (data && typeof data === "object") {
      const body = data as Record<string, unknown>;

      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (typeof body.message === "string") {
        message = body.message;
      } else if (body.non_field_errors) {
        message = String(body.non_field_errors);
      } else {
        message = Object.entries(body)
          .map(([key, value]) => {
            const detail = Array.isArray(value)
              ? value.join(", ")
              : typeof value === "object" && value !== null
                ? JSON.stringify(value)
                : String(value);

            return `${key}: ${detail}`;
          })
          .join(" | ");
      }
    }

    if (response.status === 401 || response.status === 403) {
      message +=
        " Check that you are logged in and your API token is valid.";
    }

    throw new Error(message);
  }

  return data;
}

export default function ReceivingPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ApiPurchaseOrder[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [form, setForm] = useState<ReceiptForm>(createEmptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      deliveryDate: current.deliveryDate || getTodayDate(),
    }));
  }, []);

  const showError = useCallback((error: unknown) => {
    setMessage(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.",
    );
    setMessageType("error");
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const headers = getAuthHeaders();

    if (!headers.Authorization) {
      setReceipts([]);
      setPurchaseOrders([]);
      setLoading(false);
      setMessageType("error");
      setMessage("Please log in first. No authentication token was found.");
      return;
    }

    try {
      const [receiptResponse, orderResponse] = await Promise.all([
        fetch(`${API_URL}/api/receiving/receipts/`, {
          method: "GET",
          headers,
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/procurement/purchase-orders/`, {
          method: "GET",
          headers,
          cache: "no-store",
        }),
      ]);

      const [receiptData, orderData] = await Promise.all([
        parseResponse(receiptResponse),
        parseResponse(orderResponse),
      ]);

      const receiptList = normalizeList<ApiReceipt>(receiptData);
      const orderList = normalizeList<ApiPurchaseOrder>(orderData);

      setReceipts(receiptList.map(mapReceipt));
      setPurchaseOrders(orderList);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const approvedPurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (order) => order.status.toUpperCase() === "APPROVED",
      ),
    [purchaseOrders],
  );

  const selectedPurchaseOrder = useMemo(
    () =>
      approvedPurchaseOrders.find(
        (order) => String(order.id) === form.purchaseOrder,
      ),
    [approvedPurchaseOrders, form.purchaseOrder],
  );

  const receivableItems = useMemo(
    () =>
      (selectedPurchaseOrder?.items ?? []).filter((item) => {
        const remaining =
          Number(item.quantity) - Number(item.received_quantity);

        return item.inventory_item_id !== null && remaining > 0;
      }),
    [selectedPurchaseOrder],
  );

  const selectedPurchaseOrderItem = receivableItems.find(
    (item) => String(item.id) === form.purchaseOrderItem,
  );

  const remainingQuantity = selectedPurchaseOrderItem
    ? Math.max(
        0,
        Number(selectedPurchaseOrderItem.quantity) -
          Number(selectedPurchaseOrderItem.received_quantity),
      )
    : 0;

  const pending = receipts.filter(
    (receipt) => receipt.status === "Pending inspection",
  ).length;

  const completed = receipts.filter(
    (receipt) => receipt.status === "Completed",
  ).length;

  const rejected = receipts.filter(
    (receipt) => receipt.status === "Rejected",
  ).length;

  const filteredReceipts = useMemo(() => {
    const query = search.toLowerCase().trim();

    return receipts.filter((receipt) => {
      const matchesSearch = [
        receipt.receiptNumber,
        receipt.purchaseOrder,
        receipt.supplier,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      return (
        matchesSearch &&
        (statusFilter === "All" || receipt.status === statusFilter)
      );
    });
  }, [receipts, search, statusFilter]);

  function handlePurchaseOrderChange(orderId: string) {
    const selectedOrder = approvedPurchaseOrders.find(
      (order) => String(order.id) === orderId,
    );

    const availableItems = (selectedOrder?.items ?? []).filter((item) => {
      const remaining =
        Number(item.quantity) - Number(item.received_quantity);

      return item.inventory_item_id !== null && remaining > 0;
    });

    setForm((current) => ({
      ...current,
      purchaseOrder: orderId,
      purchaseOrderItem: String(availableItems[0]?.id ?? ""),
      supplier: selectedOrder?.supplier_name || "",
      items: "1",
    }));
  }

  async function createReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.purchaseOrder) {
      setMessageType("error");
      setMessage("Please select an approved purchase order.");
      return;
    }

    if (!form.purchaseOrderItem || !selectedPurchaseOrderItem) {
      setMessageType("error");
      setMessage("Select a purchase order item that still has quantity remaining.");
      return;
    }

    if (!form.deliveryDate) {
      setMessageType("error");
      setMessage("Please select a delivery date.");
      return;
    }

    const quantity = Number(form.items);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessageType("error");
      setMessage("Quantity must be greater than zero.");
      return;
    }

    if (quantity > remainingQuantity) {
      setMessageType("error");
      setMessage(
        `You can receive at most ${remainingQuantity} ${selectedPurchaseOrderItem.unit_of_measure} for this purchase order item.`,
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/receiving/receipts/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          purchase_order: Number(form.purchaseOrder),
          delivery_date: form.deliveryDate,
          quantity_received: quantity,
          notes: form.notes.trim(),
          lines: [
            {
              purchase_order_item: Number(form.purchaseOrderItem),
              quantity_received: quantity,
            },
          ],
        }),
      });

      const data = (await parseResponse(response)) as ApiReceipt;
      const newReceipt = mapReceipt(data);

      setShowForm(false);
      setForm({
        ...createEmptyForm(),
        deliveryDate: getTodayDate(),
      });

      await loadData();

      setMessageType("success");
      setMessage(`Receipt ${newReceipt.receiptNumber} saved successfully.`);
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(receipt: Receipt, status: ReceiptStatus) {
    if (receipt.status !== "Pending inspection") {
      setMessageType("error");
      setMessage("Only receipts pending inspection can be updated.");
      return;
    }

    if (status === "Pending inspection") {
      setMessageType("error");
      setMessage("Choose Accept goods or Reject goods to finish inspection.");
      return;
    }

    setMessage("");
    setUpdatingStatus(true);

    try {
      const response = await fetch(
        `${API_URL}/api/receiving/receipts/${receipt.id}/`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: getApiStatus(status),
          }),
        },
      );

      const data = (await parseResponse(response)) as ApiReceipt;
      const updatedReceipt = mapReceipt(data);

      setReceipts((current) =>
        current.map((item) =>
          item.id === updatedReceipt.id ? updatedReceipt : item,
        ),
      );

      setSelectedReceipt(null);
      setMessageType("success");
      setMessage(
        `${updatedReceipt.receiptNumber} marked ${updatedReceipt.status.toLowerCase()}.`,
      );
    } catch (error) {
      showError(error);
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="min-h-0 w-full min-w-0 bg-slate-50 p-0 text-slate-900">
       <div className="w-full min-w-0 space-y-4">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <PackageCheck size={18} />
              INVENTORY OPERATIONS
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Goods Receiving
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Record deliveries, inspect received goods and track receipt status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                setMessage("");
                setForm((current) => ({
                  ...createEmptyForm(),
                  deliveryDate: current.deliveryDate || getTodayDate(),
                }));
                setShowForm(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <Plus size={18} />
              Record goods received
            </button>
          </div>
        </header>

        {message && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${
              messageType === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {messageType === "error" ? (
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total receipts"
            value={receipts.length}
            description="Saved deliveries"
            icon={<ClipboardCheck size={22} />}
          />

          <SummaryCard
            title="Pending inspection"
            value={pending}
            description="Awaiting verification"
            icon={<Clock3 size={22} />}
          />

          <SummaryCard
            title="Completed"
            value={completed}
            description="Accepted deliveries"
            icon={<PackageCheck size={22} />}
          />

          <SummaryCard
            title="Rejected"
            value={rejected}
            description="Require follow-up"
            icon={<AlertTriangle size={22} />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold">Receipt register</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review deliveries and their inspection status.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search receipt or supplier..."
                  aria-label="Search receipts"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-600 sm:w-72"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter receipts by status"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="All">All statuses</option>
                <option value="Pending inspection">Pending inspection</option>
                <option value="Completed">Completed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Receipt / PO</th>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4">Delivery date</th>
                  <th className="px-5 py-4">Items / units</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle size={18} className="animate-spin" />
                        Loading receipts from Django...
                      </span>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredReceipts.map((receipt) => (
                      <tr key={receipt.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="font-semibold">
                            {receipt.receiptNumber}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {receipt.purchaseOrder}
                          </p>
                        </td>

                        <td className="px-5 py-4 font-medium">
                          {receipt.supplier}
                        </td>

                        <td className="px-5 py-4">{receipt.deliveryDate}</td>

                        <td className="px-5 py-4">{receipt.items}</td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[receipt.status]}`}
                          >
                            {receipt.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(receipt)}
                            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                          >
                            <Eye size={15} />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredReceipts.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-10 text-center text-slate-500"
                        >
                          {receipts.length === 0
                            ? "No receipts found in the database."
                            : "No matching receipts found."}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            Showing {filteredReceipts.length} of {receipts.length} receipts
          </div>
        </section>
      </div>

      {showForm && (
        <Modal
          title="Record goods received"
          onClose={() => !saving && setShowForm(false)}
        >
          <form onSubmit={createReceipt} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Approved purchase order *">
                <select
                  required
                  value={form.purchaseOrder}
                  onChange={(event) =>
                    handlePurchaseOrderChange(event.target.value)
                  }
                  className="field-input"
                >
                  <option value="">Select purchase order</option>
                  {approvedPurchaseOrders.map((order) => (
                    <option key={order.id} value={String(order.id)}>
                      {order.order_number} — {order.supplier_name}
                    </option>
                  ))}
                </select>

                {approvedPurchaseOrders.length === 0 && (
                  <span className="mt-1 block text-xs text-amber-700">
                    No approved purchase orders found. Approve a purchase order
                    first.
                  </span>
                )}
              </Field>

              <Field label="Supplier">
                <input
                  readOnly
                  value={form.supplier}
                  placeholder="Selected from purchase order"
                  className="field-input bg-slate-50"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Purchase order item *">
                  <select
                    required
                    value={form.purchaseOrderItem}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        purchaseOrderItem: event.target.value,
                        items: "1",
                      }))
                    }
                    disabled={!form.purchaseOrder || receivableItems.length === 0}
                    className="field-input"
                  >
                    <option value="">Select item to receive</option>
                    {receivableItems.map((item) => {
                      const remaining =
                        Number(item.quantity) - Number(item.received_quantity);

                      return (
                        <option key={item.id} value={String(item.id)}>
                          {item.description}
                          {item.inventory_item_name &&
                          item.inventory_item_name !== item.description
                            ? ` — ${item.inventory_item_name}`
                            : ""}
                          {" (remaining: "}
                          {remaining} {item.unit_of_measure || "units"}
                          {")"}
                        </option>
                      );
                    })}
                  </select>

                  {form.purchaseOrder && receivableItems.length === 0 && (
                    <span className="mt-1 block text-xs text-amber-700">
                      No receivable items remain on this purchase order, or its
                      items are not linked to inventory products.
                    </span>
                  )}
                </Field>
              </div>

              <Field label="Delivery date *">
                <input
                  required
                  type="date"
                  value={form.deliveryDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      deliveryDate: event.target.value,
                    }))
                  }
                  className="field-input"
                />
              </Field>

              <Field label="Quantity received *">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="any"
                  max={remainingQuantity || undefined}
                  value={form.items}
                  disabled={!selectedPurchaseOrderItem}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      items: event.target.value,
                    }))
                  }
                  className="field-input"
                />

                {selectedPurchaseOrderItem && (
                  <span className="mt-1 block text-xs text-slate-500">
                    Remaining: {remainingQuantity}{" "}
                    {selectedPurchaseOrderItem.unit_of_measure || "units"}
                  </span>
                )}
              </Field>

              <div className="sm:col-span-2">
                <Field label="Delivery notes">
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Describe the delivered goods or any issues..."
                    className="field-input"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  approvedPurchaseOrders.length === 0 ||
                  !selectedPurchaseOrderItem
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <LoaderCircle size={16} className="animate-spin" />}
                {saving ? "Saving..." : "Create receipt"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedReceipt && (
        <Modal
          title={`Inspect ${selectedReceipt.receiptNumber}`}
          onClose={() => !updatingStatus && setSelectedReceipt(null)}
        >
          <div className="space-y-4 text-sm">
            <Detail
              label="Purchase order"
              value={selectedReceipt.purchaseOrder}
            />

            <Detail label="Supplier" value={selectedReceipt.supplier} />

            <Detail
              label="Delivery date"
              value={selectedReceipt.deliveryDate}
            />

            <Detail
              label="Units received"
              value={String(selectedReceipt.items)}
            />

            <Detail
              label="Notes"
              value={selectedReceipt.notes || "No notes"}
            />

            <Detail label="Current status" value={selectedReceipt.status} />

            <p className="font-semibold">Update inspection status</p>

            {selectedReceipt.status === "Pending inspection" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() =>
                    void updateStatus(selectedReceipt, "Completed")
                  }
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Accept goods
                </button>

                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() =>
                    void updateStatus(selectedReceipt, "Rejected")
                  }
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject goods
                </button>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-slate-600">
                This receipt has already been {selectedReceipt.status.toLowerCase()}.
                Its inspection status cannot be changed here.
              </p>
            )}

            {updatingStatus && (
              <p className="flex items-center gap-2 text-slate-500">
                <LoaderCircle size={16} className="animate-spin" />
                Updating inspection status...
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
          {icon}
        </span>
      </div>

      <p className="mt-4 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium sm:text-right">{value}</span>
    </div>
  );
}
