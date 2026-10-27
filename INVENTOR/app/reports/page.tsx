
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Wallet,
  FileDown,
  Search,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  FileText,
  RefreshCw,
  XCircle,
  LoaderCircle,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type ReportTab = "Overview" | "Financial" | "Inventory" | "Fleet & Trips";

type Transaction = {
  id: number;
  date: string;
  reference: string;
  description: string;
  category: string;
  type: "Supplier Invoice" | "Supplier Payment" | "Expense";
  amount: number;
  balance: number;
  status: "Paid" | "Pending" | "Overdue" | "Recorded";
};

type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  quantity: number;
  reorderLevel: number;
  unit: string;
  unitCost: number;
};

type Vehicle = {
  id: number;
  registration: string;
  model: string;
  driver: string;
  capacity: number;
  status: "Available" | "On Trip" | "Maintenance";
};

type Trip = {
  id: number;
  reference: string;
  vehicle: string;
  driver: string;
  origin: string;
  destination: string;
  date: string;
  status: "Planned" | "In Progress" | "Completed" | "Cancelled";
  cost: number;
};

type ApiInvoice = {
  id: number;
  invoice_number?: string;
  supplier_name?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  amount?: string | number | null;
  amount_paid?: string | number | null;
  balance_due?: string | number | null;
  payment_status?: string | null;
};

type ApiPayment = {
  id: number;
  payment_reference?: string | null;
  invoice_number?: string | null;
  payment_date?: string | null;
  amount?: string | number | null;
  payment_method?: string | null;
};

type ApiExpense = {
  id: number;
  expense_number?: string | null;
  category?: string | null;
  description?: string | null;
  amount?: string | number | null;
  expense_date?: string | null;
  payment_method?: string | null;
};

type ApiInventoryItem = {
  id: number;
  code?: string | null;
  name?: string | null;
  category?: string | null;
  warehouse?: string | null;
  quantity_on_hand?: string | number | null;
  reorder_level?: string | number | null;
  unit_of_measure?: string | null;
  unit_cost?: string | number | null;
  is_active?: boolean;
};

type ApiStockBalance = {
  id: number;
  item?: number | { id?: number; code?: string; name?: string };
  item_code?: string | null;
  item_name?: string | null;
  quantity_on_hand?: string | number | null;
};

type ApiVehicle = {
  id: number;
  registration?: string | null;
  make?: string | null;
  model?: string | null;
  type?: string | null;
  capacity?: string | number | null;
  driver?: string | number | { name?: string; full_name?: string } | null;
  status?: string | null;
};

type ApiTrip = {
  id: number;
  reference?: string | null;
  vehicle?: string | number | { registration?: string } | null;
  vehicle_registration?: string | null;
  driver?: string | number | { name?: string; full_name?: string } | null;
  origin?: string | null;
  destination?: string | null;
  departure_date?: string | null;
  status?: string | null;
  total_expenses?: string | number | null;
};

type ApiResult<T> = {
  data: T[];
  error: string | null;
};

type ReportData = {
  invoices: ApiResult<ApiInvoice>;
  payments: ApiResult<ApiPayment>;
  expenses: ApiResult<ApiExpense>;
  items: ApiResult<ApiInventoryItem>;
  balances: ApiResult<ApiStockBalance>;
  vehicles: ApiResult<ApiVehicle>;
  trips: ApiResult<ApiTrip>;
};

/* =========================================================
   API CONFIGURATION
========================================================= */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

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
    const value = window.localStorage.getItem(key)?.trim();

    if (value) return value;
  }

  return null;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication required. Please sign in again.");
    }

    if (response.status === 403) {
      throw new Error(`You do not have permission to access ${path}.`);
    }

    throw new Error(`${path} returned HTTP ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function getList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object" && "results" in data) {
    const results = (data as { results?: unknown }).results;

    if (Array.isArray(results)) return results as T[];
  }

  throw new Error("The API returned an unexpected list format.");
}

async function loadEndpoint<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await apiGet<unknown>(path);

    return {
      data: getList<T>(response),
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error.message : "Unable to load data.",
    };
  }
}

function emptyResult<T>(): ApiResult<T> {
  return { data: [], error: null };
}

function createEmptyReportData(): ReportData {
  return {
    invoices: emptyResult<ApiInvoice>(),
    payments: emptyResult<ApiPayment>(),
    expenses: emptyResult<ApiExpense>(),
    items: emptyResult<ApiInventoryItem>(),
    balances: emptyResult<ApiStockBalance>(),
    vehicles: emptyResult<ApiVehicle>(),
    trips: emptyResult<ApiTrip>(),
  };
}

/* =========================================================
   HELPERS
========================================================= */

function amount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    const item = value as {
      name?: string;
      full_name?: string;
      registration?: string;
      code?: string;
      id?: number;
    };

    return (
      item.name ||
      item.full_name ||
      item.registration ||
      item.code ||
      (item.id !== undefined ? String(item.id) : fallback)
    );
  }

  return String(value);
}

function dateValue(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function normalizeVehicleStatus(
  value?: string | null,
): Vehicle["status"] {
  const status = (value ?? "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();

  if (
    status.includes("trip") ||
    status.includes("progress") ||
    status === "in use" ||
    status === "on trip"
  ) {
    return "On Trip";
  }

  if (status.includes("maint") || status.includes("repair")) {
    return "Maintenance";
  }

  return "Available";
}

function normalizeTripStatus(value?: string | null): Trip["status"] {
  const status = (value ?? "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();

  if (status.includes("cancel")) return "Cancelled";

  if (
    status.includes("progress") ||
    status === "ongoing" ||
    status === "active"
  ) {
    return "In Progress";
  }

  if (status.includes("complete") || status === "delivered") {
    return "Completed";
  }

  return "Planned";
}

function normalizeInvoiceStatus(
  value?: string | null,
  dueDate?: string | null,
  balanceDue?: number,
): Transaction["status"] {
  if (balanceDue !== undefined && balanceDue <= 0) return "Paid";

  const status = (value ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "_");

  if (status === "PAID") return "Paid";
  if (status === "OVERDUE") return "Overdue";

  const today = new Date().toISOString().slice(0, 10);

  if (dueDate && dateValue(dueDate) < today) return "Overdue";

  return "Pending";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-TZ", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function withinDateRange(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  if (!date) return !startDate && !endDate;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;

  return true;
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Recorded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Pending: "bg-amber-50 text-amber-700 ring-amber-200",
    Planned: "bg-blue-50 text-blue-700 ring-blue-200",
    "In Progress": "bg-blue-50 text-blue-700 ring-blue-200",
    "On Trip": "bg-blue-50 text-blue-700 ring-blue-200",
    Overdue: "bg-red-50 text-red-700 ring-red-200",
    Maintenance: "bg-orange-50 text-orange-700 ring-orange-200",
    Cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[status] ?? "bg-gray-100 text-gray-700 ring-gray-200"
      }`}
    >
      {status}
    </span>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Wallet;
  tone?: "blue" | "green" | "orange" | "purple";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-2 text-xs text-gray-500">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${tones[tone]}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-gray-100 p-4">
        <FileText size={26} className="text-gray-400" />
      </div>
      <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500">{description}</p>
    </div>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function DataTable({
  headers,
  children,
  emptyTitle,
  emptyDescription,
  isEmpty,
}: {
  headers: string[];
  children: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-5 py-4 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

/* =========================================================
   MAIN REPORTS PAGE
========================================================= */

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("Overview");
  const [reportData, setReportData] = useState<ReportData>(
    createEmptyReportData,
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setGlobalError("");

    try {
      const [
        invoices,
        payments,
        expenses,
        items,
        balances,
        vehicles,
        trips,
      ] = await Promise.all([
        loadEndpoint<ApiInvoice>("/api/finance/invoices/"),
        loadEndpoint<ApiPayment>("/api/finance/payments/"),
        loadEndpoint<ApiExpense>("/api/finance/expenses/"),
        loadEndpoint<ApiInventoryItem>("/api/inventory/items/"),
        loadEndpoint<ApiStockBalance>("/api/inventory/balances/"),
        loadEndpoint<ApiVehicle>("/api/trucking/vehicles/"),
        loadEndpoint<ApiTrip>("/api/trucking/trips/"),
      ]);

      const nextData: ReportData = {
        invoices,
        payments,
        expenses,
        items,
        balances,
        vehicles,
        trips,
      };

      setReportData(nextData);

      const successfulEndpoints = [
        invoices,
        payments,
        expenses,
        items,
        balances,
        vehicles,
        trips,
      ].filter((result) => !result.error).length;

      if (successfulEndpoints === 0) {
        setGlobalError(
          "All report endpoints failed. Check that Django is running, your authentication token is valid, and the API URLs are correct.",
        );
      }
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "Unable to load reports.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  /* Map API records into the report's display models. */

  const transactions = useMemo<Transaction[]>(() => {
    const invoiceTransactions: Transaction[] =
      reportData.invoices.data.map((invoice) => {
        const balance = amount(invoice.balance_due);
        const total = amount(invoice.amount);

        return {
          id: invoice.id,
          date: dateValue(invoice.invoice_date),
          reference: invoice.invoice_number || `INV-${invoice.id}`,
          description: textValue(invoice.supplier_name, "Supplier invoice"),
          category: "Supplier Invoice",
          type: "Supplier Invoice",
          amount: total,
          balance,
          status: normalizeInvoiceStatus(
            invoice.payment_status,
            invoice.due_date,
            balance,
          ),
        };
      });

    const paymentTransactions: Transaction[] =
      reportData.payments.data.map((payment) => ({
        id: payment.id,
        date: dateValue(payment.payment_date),
        reference:
          payment.payment_reference || `PAY-${payment.id}`,
        description: payment.invoice_number
          ? `Payment for ${payment.invoice_number}`
          : `Supplier payment${payment.payment_method ? ` — ${payment.payment_method}` : ""}`,
        category: "Supplier Payment",
        type: "Supplier Payment",
        amount: amount(payment.amount),
        balance: 0,
        status: "Recorded",
      }));

    const expenseTransactions: Transaction[] =
      reportData.expenses.data.map((expense) => ({
        id: expense.id,
        date: dateValue(expense.expense_date),
        reference: expense.expense_number || `EXP-${expense.id}`,
        description: textValue(expense.description, "General expense"),
        category: textValue(expense.category, "General"),
        type: "Expense",
        amount: amount(expense.amount),
        balance: 0,
        status: "Recorded",
      }));

    return [
      ...invoiceTransactions,
      ...paymentTransactions,
      ...expenseTransactions,
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [reportData]);

  const inventoryItems = useMemo<InventoryItem[]>(() => {
    const balancesById = new Map<number, number>();
    const balancesByCode = new Map<string, number>();

    reportData.balances.data.forEach((balance) => {
      const quantity = amount(balance.quantity_on_hand);

      const itemValue =
        typeof balance.item === "object" && balance.item !== null
          ? balance.item.id
          : balance.item;

      if (typeof itemValue === "number") {
        balancesById.set(itemValue, quantity);
      }

      const code =
        balance.item_code ||
        (typeof balance.item === "object" && balance.item !== null
          ? balance.item.code
          : undefined);

      if (code) balancesByCode.set(code, quantity);
    });

    return reportData.items.data.map((item) => {
      const balanceQuantity =
        balancesById.get(item.id) ??
        (item.code ? balancesByCode.get(item.code) : undefined);

      return {
        id: item.id,
        sku: textValue(item.code, `ITEM-${item.id}`),
        name: textValue(item.name, "Unnamed item"),
        category: textValue(item.category, "Uncategorised"),
        warehouse: textValue(item.warehouse, "Main warehouse"),
        quantity: amount(
          balanceQuantity ?? item.quantity_on_hand,
        ),
        reorderLevel: amount(item.reorder_level),
        unit: textValue(item.unit_of_measure, "Units"),
        unitCost: amount(item.unit_cost),
      };
    });
  }, [reportData]);

  const vehicles = useMemo<Vehicle[]>(() => {
    return reportData.vehicles.data.map((vehicle) => ({
      id: vehicle.id,
      registration: textValue(
        vehicle.registration,
        `VEH-${vehicle.id}`,
      ),
      model: [vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" ") || textValue(vehicle.type, "Vehicle"),
      driver: textValue(vehicle.driver),
      capacity: amount(vehicle.capacity),
      status: normalizeVehicleStatus(vehicle.status),
    }));
  }, [reportData]);

  const trips = useMemo<Trip[]>(() => {
    return reportData.trips.data.map((trip) => ({
      id: trip.id,
      reference: trip.reference || `TRIP-${trip.id}`,
      vehicle: textValue(
        trip.vehicle_registration || trip.vehicle,
        "Vehicle not assigned",
      ),
      driver: textValue(trip.driver),
      origin: textValue(trip.origin),
      destination: textValue(trip.destination),
      date: dateValue(trip.departure_date),
      status: normalizeTripStatus(trip.status),
      cost: amount(trip.total_expenses),
    }));
  }, [reportData]);

  /* Apply date filters to dated records. */

  const filteredTransactions = useMemo(() => {
    const query = search.toLowerCase().trim();

    return transactions.filter((transaction) => {
      const matchesDate = withinDateRange(
        transaction.date,
        startDate,
        endDate,
      );

      const matchesSearch =
        !query ||
        [
          transaction.reference,
          transaction.description,
          transaction.category,
          transaction.type,
          transaction.status,
        ].some((value) => value.toLowerCase().includes(query));

      return matchesDate && matchesSearch;
    });
  }, [transactions, search, startDate, endDate]);

  const filteredInventory = useMemo(() => {
    const query = search.toLowerCase().trim();

    return inventoryItems.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.sku,
          item.name,
          item.category,
          item.warehouse,
        ].some((value) => value.toLowerCase().includes(query));

      return matchesSearch;
    });
  }, [inventoryItems, search]);

  const filteredVehicles = useMemo(() => {
    const query = search.toLowerCase().trim();

    return vehicles.filter((vehicle) => {
      return (
        !query ||
        [
          vehicle.registration,
          vehicle.model,
          vehicle.driver,
          vehicle.status,
        ].some((value) => value.toLowerCase().includes(query))
      );
    });
  }, [vehicles, search]);

  const filteredTrips = useMemo(() => {
    const query = search.toLowerCase().trim();

    return trips.filter((trip) => {
      const matchesDate = withinDateRange(
        trip.date,
        startDate,
        endDate,
      );

      const matchesSearch =
        !query ||
        [
          trip.reference,
          trip.vehicle,
          trip.driver,
          trip.origin,
          trip.destination,
          trip.status,
        ].some((value) => value.toLowerCase().includes(query));

      return matchesDate && matchesSearch;
    });
  }, [trips, search, startDate, endDate]);

  /* Financial figures use their respective record types. */

  const totalInvoiced = useMemo(
    () =>
      filteredTransactions
        .filter((item) => item.type === "Supplier Invoice")
        .reduce((sum, item) => sum + item.amount, 0),
    [filteredTransactions],
  );

  const totalPayments = useMemo(
    () =>
      filteredTransactions
        .filter((item) => item.type === "Supplier Payment")
        .reduce((sum, item) => sum + item.amount, 0),
    [filteredTransactions],
  );

  const totalExpenses = useMemo(
    () =>
      filteredTransactions
        .filter((item) => item.type === "Expense")
        .reduce((sum, item) => sum + item.amount, 0),
    [filteredTransactions],
  );

  const outstandingPayables = useMemo(
    () =>
      filteredTransactions
        .filter((item) => item.type === "Supplier Invoice")
        .reduce((sum, item) => sum + Math.max(item.balance, 0), 0),
    [filteredTransactions],
  );

  const overdueInvoices = filteredTransactions.filter(
    (item) =>
      item.type === "Supplier Invoice" && item.status === "Overdue",
  ).length;

  const inventoryValue = filteredInventory.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );

  const lowStockItems = filteredInventory.filter(
    (item) => item.quantity <= item.reorderLevel,
  );

  const activeTrips = filteredTrips.filter(
    (trip) =>
      trip.status === "In Progress" || trip.status === "Planned",
  ).length;

  const totalTripExpenses = filteredTrips.reduce(
    (sum, trip) => sum + trip.cost,
    0,
  );

  const tabOptions: {
    label: ReportTab;
    icon: typeof BarChart3;
  }[] = [
    { label: "Overview", icon: BarChart3 },
    { label: "Financial", icon: Wallet },
    { label: "Inventory", icon: Package },
    { label: "Fleet & Trips", icon: Truck },
  ];

  /* CSV exports */

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);

    if (activeTab === "Inventory") {
      exportCsv(`inventory-report-${stamp}.csv`, [
        [
          "SKU",
          "Item",
          "Category",
          "Warehouse",
          "Quantity",
          "Unit",
          "Reorder Level",
          "Unit Cost (TZS)",
          "Stock Value (TZS)",
        ],
        ...filteredInventory.map((item) => [
          item.sku,
          item.name,
          item.category,
          item.warehouse,
          item.quantity,
          item.unit,
          item.reorderLevel,
          item.unitCost,
          item.quantity * item.unitCost,
        ]),
      ]);

      return;
    }

    if (activeTab === "Fleet & Trips") {
      exportCsv(`trips-report-${stamp}.csv`, [
        [
          "Reference",
          "Vehicle",
          "Driver",
          "Origin",
          "Destination",
          "Date",
          "Status",
          "Expenses (TZS)",
        ],
        ...filteredTrips.map((trip) => [
          trip.reference,
          trip.vehicle,
          trip.driver,
          trip.origin,
          trip.destination,
          trip.date,
          trip.status,
          trip.cost,
        ]),
      ]);

      return;
    }

    exportCsv(`financial-report-${stamp}.csv`, [
      [
        "Date",
        "Reference",
        "Description",
        "Category",
        "Record Type",
        "Amount (TZS)",
        "Outstanding Balance (TZS)",
        "Status",
      ],
      ...filteredTransactions.map((item) => [
        item.date,
        item.reference,
        item.description,
        item.category,
        item.type,
        item.amount,
        item.balance,
        item.status,
      ]),
    ]);
  }

  const endpointErrors = [
    reportData.invoices.error,
    reportData.payments.error,
    reportData.expenses.error,
    reportData.items.error,
    reportData.balances.error,
    reportData.vehicles.error,
    reportData.trips.error,
  ].filter(Boolean);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
     <div className="w-full min-w-0 space-y-4">
      <div className="w-full min-w-0 space-y-4">
        {/* Header */}

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <BarChart3 size={17} />
              Business Intelligence
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              Reports & Analytics
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Financial performance, stock position, and transport
              operations from your ERP records.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadReports(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <RefreshCw size={17} />
              )}
              Refresh
            </button>

            <button
              onClick={handleExport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileDown size={17} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Global errors */}

        {globalError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <XCircle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Reports could not load</p>
              <p className="mt-1">{globalError}</p>
              <p className="mt-2">
                Confirm Django is running at {API_URL} and check the
                browser console for network errors.
              </p>
            </div>
          </div>
        )}

        {!globalError && endpointErrors.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                Some report data could not be loaded
              </p>
              <p className="mt-1">
                Some figures or tables may be incomplete. Check the
                affected API endpoints below.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="report-search"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Search records
              </label>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="report-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search references, items, vehicles..."
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-start-date"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                From date
              </label>

              <div className="relative">
                <CalendarDays
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="report-start-date"
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="report-end-date"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                To date
              </label>

              <div className="relative">
                <CalendarDays
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="report-end-date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {(search || startDate || endDate) && (
            <button
              onClick={() => {
                setSearch("");
                setStartDate("");
                setEndDate("");
              }}
              className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Tabs */}

        <div className="overflow-x-auto border-b border-gray-200">
          <div className="flex min-w-max gap-2">
            {tabOptions.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === label
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}

        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <LoaderCircle
              size={34}
              className="animate-spin text-blue-700"
            />
            <p className="mt-4 font-semibold text-gray-800">
              Loading reports...
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Fetching records from the ERP backend.
            </p>
          </div>
        ) : (
          <>
            {/* OVERVIEW */}

            {activeTab === "Overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Supplier Invoices"
                    value={formatMoney(totalInvoiced)}
                    description="Invoice amounts in the selected period"
                    icon={FileText}
                    tone="blue"
                  />

                  <MetricCard
                    title="Supplier Payments"
                    value={formatMoney(totalPayments)}
                    description="Payments recorded in the selected period"
                    icon={TrendingDown}
                    tone="green"
                  />

                  <MetricCard
                    title="Outstanding Payables"
                    value={formatMoney(outstandingPayables)}
                    description="Balances on invoices in the selected period"
                    icon={Wallet}
                    tone="orange"
                  />

                  <MetricCard
                    title="Inventory Value"
                    value={formatMoney(inventoryValue)}
                    description="Current quantity multiplied by unit cost"
                    icon={Package}
                    tone="purple"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <SectionHeading
                      title="Financial snapshot"
                      description="Summary of the selected financial records"
                    />

                    <div className="space-y-5">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-gray-600">
                            Supplier invoices
                          </span>
                          <span className="font-semibold text-gray-900">
                            {formatMoney(totalInvoiced)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{
                              width: `${
                                totalInvoiced > 0
                                  ? Math.min(
                                      100,
                                      (totalInvoiced /
                                        Math.max(
                                          totalInvoiced,
                                          totalPayments,
                                          totalExpenses,
                                        )) *
                                        100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-gray-600">
                            Supplier payments
                          </span>
                          <span className="font-semibold text-gray-900">
                            {formatMoney(totalPayments)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${
                                totalPayments > 0
                                  ? Math.min(
                                      100,
                                      (totalPayments /
                                        Math.max(
                                          totalInvoiced,
                                          totalPayments,
                                          totalExpenses,
                                        )) *
                                        100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-gray-600">
                            General expenses
                          </span>
                          <span className="font-semibold text-gray-900">
                            {formatMoney(totalExpenses)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{
                              width: `${
                                totalExpenses > 0
                                  ? Math.min(
                                      100,
                                      (totalExpenses /
                                        Math.max(
                                          totalInvoiced,
                                          totalPayments,
                                          totalExpenses,
                                        )) *
                                        100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <p className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500">
                      Invoices, payments, and expenses are separate
                      record types. Invoice totals are not treated as
                      sales revenue.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <SectionHeading
                      title="Operational snapshot"
                      description="Current inventory and fleet indicators"
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-gray-50 p-4">
                        <Package className="text-blue-700" size={22} />
                        <p className="mt-3 text-2xl font-bold text-gray-900">
                          {formatNumber(inventoryItems.length)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Inventory items
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-4">
                        <AlertTriangle
                          className="text-orange-600"
                          size={22}
                        />
                        <p className="mt-3 text-2xl font-bold text-gray-900">
                          {formatNumber(lowStockItems.length)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          At or below reorder level
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-4">
                        <Truck className="text-purple-700" size={22} />
                        <p className="mt-3 text-2xl font-bold text-gray-900">
                          {formatNumber(vehicles.length)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Registered vehicles
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-4">
                        <ArrowUpRight
                          className="text-emerald-700"
                          size={22}
                        />
                        <p className="mt-3 text-2xl font-bold text-gray-900">
                          {formatNumber(activeTrips)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Planned or in-progress trips
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-5">
                    <SectionHeading
                      title="Recent financial records"
                      description="The latest invoices, payments, and expenses matching your filters"
                      action={
                        <button
                          onClick={() => setActiveTab("Financial")}
                          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                        >
                          View all
                        </button>
                      }
                    />
                  </div>

                  <DataTable
                    headers={[
                      "Date",
                      "Reference",
                      "Description",
                      "Type",
                      "Amount",
                      "Status",
                    ]}
                    isEmpty={filteredTransactions.length === 0}
                    emptyTitle="No financial records found"
                    emptyDescription="Records will appear here when the relevant backend endpoints return data."
                  >
                    {filteredTransactions.slice(0, 8).map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {formatDate(item.date)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                          {item.reference}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {item.description}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {item.type}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                          {formatMoney(item.amount)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              </div>
            )}

            {/* FINANCIAL */}

            {activeTab === "Financial" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Supplier Invoices"
                    value={formatMoney(totalInvoiced)}
                    description="Total invoice amounts"
                    icon={FileText}
                    tone="blue"
                  />

                  <MetricCard
                    title="Supplier Payments"
                    value={formatMoney(totalPayments)}
                    description="Total payments recorded"
                    icon={CheckCircle2}
                    tone="green"
                  />

                  <MetricCard
                    title="General Expenses"
                    value={formatMoney(totalExpenses)}
                    description="Expenses excluding supplier payments"
                    icon={TrendingDown}
                    tone="orange"
                  />

                  <MetricCard
                    title="Outstanding Payables"
                    value={formatMoney(outstandingPayables)}
                    description={`${overdueInvoices} overdue invoice(s) in the filtered records`}
                    icon={AlertTriangle}
                    tone="purple"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-5">
                    <SectionHeading
                      title="Financial transactions"
                      description="Supplier invoices, payments, and general expenses"
                    />
                  </div>

                  <DataTable
                    headers={[
                      "Date",
                      "Reference",
                      "Description",
                      "Category",
                      "Type",
                      "Amount",
                      "Balance",
                      "Status",
                    ]}
                    isEmpty={filteredTransactions.length === 0}
                    emptyTitle="No financial transactions"
                    emptyDescription="No records matched the selected search and date filters."
                  >
                    {filteredTransactions.map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {formatDate(item.date)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                          {item.reference}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {item.description}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {item.category}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {item.type}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                          {formatMoney(item.amount)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {item.type === "Supplier Invoice"
                            ? formatMoney(item.balance)
                            : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              </div>
            )}

            {/* INVENTORY */}

            {activeTab === "Inventory" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricCard
                    title="Inventory Items"
                    value={formatNumber(filteredInventory.length)}
                    description="Items returned by the inventory API"
                    icon={Package}
                    tone="blue"
                  />

                  <MetricCard
                    title="Stock Value"
                    value={formatMoney(inventoryValue)}
                    description="Quantity on hand multiplied by unit cost"
                    icon={Wallet}
                    tone="green"
                  />

                  <MetricCard
                    title="Reorder Alerts"
                    value={formatNumber(lowStockItems.length)}
                    description="Items at or below their reorder level"
                    icon={AlertTriangle}
                    tone="orange"
                  />
                </div>

                {lowStockItems.length > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle
                      size={20}
                      className="mt-0.5 shrink-0 text-amber-700"
                    />
                    <div>
                      <p className="font-semibold text-amber-900">
                        Stock replenishment required
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        {lowStockItems.length} item(s) have quantities
                        at or below their configured reorder level.
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-5">
                    <SectionHeading
                      title="Inventory stock report"
                      description="Quantities, reorder levels, warehouses, and estimated stock values"
                    />
                  </div>

                  <DataTable
                    headers={[
                      "SKU",
                      "Item",
                      "Category",
                      "Warehouse",
                      "Quantity",
                      "Unit",
                      "Reorder Level",
                      "Unit Cost",
                      "Stock Value",
                      "Status",
                    ]}
                    isEmpty={filteredInventory.length === 0}
                    emptyTitle="No inventory items found"
                    emptyDescription="Check the inventory API and confirm that items exist in your database."
                  >
                    {filteredInventory.map((item) => {
                      const lowStock =
                        item.quantity <= item.reorderLevel;

                      return (
                        <tr key={item.id}>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                            {item.sku}
                          </td>
                          <td className="px-5 py-4 text-gray-700">
                            {item.name}
                          </td>
                          <td className="px-5 py-4 text-gray-600">
                            {item.category}
                          </td>
                          <td className="px-5 py-4 text-gray-600">
                            {item.warehouse}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                            {formatNumber(item.quantity)}
                          </td>
                          <td className="px-5 py-4 text-gray-600">
                            {item.unit}
                          </td>
                          <td className="px-5 py-4 text-gray-600">
                            {formatNumber(item.reorderLevel)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                            {formatMoney(item.unitCost)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                            {formatMoney(
                              item.quantity * item.unitCost,
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge
                              status={lowStock ? "Overdue" : "Available"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </DataTable>
                </div>
              </div>
            )}

            {/* FLEET & TRIPS */}

            {activeTab === "Fleet & Trips" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Registered Vehicles"
                    value={formatNumber(filteredVehicles.length)}
                    description="Vehicles returned by the fleet API"
                    icon={Truck}
                    tone="blue"
                  />

                  <MetricCard
                    title="Available Vehicles"
                    value={formatNumber(
                      filteredVehicles.filter(
                        (vehicle) => vehicle.status === "Available",
                      ).length,
                    )}
                    description="Vehicles marked available"
                    icon={CheckCircle2}
                    tone="green"
                  />

                  <MetricCard
                    title="Active Trips"
                    value={formatNumber(activeTrips)}
                    description="Planned or in-progress trips"
                    icon={ArrowUpRight}
                    tone="purple"
                  />

                  <MetricCard
                    title="Trip Expenses"
                    value={formatMoney(totalTripExpenses)}
                    description="Expenses recorded against filtered trips"
                    icon={Wallet}
                    tone="orange"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-5">
                    <SectionHeading
                      title="Fleet register"
                      description="Vehicles, assigned drivers, capacities, and operational status"
                    />
                  </div>

                  <DataTable
                    headers={[
                      "Registration",
                      "Vehicle",
                      "Driver",
                      "Capacity",
                      "Status",
                    ]}
                    isEmpty={filteredVehicles.length === 0}
                    emptyTitle="No vehicles found"
                    emptyDescription="Check the trucking vehicles API and confirm that vehicles have been registered."
                  >
                    {filteredVehicles.map((vehicle) => (
                      <tr key={vehicle.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                          {vehicle.registration}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {vehicle.model}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {vehicle.driver}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {formatNumber(vehicle.capacity)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={vehicle.status} />
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-5">
                    <SectionHeading
                      title="Trip register"
                      description="Trip routes, assignments, statuses, and recorded expenses"
                    />
                  </div>

                  <DataTable
                    headers={[
                      "Reference",
                      "Date",
                      "Vehicle",
                      "Driver",
                      "Route",
                      "Expenses",
                      "Status",
                    ]}
                    isEmpty={filteredTrips.length === 0}
                    emptyTitle="No trips found"
                    emptyDescription="Check the trucking trips API and confirm that trip records exist."
                  >
                    {filteredTrips.map((trip) => (
                      <tr key={trip.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                          {trip.reference}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                          {formatDate(trip.date)}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {trip.vehicle}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {trip.driver}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {trip.origin} → {trip.destination}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                          {formatMoney(trip.cost)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={trip.status} />
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              </div>
            )}
          </>
        )}

        {/* Endpoint diagnostics */}

        {!loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              {endpointErrors.length > 0 ? (
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
              ) : (
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />
              )}

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">
                  API connection diagnostics
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Backend: {API_URL}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    {
                      name: "Supplier invoices",
                      path: "/api/finance/invoices/",
                      result: reportData.invoices,
                    },
                    {
                      name: "Supplier payments",
                      path: "/api/finance/payments/",
                      result: reportData.payments,
                    },
                    {
                      name: "General expenses",
                      path: "/api/finance/expenses/",
                      result: reportData.expenses,
                    },
                    {
                      name: "Inventory items",
                      path: "/api/inventory/items/",
                      result: reportData.items,
                    },
                    {
                      name: "Stock balances",
                      path: "/api/inventory/balances/",
                      result: reportData.balances,
                    },
                    {
                      name: "Vehicles",
                      path: "/api/trucking/vehicles/",
                      result: reportData.vehicles,
                    },
                    {
                      name: "Trips",
                      path: "/api/trucking/trips/",
                      result: reportData.trips,
                    },
                  ].map(({ name, path, result }) => (
                    <div
                      key={path}
                      className="rounded-xl border border-gray-200 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {name}
                        </span>
                        {result.error ? (
                          <XCircle
                            size={17}
                            className="shrink-0 text-red-600"
                          />
                        ) : (
                          <CheckCircle2
                            size={17}
                            className="shrink-0 text-emerald-600"
                          />
                        )}
                      </div>

                      <p className="mt-1 break-all text-xs text-gray-500">
                        {path}
                      </p>

                      {result.error ? (
                        <p className="mt-2 break-words text-xs text-red-700">
                          {result.error}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-emerald-700">
                          Connected · {result.data.length} record(s)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}

        <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>INVENTOR ERP · Reports & Analytics</p>
          <p className="inline-flex items-center gap-1.5">
            <Clock size={13} />
            Figures reflect the records loaded from the backend.
          </p>
        </div>
      </div>
    </div>
  );
}
