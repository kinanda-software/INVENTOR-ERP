
"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
} from "lucide-react";

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
  supplier: string;
  deliveryDate: string;
  items: string;
  notes: string;
};

const initialReceipts: Receipt[] = [
  {
    id: 1,
    receiptNumber: "GRN-2026-001",
    purchaseOrder: "PO-2026-001",
    supplier: "Mufindi Office Supplies",
    deliveryDate: "2026-10-10",
    items: 120,
    status: "Completed",
    notes: "All items checked and accepted.",
  },
  {
    id: 2,
    receiptNumber: "GRN-2026-002",
    purchaseOrder: "PO-2026-002",
    supplier: "Highland Transport Services",
    deliveryDate: "2026-10-11",
    items: 25,
    status: "Pending inspection",
    notes: "Waiting for quantity verification.",
  },
  {
    id: 3,
    receiptNumber: "GRN-2026-003",
    purchaseOrder: "PO-2026-003",
    supplier: "Central Stationery Store",
    deliveryDate: "2026-10-12",
    items: 60,
    status: "Rejected",
    notes: "Some items arrived damaged.",
  },
];

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
    supplier: "",
    deliveryDate: "",
    items: "1",
    notes: "",
  };
}

export default function ReceivingPage() {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<ReceiptForm>(createEmptyForm);

  // Set today's date after the component mounts.
  // This avoids evaluating the current date during prerendering.
  useEffect(() => {
    setForm((current) => ({
      ...current,
      deliveryDate: current.deliveryDate || getTodayDate(),
    }));
  }, []);

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

  function createReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextId =
      receipts.length > 0
        ? Math.max(...receipts.map((receipt) => receipt.id)) + 1
        : 1;

    const receipt: Receipt = {
      id: nextId,
      receiptNumber: `GRN-2026-${String(nextId).padStart(3, "0")}`,
      purchaseOrder: form.purchaseOrder.trim(),
      supplier: form.supplier.trim(),
      deliveryDate: form.deliveryDate,
      items: Number(form.items),
      status: "Pending inspection",
      notes: form.notes.trim(),
    };

    setReceipts((current) => [receipt, ...current]);
    setShowForm(false);
    setForm({
      ...createEmptyForm(),
      deliveryDate: getTodayDate(),
    });
    setMessage("Goods receipt created in this demo session.");
  }

  function updateStatus(receipt: Receipt, status: ReceiptStatus) {
    setReceipts((current) =>
      current.map((item) =>
        item.id === receipt.id ? { ...item, status } : item,
      ),
    );

    setSelectedReceipt(null);
    setMessage(`${receipt.receiptNumber} marked ${status.toLowerCase()}.`);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-7">
      <div className="mx-auto max-w-7xl space-y-6">
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

          <button
            type="button"
            onClick={() => {
              setMessage("");
              setForm((current) => ({
                ...current,
                deliveryDate: current.deliveryDate || getTodayDate(),
              }));
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
          >
            <Plus size={18} />
            Record goods received
          </button>
        </header>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Demo mode:</strong> these receipt records are temporary and
          are not connected to the Django database yet.
        </div>

        {message && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total receipts"
            value={receipts.length}
            description="All recorded deliveries"
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
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{receipt.receiptNumber}</p>
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
                      No matching receipts found.
                    </td>
                  </tr>
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
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={createReceipt} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purchase order number *">
                <input
                  required
                  value={form.purchaseOrder}
                  onChange={(event) =>
                    setForm({ ...form, purchaseOrder: event.target.value })
                  }
                  placeholder="PO-2026-004"
                  className="field-input"
                />
              </Field>

              <Field label="Supplier name *">
                <input
                  required
                  value={form.supplier}
                  onChange={(event) =>
                    setForm({ ...form, supplier: event.target.value })
                  }
                  placeholder="Enter supplier name"
                  className="field-input"
                />
              </Field>

              <Field label="Delivery date *">
                <input
                  required
                  type="date"
                  value={form.deliveryDate}
                  onChange={(event) =>
                    setForm({ ...form, deliveryDate: event.target.value })
                  }
                  className="field-input"
                />
              </Field>

              <Field label="Quantity of units *">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={form.items}
                  onChange={(event) =>
                    setForm({ ...form, items: event.target.value })
                  }
                  className="field-input"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Delivery notes">
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
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
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Create receipt
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedReceipt && (
        <Modal
          title={`Inspect ${selectedReceipt.receiptNumber}`}
          onClose={() => setSelectedReceipt(null)}
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

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateStatus(selectedReceipt, "Completed")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Accept goods
              </button>

              <button
                type="button"
                onClick={() => updateStatus(selectedReceipt, "Rejected")}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Reject goods
              </button>

              <button
                type="button"
                onClick={() =>
                  updateStatus(selectedReceipt, "Pending inspection")
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Keep pending
              </button>
            </div>
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
