"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Section = "overview" | "invoices" | "payments" | "expenses";

type Supplier = {
  id: number;
  name: string;
};

type PurchaseOrder = {
  id: number;
  order_number: string;
  supplier: number | Supplier;
  supplier_name?: string;
  status: string;
};

type GoodsReceipt = {
  id: number;
  receipt_number: string;
  purchase_order: number | PurchaseOrder;
  purchase_order_number?: string;
  supplier_name?: string;
  status: string;
};

type Invoice = {
  id: number;
  invoice_number: string;
  supplier: number;
  supplier_name: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  currency: string;
  amount_paid: string;
  balance_due: string;
  payment_status: string;
  notes?: string;
  purchase_order: number | null;
  purchase_order_number?: string | null;
  goods_receipt: number | null;
  goods_receipt_number?: string | null;
};

type Payment = {
  id: number;
  invoice: number;
  invoice_number: string;
  payment_reference: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  notes?: string;
};

type Expense = {
  id: number;
  expense_number: string;
  category: string;
  description: string;
  amount: string;
  expense_date: string;
  currency: string;
  payment_method: string;
  reference?: string;
  notes?: string;
};

type Summary = {
  currency: string;
  invoice_count: number;
  payment_count: number;
  expense_count: number;
  total_invoiced: string;
  total_supplier_payments: string;
  outstanding_balance: string;
  overdue_balance: string;
  total_expenses: string;
};

const emptySummary: Summary = {
  currency: "TZS",
  invoice_count: 0,
  payment_count: 0,
  expense_count: 0,
  total_invoiced: "0",
  total_supplier_payments: "0",
  outstanding_balance: "0",
  overdue_balance: "0",
  total_expenses: "0",
};

const paymentMethods = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank transfer" },
  { value: "MOBILE_MONEY", label: "Mobile money" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

function getToken(): string | null {
  if (typeof window === "undefined") return null;

  const keys = [
    "token",
    "authToken",
    "access_token",
    "accessToken",
    "jwt",
    "jwt_token",
    "audit-token",
  ];

  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }

  return null;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers[key] = value;
    });
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const responseText = await response.text();
  let data: unknown = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null
        ? "detail" in data
          ? String((data as { detail: unknown }).detail)
          : JSON.stringify(data)
        : String(data || `Request failed (${response.status})`);

    throw new Error(message);
  }

  return data as T;
}

function toList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (
    typeof data === "object" &&
    data !== null &&
    "results" in data &&
    Array.isArray((data as { results: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }

  return [];
}

function money(value: string | number, currency = "TZS"): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function today(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function statusStyle(status: string): string {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-800";
    case "PART_PAID":
      return "bg-blue-100 text-blue-800";
    case "OVERDUE":
      return "bg-red-100 text-red-800";
    case "UNPAID":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getSupplierId(order: PurchaseOrder): number {
  return typeof order.supplier === "object"
    ? order.supplier.id
    : Number(order.supplier);
}

function getReceiptOrderId(receipt: GoodsReceipt): number {
  return typeof receipt.purchase_order === "object"
    ? receipt.purchase_order.id
    : Number(receipt.purchase_order);
}

function getOrderNumber(order: PurchaseOrder): string {
  return order.order_number || `PO-${order.id}`;
}

function getReceiptNumber(receipt: GoodsReceipt): string {
  return receipt.receipt_number || `GR-${receipt.id}`;
}

function isCompletedReceipt(receipt: GoodsReceipt): boolean {
  return receipt.status?.toUpperCase() === "COMPLETED";
}

export default function FinancePage() {
  const [section, setSection] = useState<Section>("overview");

  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);

  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState("");
  const [selectedGoodsReceipt, setSelectedGoodsReceipt] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        summaryData,
        invoiceData,
        paymentData,
        expenseData,
        supplierData,
        orderData,
        receiptData,
      ] = await Promise.all([
        apiRequest<Summary>("/api/finance/summary/"),
        apiRequest<unknown>("/api/finance/invoices/"),
        apiRequest<unknown>("/api/finance/payments/"),
        apiRequest<unknown>("/api/finance/expenses/"),
        apiRequest<unknown>("/api/procurement/suppliers/"),
        apiRequest<unknown>("/api/procurement/purchase-orders/"),
        apiRequest<unknown>("/api/receiving/receipts/"),

      ]);

      setSummary({ ...emptySummary, ...summaryData });
      setInvoices(toList<Invoice>(invoiceData));
      setPayments(toList<Payment>(paymentData));
      setExpenses(toList<Expense>(expenseData));
      setSuppliers(toList<Supplier>(supplierData));
      setPurchaseOrders(toList<PurchaseOrder>(orderData));
      setGoodsReceipts(toList<GoodsReceipt>(receiptData));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load finance information.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPurchaseOrders = purchaseOrders.filter((order) => {
    if (!selectedSupplier) return false;
    return getSupplierId(order) === Number(selectedSupplier);
  });

  const filteredGoodsReceipts = goodsReceipts.filter((receipt) => {
    if (!selectedPurchaseOrder) return false;

    return (
      getReceiptOrderId(receipt) === Number(selectedPurchaseOrder) &&
      isCompletedReceipt(receipt)
    );
  });

  function handleSupplierChange(value: string) {
    setSelectedSupplier(value);
    setSelectedPurchaseOrder("");
    setSelectedGoodsReceipt("");
  }

  function handlePurchaseOrderChange(value: string) {
    setSelectedPurchaseOrder(value);
    setSelectedGoodsReceipt("");
  }

  async function submitForm(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    message: string,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(message);
      form.reset();

      if (endpoint === "/api/finance/invoices/") {
        setSelectedSupplier("");
        setSelectedPurchaseOrder("");
        setSelectedGoodsReceipt("");
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save the record.",
      );
    } finally {
      setSaving(false);
    }
  }

  const navigation: { id: Section; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "invoices", label: "Supplier invoices" },
    { id: "payments", label: "Supplier payments" },
    { id: "expenses", label: "Expenses" },
  ];

  return (
    
      <div className="w-full min-w-0 space-y-4">

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-blue-700">
            INVENTOR ERP / Finance
          </p>

          <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">
            Finance Management
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Manage supplier invoices, payments and operating expenses.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh data
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />

          <div>
            <p className="font-semibold">Finance request failed</p>
            <p className="mt-1 break-words">{error}</p>
            <p className="mt-2 text-red-700">
              Confirm that Django is running, you are logged in, and the API
              endpoints exist.
            </p>
          </div>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-1">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id);
              setError("");
              setSuccess("");
            }}
            className={`shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium transition ${
              section === item.id
                ? "border-b-2 border-blue-600 bg-blue-50 text-blue-700"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-gray-500">Loading finance records...</p>
      )}

      {section === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total invoiced"
              value={money(summary.total_invoiced)}
              description={`${summary.invoice_count} supplier invoices`}
              icon={<FileText size={21} />}
            />

            <SummaryCard
              title="Supplier payments"
              value={money(summary.total_supplier_payments)}
              description={`${summary.payment_count} recorded payments`}
              icon={<Wallet size={21} />}
            />

            <SummaryCard
              title="Outstanding balance"
              value={money(summary.outstanding_balance)}
              description="Remaining supplier liabilities"
              icon={<Receipt size={21} />}
            />

            <SummaryCard
              title="Operating expenses"
              value={money(summary.total_expenses)}
              description={`${summary.expense_count} expense records`}
              icon={<Wallet size={21} />}
            />
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-700">
              Overdue supplier balance
            </p>

            <p className="mt-2 text-2xl font-bold text-red-800">
              {money(summary.overdue_balance)}
            </p>

            <p className="mt-1 text-sm text-red-700">
              Outstanding invoices whose due dates have passed.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <h2 className="font-semibold text-gray-900">
                  Recent supplier invoices
                </h2>

                <button
                  type="button"
                  onClick={() => setSection("invoices")}
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  View all
                </button>
              </div>

              {invoices.length === 0 ? (
                <EmptyMessage message="No supplier invoices have been recorded." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {invoices.slice(0, 5).map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {invoice.invoice_number}
                          </td>

                          <td className="px-4 py-3 text-gray-600">
                            {invoice.supplier_name}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {money(invoice.balance_due, invoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <h2 className="font-semibold text-gray-900">
                  Recent expenses
                </h2>

                <button
                  type="button"
                  onClick={() => setSection("expenses")}
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  View all
                </button>
              </div>

              {expenses.length === 0 ? (
                <EmptyMessage message="No operating expenses have been recorded." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Expense</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {expenses.slice(0, 5).map((expense) => (
                        <tr key={expense.id}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {expense.expense_number}
                          </td>

                          <td className="px-4 py-3 text-gray-600">
                            {expense.category}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {money(expense.amount, expense.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {section === "invoices" && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900">
                Supplier invoices
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Invoices linked to purchase orders and completed goods
                receipts.
              </p>
            </div>

            {invoices.length === 0 ? (
              <EmptyMessage message="No invoices found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Purchase order</th>
                      <th className="px-4 py-3">Goods receipt</th>
                      <th className="px-4 py-3">Due date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                          {invoice.invoice_number}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {invoice.supplier_name}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {invoice.purchase_order_number ||
                            (invoice.purchase_order
                              ? `PO-${invoice.purchase_order}`
                              : "Not linked")}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {invoice.goods_receipt_number ||
                            (invoice.goods_receipt
                              ? `GR-${invoice.goods_receipt}`
                              : "Not linked")}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {invoice.due_date}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {money(invoice.amount, invoice.currency)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                          {money(invoice.balance_due, invoice.currency)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(invoice.payment_status)}`}
                          >
                            {invoice.payment_status.replaceAll("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Panel title="Record supplier invoice">
            <form
              className="space-y-4"
              onSubmit={(event) =>
                void submitForm(
                  event,
                  "/api/finance/invoices/",
                  "Supplier invoice recorded successfully.",
                )
              }
            >
              <div>
                <label className={labelClass}>Supplier *</label>

                <select
                  name="supplier"
                  required
                  className={inputClass}
                  value={selectedSupplier}
                  onChange={(event) =>
                    handleSupplierChange(event.target.value)
                  }
                >
                  <option value="">Select supplier</option>

                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>

                {suppliers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Add suppliers in Procurement first.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Purchase order</label>

                <select
                  name="purchase_order"
                  className={inputClass}
                  value={selectedPurchaseOrder}
                  disabled={!selectedSupplier}
                  onChange={(event) =>
                    handlePurchaseOrderChange(event.target.value)
                  }
                >
                  <option value="">No purchase order linked</option>

                  {filteredPurchaseOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {getOrderNumber(order)} — {order.status}
                    </option>
                  ))}
                </select>

                {selectedSupplier && filteredPurchaseOrders.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No purchase orders were found for this supplier.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  Completed goods receipt
                </label>

                <select
                  name="goods_receipt"
                  className={inputClass}
                  value={selectedGoodsReceipt}
                  disabled={!selectedPurchaseOrder}
                  onChange={(event) =>
                    setSelectedGoodsReceipt(event.target.value)
                  }
                >
                  <option value="">No goods receipt linked</option>

                  {filteredGoodsReceipts.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      {getReceiptNumber(receipt)} — {receipt.status}
                    </option>
                  ))}
                </select>

                {selectedPurchaseOrder &&
                  filteredGoodsReceipts.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No completed goods receipts were found for this order.
                    </p>
                  )}
              </div>

              <div>
                <label className={labelClass}>Invoice number *</label>

                <input
                  name="invoice_number"
                  required
                  maxLength={60}
                  className={inputClass}
                  placeholder="e.g. INV-2026-001"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Invoice date *</label>

                  <input
                    name="invoice_date"
                    type="date"
                    required
                    defaultValue={today()}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Due date *</label>

                  <input
                    name="due_date"
                    type="date"
                    required
                    defaultValue={today()}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Amount *</label>

                <input
                  name="amount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={labelClass}>Currency</label>

                <select
                  name="currency"
                  defaultValue="TZS"
                  className={inputClass}
                >
                  <option value="TZS">TZS — Tanzanian shilling</option>
                  <option value="USD">USD — US dollar</option>
                  <option value="KES">KES — Kenyan shilling</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Notes</label>

                <textarea
                  name="notes"
                  rows={3}
                  className={inputClass}
                  placeholder="Optional invoice notes"
                />
              </div>

              <button
                type="submit"
                disabled={saving || suppliers.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={17} />
                {saving ? "Saving..." : "Save invoice"}
              </button>
            </form>
          </Panel>
        </div>
      )}

      {section === "payments" && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900">
                Supplier payments
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Payment history for supplier invoices.
              </p>
            </div>

            {payments.length === 0 ? (
              <EmptyMessage message="No supplier payments have been recorded." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                          {payment.payment_reference}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {payment.invoice_number}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {payment.payment_date}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {paymentMethods.find(
                            (method) =>
                              method.value === payment.payment_method,
                          )?.label ?? payment.payment_method}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                          {money(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Panel title="Record supplier payment">
            <form
              className="space-y-4"
              onSubmit={(event) =>
                void submitForm(
                  event,
                  "/api/finance/payments/",
                  "Supplier payment recorded successfully.",
                )
              }
            >
              <div>
                <label className={labelClass}>Invoice *</label>

                <select
                  name="invoice"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select outstanding invoice
                  </option>

                  {invoices
                    .filter((invoice) => Number(invoice.balance_due) > 0)
                    .map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} —{" "}
                        {money(invoice.balance_due, invoice.currency)} due
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Payment reference *</label>

                <input
                  name="payment_reference"
                  required
                  maxLength={80}
                  className={inputClass}
                  placeholder="e.g. PAY-2026-001"
                />
              </div>

              <div>
                <label className={labelClass}>Amount *</label>

                <input
                  name="amount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  placeholder="0.00"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Cannot exceed the selected invoice&apos;s outstanding balance.
                </p>
              </div>

              <div>
                <label className={labelClass}>Payment date *</label>

                <input
                  name="payment_date"
                  type="date"
                  required
                  defaultValue={today()}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Payment method *</label>

                <select
                  name="payment_method"
                  required
                  defaultValue="BANK"
                  className={inputClass}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Notes</label>

                <textarea
                  name="notes"
                  rows={3}
                  className={inputClass}
                  placeholder="Optional payment notes"
                />
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  invoices.every(
                    (invoice) => Number(invoice.balance_due) <= 0,
                  )
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={17} />
                {saving ? "Saving..." : "Record payment"}
              </button>
            </form>
          </Panel>
        </div>
      )}

      {section === "expenses" && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900">
                Operating expenses
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Track business expenses and their payment methods.
              </p>
            </div>

            {expenses.length === 0 ? (
              <EmptyMessage message="No expenses have been recorded." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Expense number</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                          {expense.expense_number}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">
                            {expense.description}
                          </p>

                          <p className="text-xs text-gray-500">
                            {expense.category}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {expense.expense_date}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {paymentMethods.find(
                            (method) =>
                              method.value === expense.payment_method,
                          )?.label ?? expense.payment_method}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                          {money(expense.amount, expense.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Panel title="Record operating expense">
            <form
              className="space-y-4"
              onSubmit={(event) =>
                void submitForm(
                  event,
                  "/api/finance/expenses/",
                  "Operating expense recorded successfully.",
                )
              }
            >
              <div>
                <label className={labelClass}>Expense number *</label>

                <input
                  name="expense_number"
                  required
                  maxLength={60}
                  className={inputClass}
                  placeholder="e.g. EXP-2026-001"
                />
              </div>

              <div>
                <label className={labelClass}>Category *</label>

                <input
                  name="category"
                  required
                  maxLength={100}
                  className={inputClass}
                  placeholder="e.g. Transport, Utilities"
                />
              </div>

              <div>
                <label className={labelClass}>Description *</label>

                <input
                  name="description"
                  required
                  maxLength={255}
                  className={inputClass}
                  placeholder="Describe the expense"
                />
              </div>

              <div>
                <label className={labelClass}>Amount *</label>

                <input
                  name="amount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={labelClass}>Expense date *</label>

                <input
                  name="expense_date"
                  type="date"
                  required
                  defaultValue={today()}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Currency</label>

                <select
                  name="currency"
                  defaultValue="TZS"
                  className={inputClass}
                >
                  <option value="TZS">TZS — Tanzanian shilling</option>
                  <option value="USD">USD — US dollar</option>
                  <option value="KES">KES — Kenyan shilling</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Payment method *</label>

                <select
                  name="payment_method"
                  required
                  defaultValue="CASH"
                  className={inputClass}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Reference</label>

                <input
                  name="reference"
                  maxLength={100}
                  className={inputClass}
                  placeholder="Receipt or transaction reference"
                />
              </div>

              <div>
                <label className={labelClass}>Notes</label>

                <textarea
                  name="notes"
                  rows={3}
                  className={inputClass}
                  placeholder="Optional notes"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={17} />
                {saving ? "Saving..." : "Save expense"}
              </button>
            </form>
          </Panel>
        </div>
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
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>

        <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
          {icon}
        </span>
      </div>

      <p className="mt-4 break-words text-2xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="p-8 text-center">
      <Receipt className="mx-auto text-gray-300" size={32} />
      <p className="mt-3 text-sm text-gray-500">{message}</p>
    </div>
  );
}