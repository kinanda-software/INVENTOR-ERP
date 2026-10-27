"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  FileText,
  PackageCheck,
  Receipt,
  Truck,
  Wallet,
  Warehouse,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type PurchaseOrder = {
  id: number;
  order_number: string;
  status: string;
};

type InventoryItem = {
  id: number;
  name?: string;
  item_name?: string;
  item_code?: string;
};

type StockBalance = {
  id: number;
  item: number;
  item_code: string;
  item_name: string;
  quantity_on_hand: string | number;
  updated_at: string;
};

type Trip = {
  id: number;
  status: string;
};

type FinanceSummary = {
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

const emptySummary: FinanceSummary = {
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
      throw new Error(
        "Authentication required. Please sign in again and verify that your token is stored in localStorage.",
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Access denied. Your account may not have permission to access this resource.",
      );
    }

    throw new Error(`API ${path} returned HTTP ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function getList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data !== null && typeof data === "object" && "results" in data) {
    const results = (data as { results?: unknown }).results;
    if (Array.isArray(results)) return results as T[];
  }

  throw new Error("The API returned an unexpected list format.");
}

function formatCurrency(
  value: string | number,
  currency = "TZS",
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return `${currency} 0.00`;

  return `${currency} ${amount.toLocaleString("en-TZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-TZ", {
    maximumFractionDigits: 2,
  });
}

const workflows = [
  {
    number: "01",
    title: "Procurement",
    description: "Create purchase requests and purchase orders.",
    href: "/procurement",
    icon: ClipboardList,
  },
  {
    number: "02",
    title: "Goods Receiving",
    description: "Record deliveries and verify received quantities.",
    href: "/receiving",
    icon: PackageCheck,
  },
  {
    number: "03",
    title: "Inventory Control",
    description: "Track stock balances, transfers and store issues.",
    href: "/inventory",
    icon: Warehouse,
  },
  {
    number: "04",
    title: "Finance",
    description: "Manage invoices, payment vouchers and expenses.",
    href: "/finance",
    icon: Wallet,
  },
  {
    number: "05",
    title: "Trucking Operations",
    description: "Manage trucks, trips, fuel and operating expenses.",
    href: "/trucking",
    icon: Truck,
  },
  {
    number: "06",
    title: "Reports & Analytics",
    description: "Review operational and financial reports.",
    href: "/reports",
    icon: FileText,
  },
];

const inventorySteps = [
  "Purchase order approved",
  "Goods received and verified",
  "Stock balance updated",
  "Store issue recorded",
];

const financeSteps = [
  "Supplier invoice checked",
  "Payment voucher prepared",
  "Authorized approval obtained",
  "Payment posted to cash book",
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<FinanceSummary>(emptySummary);

  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[] | null>(null);

  const [inventoryItems, setInventoryItems] =
    useState<InventoryItem[] | null>(null);

  const [stockBalances, setStockBalances] =
    useState<StockBalance[] | null>(null);

  const [trips, setTrips] = useState<Trip[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [tripsLoading, setTripsLoading] = useState(true);

  const [error, setError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [balancesError, setBalancesError] = useState("");
  const [tripsError, setTripsError] = useState("");

  const [connected, setConnected] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet<FinanceSummary>("/api/finance/summary/");
      setSummary({ ...emptySummary, ...data });
      setConnected(true);
    } catch (err) {
      setConnected(false);
      setError(
        err instanceof Error ? err.message : "Could not load Finance summary.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPurchaseOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const data = await apiGet<unknown>(
        "/api/procurement/purchase-orders/",
      );
      setPurchaseOrders(getList<PurchaseOrder>(data));
    } catch (err) {
      setPurchaseOrders(null);
      setOrdersError(
        err instanceof Error ? err.message : "Could not load purchase orders.",
      );
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadInventoryItems = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError("");

    try {
      const data = await apiGet<unknown>("/api/inventory/items/");
      setInventoryItems(getList<InventoryItem>(data));
    } catch (err) {
      setInventoryItems(null);
      setInventoryError(
        err instanceof Error ? err.message : "Could not load inventory items.",
      );
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const loadStockBalances = useCallback(async () => {
    setBalancesLoading(true);
    setBalancesError("");

    try {
      const data = await apiGet<unknown>("/api/inventory/balances/");
      setStockBalances(getList<StockBalance>(data));
    } catch (err) {
      setStockBalances(null);
      setBalancesError(
        err instanceof Error ? err.message : "Could not load stock balances.",
      );
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    setTripsError("");

    try {
      const data = await apiGet<unknown>("/api/trucking/trips/");
      setTrips(getList<Trip>(data));
    } catch (err) {
      setTrips(null);
      setTripsError(
        err instanceof Error ? err.message : "Could not load trucking trips.",
      );
    } finally {
      setTripsLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    void loadSummary();
    void loadPurchaseOrders();
    void loadInventoryItems();
    void loadStockBalances();
    void loadTrips();
  }, [
    loadSummary,
    loadPurchaseOrders,
    loadInventoryItems,
    loadStockBalances,
    loadTrips,
  ]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const totalStock =
    stockBalances === null
      ? null
      : stockBalances.reduce((total, balance) => {
          const quantity = Number(balance.quantity_on_hand);
          return total + (Number.isFinite(quantity) ? quantity : 0);
        }, 0);

  const activeTrips =
    trips === null
      ? null
      : trips.filter((trip) => trip.status === "In Progress").length;

  const metrics = [
    {
      title: "Purchase Orders",
      value: ordersLoading
        ? "Loading..."
        : purchaseOrders === null
          ? "Unavailable"
          : purchaseOrders.length.toLocaleString("en-TZ"),
      description: ordersError || "Purchase orders returned by the API",
      icon: ClipboardList,
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Inventory Items",
      value: inventoryLoading
        ? "Loading..."
        : inventoryItems === null
          ? "Unavailable"
          : inventoryItems.length.toLocaleString("en-TZ"),
      description: inventoryError || "Inventory item records",
      icon: Boxes,
      color: "bg-violet-50 text-violet-700",
    },
    {
      title: "Total Stock",
      value: balancesLoading
        ? "Loading..."
        : totalStock === null
          ? "Unavailable"
          : formatQuantity(totalStock),
      description: balancesError
        ? balancesError
        : stockBalances === null
          ? "Stock balances unavailable"
          : `${stockBalances.length} stock balance records`,
      icon: Warehouse,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Outstanding Payments",
      value: loading
        ? "Loading..."
        : formatCurrency(summary.outstanding_balance, summary.currency),
      description: "Unpaid supplier invoice balances",
      icon: Receipt,
      color: "bg-amber-50 text-amber-700",
    },
    {
      title: "Active Trips",
      value: tripsLoading
        ? "Loading..."
        : activeTrips === null
          ? "Unavailable"
          : activeTrips.toLocaleString("en-TZ"),
      description: tripsError
        ? tripsError
        : trips === null
          ? "Trucking trips unavailable"
          : `${trips.length} total trip records`,
      icon: Truck,
      color: "bg-sky-50 text-sky-700",
    },
  ];

  const dashboardHasError = Boolean(
    error ||
      ordersError ||
      inventoryError ||
      balancesError ||
      tripsError,
  );

  const coreApisConnected =
    connected &&
    purchaseOrders !== null &&
    inventoryItems !== null &&
    stockBalances !== null &&
    trips !== null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Operations Overview
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome to your ERP dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage purchasing, stock movements, payments and truck operations
            from one central system.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${
              connected
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : loading
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected
                  ? "bg-emerald-500"
                  : loading
                    ? "bg-blue-500"
                    : "bg-amber-500"
              }`}
            />

            {loading
              ? "Connecting to Finance..."
              : connected
                ? "Finance API connected"
                : "Finance API unavailable"}
          </span>

          <button
            type="button"
            onClick={refreshDashboard}
            disabled={
              loading ||
              ordersLoading ||
              inventoryLoading ||
              balancesLoading ||
              tripsLoading
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                loading ||
                ordersLoading ||
                inventoryLoading ||
                balancesLoading ||
                tripsLoading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh all
          </button>
        </div>
      </section>

      {dashboardHasError && (
        <section
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-amber-700"
            />

            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-amber-900">
                One or more dashboard APIs need attention
              </p>

              {error && (
                <p className="break-words text-sm text-amber-800">
                  Finance: {error}
                </p>
              )}

              {ordersError && (
                <p className="break-words text-sm text-amber-800">
                  Procurement: {ordersError}
                </p>
              )}

              {inventoryError && (
                <p className="break-words text-sm text-amber-800">
                  Inventory items: {inventoryError}
                </p>
              )}

              {balancesError && (
                <p className="break-words text-sm text-amber-800">
                  Stock balances: {balancesError}
                </p>
              )}

              {tripsError && (
                <p className="break-words text-sm text-amber-800">
                  Trucking: {tripsError}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {error && (
                  <button
                    type="button"
                    onClick={() => void loadSummary()}
                    disabled={loading}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Retry Finance
                  </button>
                )}

                {ordersError && (
                  <button
                    type="button"
                    onClick={() => void loadPurchaseOrders()}
                    disabled={ordersLoading}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Retry Procurement
                  </button>
                )}

                {inventoryError && (
                  <button
                    type="button"
                    onClick={() => void loadInventoryItems()}
                    disabled={inventoryLoading}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Retry Inventory
                  </button>
                )}

                {balancesError && (
                  <button
                    type="button"
                    onClick={() => void loadStockBalances()}
                    disabled={balancesLoading}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Retry Stock Balances
                  </button>
                )}

                {tripsError && (
                  <button
                    type="button"
                    onClick={() => void loadTrips()}
                    disabled={tripsLoading}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Retry Trucking
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Business Summary
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Live Finance, Procurement, Inventory and Trucking data from the
            backend.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <article
                key={metric.title}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-500">
                    {metric.title}
                  </p>

                  <div
                    className={`shrink-0 rounded-xl p-3 ${metric.color}`}
                  >
                    <Icon size={21} />
                  </div>
                </div>

                <p className="mt-5 break-words text-2xl font-bold text-slate-900">
                  {metric.value}
                </p>

                <p className="mt-2 break-words text-xs text-slate-500">
                  {metric.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Finance Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Summary from your Finance API.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
            aria-label="Refresh finance summary"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Total Invoiced",
              value: formatCurrency(
                summary.total_invoiced,
                summary.currency,
              ),
              icon: FileText,
            },
            {
              title: "Supplier Payments",
              value: formatCurrency(
                summary.total_supplier_payments,
                summary.currency,
              ),
              icon: Wallet,
            },
            {
              title: "Overdue Balance",
              value: formatCurrency(
                summary.overdue_balance,
                summary.currency,
              ),
              icon: AlertCircle,
            },
            {
              title: "Total Expenses",
              value: formatCurrency(
                summary.total_expenses,
                summary.currency,
              ),
              icon: Receipt,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                    <Icon size={20} />
                  </div>

                  <p className="text-sm font-medium text-slate-500">
                    {item.title}
                  </p>
                </div>

                <p className="mt-4 break-words text-xl font-bold text-slate-900">
                  {loading ? "Loading..." : item.value}
                </p>
              </article>
            );
          })}
        </div>

        {connected && (
          <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 size={15} />
            {summary.invoice_count} invoices, {summary.payment_count} payments
            and {summary.expense_count} expenses recorded.
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Business Modules
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select a module to manage its workflow.
            </p>
          </div>

          <ArrowUpRight size={21} className="shrink-0 text-slate-400" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;

            return (
              <Link
                key={workflow.number}
                href={workflow.href}
                className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-slate-100 p-3 text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-700">
                    <Icon size={23} />
                  </div>

                  <span className="text-sm font-semibold text-slate-300">
                    {workflow.number}
                  </span>
                </div>

                <h3 className="mt-5 font-bold text-slate-900">
                  {workflow.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
                  {workflow.description}
                </p>

                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-700">
                  Open module <ArrowUpRight size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Operational Workflows
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Key processes for inventory and finance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <WorkflowPanel
            title="Inventory Workflow"
            subtitle="Stock control process"
            icon={ArrowDownToLine}
            color="bg-indigo-50 text-indigo-700"
            steps={inventorySteps}
          />

          <WorkflowPanel
            title="Finance Workflow"
            subtitle="Payment control process"
            icon={Wallet}
            color="bg-emerald-50 text-emerald-700"
            steps={financeSteps}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2 text-blue-700">
            <Activity size={20} />
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Dashboard integration status
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-600">
              Finance, Procurement, Inventory Items, Stock Balances and
              Trucking Trips are requested from their respective APIs.
            </p>
          </div>
        </div>

        <span
          className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
            coreApisConnected
              ? "bg-emerald-100 text-emerald-800"
              : "bg-white text-blue-800"
          }`}
        >
          {coreApisConnected
            ? "Core APIs connected"
            : "Check API status"}
        </span>
      </section>
    </div>
  );
}

function WorkflowPanel({
  title,
  subtitle,
  icon: Icon,
  color,
  steps,
}: {
  title: string;
  subtitle: string;
  icon: typeof Wallet;
  color: string;
  steps: string[];
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>

        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <ol className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
              {index + 1}
            </span>

            <span className="text-sm leading-5 text-slate-700">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
