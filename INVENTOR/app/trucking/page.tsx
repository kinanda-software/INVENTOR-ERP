
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Truck, Route, Wrench, Plus, Search, RefreshCw, X, MapPin,
  CalendarDays, Fuel, CheckCircle2, Clock, AlertTriangle,
  Package, ArrowRight, Phone, Gauge, ClipboardList,
} from "lucide-react";

type VehicleStatus = "Available" | "On Trip" | "Maintenance";
type TripStatus = "Planned" | "In Progress" | "Completed" | "Cancelled";

type Vehicle = {
  id: number;
  registration: string;
  make: string;
  model: string;
  type: string;
  capacity: number;
  driver: string;
  driverPhone: string;
  status: VehicleStatus;
  mileage: number;
  fuelType: string;
  lastService: string;
};

type Trip = {
  id: number;
  reference: string;
  vehicleId: number;
  vehicleRegistration: string;
  driver: string;
  origin: string;
  destination: string;
  cargo: string;
  cargoWeight: number;
  departureDate: string;
  expectedArrival: string;
  status: TripStatus;
  client: string;
  fuelCost: number;
  otherCosts: number;
};

type ApiVehicle = {
  id: number;
  registration: string;
  make: string;
  model: string;
  type: string;
  capacity: string | number;
  driver: string;
  driver_phone: string;
  status: VehicleStatus;
  mileage: string | number;
  fuel_type: string;
  last_service: string | null;
};

type ApiTrip = {
  id: number;
  reference: string;
  vehicle: number;
  vehicle_registration?: string;
  driver: string;
  origin: string;
  destination: string;
  cargo: string;
  cargo_weight: string | number;
  departure_date: string;
  expected_arrival: string;
  status: TripStatus;
  client: string;
};

type ApiExpense = {
  id: number;
  trip: number;
  category: string;
  amount: string | number;
};

type ApiError = {
  detail?: string;
  [field: string]: unknown;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const ENDPOINTS = {
  vehicles: `${API_URL}/api/trucking/vehicles/`,
  trips: `${API_URL}/api/trucking/trips/`,
  expenses: `${API_URL}/api/trucking/expenses/`,
};

const money = (value: number) =>
  new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value);

const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10);
};

function getAuthToken(): string | null {
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
    const value = localStorage.getItem(key)?.trim();
    if (value) return value;
  }

  return null;
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiError | null;

  if (!data) return `Request failed with HTTP ${response.status}.`;
  if (data.detail) return data.detail;

  return (
    Object.entries(data)
      .map(([field, value]) => {
        const description = Array.isArray(value)
          ? value.join(", ")
          : typeof value === "string"
            ? value
            : JSON.stringify(value);

        return `${field}: ${description}`;
      })
      .join("; ") || `Request failed with HTTP ${response.status}.`
  );
}

async function apiRequest<T>(
  endpoint: string,
  method = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("No login token found. Please sign in first.");
  }

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(method === "GET" ? { cache: "no-store" as RequestCache } : {}),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

function records<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (
    data !== null &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray((data as { results: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }

  throw new Error("The API returned an unexpected response format.");
}

function statusClass(status: string) {
  switch (status) {
    case "Available":
    case "Completed":
      return "bg-green-100 text-green-800";
    case "On Trip":
    case "In Progress":
      return "bg-blue-100 text-blue-800";
    case "Maintenance":
    case "Cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(status)}`}>
      {status}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: typeof Truck;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
          <Icon size={21} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const initialVehicleForm = {
  registration: "",
  make: "",
  model: "",
  type: "Cargo Truck",
  capacity: "",
  driver: "",
  driver_phone: "",
  status: "Available" as VehicleStatus,
  mileage: "0",
  fuel_type: "Diesel",
  last_service: "",
};

const initialTripForm = {
  vehicle: "",
  driver: "",
  origin: "",
  destination: "",
  cargo: "",
  cargo_weight: "",
  departure_date: today(),
  expected_arrival: today(),
  status: "Planned" as TripStatus,
  client: "",
  fuelCost: "0",
  otherCosts: "0",
};

export default function TruckingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"trips" | "vehicles">("trips");
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showTripForm, setShowTripForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm);
  const [tripForm, setTripForm] = useState(initialTripForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [vehicleResponse, tripResponse, expenseResponse] =
        await Promise.all([
          apiRequest<unknown>(ENDPOINTS.vehicles),
          apiRequest<unknown>(ENDPOINTS.trips),
          apiRequest<unknown>(ENDPOINTS.expenses),
        ]);

      const apiVehicles = records<ApiVehicle>(vehicleResponse);
      const apiTrips = records<ApiTrip>(tripResponse);
      const expenses = records<ApiExpense>(expenseResponse);

      const expenseTotals = new Map<number, { fuel: number; other: number }>();

      for (const expense of expenses) {
        const total = expenseTotals.get(expense.trip) ?? {
          fuel: 0,
          other: 0,
        };

        if (expense.category.toLowerCase() === "fuel") {
          total.fuel += Number(expense.amount);
        } else {
          total.other += Number(expense.amount);
        }

        expenseTotals.set(expense.trip, total);
      }

      setVehicles(
        apiVehicles.map((vehicle) => ({
          id: vehicle.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          type: vehicle.type,
          capacity: Number(vehicle.capacity),
          driver: vehicle.driver,
          driverPhone: vehicle.driver_phone,
          status: vehicle.status,
          mileage: Number(vehicle.mileage),
          fuelType: vehicle.fuel_type,
          lastService: vehicle.last_service ?? "",
        })),
      );

      setTrips(
        apiTrips.map((trip) => {
          const costs = expenseTotals.get(trip.id) ?? {
            fuel: 0,
            other: 0,
          };

          return {
            id: trip.id,
            reference: trip.reference,
            vehicleId: trip.vehicle,
            vehicleRegistration: trip.vehicle_registration ?? "",
            driver: trip.driver,
            origin: trip.origin,
            destination: trip.destination,
            cargo: trip.cargo,
            cargoWeight: Number(trip.cargo_weight),
            departureDate: trip.departure_date,
            expectedArrival: trip.expected_arrival,
            status: trip.status,
            client: trip.client,
            fuelCost: costs.fuel,
            otherCosts: costs.other,
          };
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load trucking data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(
    () => ({
      totalVehicles: vehicles.length,
      available: vehicles.filter((vehicle) => vehicle.status === "Available").length,
      maintenance: vehicles.filter((vehicle) => vehicle.status === "Maintenance").length,
      activeTrips: trips.filter(
        (trip) => trip.status === "Planned" || trip.status === "In Progress",
      ).length,
      totalExpenses: trips.reduce(
        (sum, trip) => sum + trip.fuelCost + trip.otherCosts,
        0,
      ),
    }),
    [vehicles, trips],
  );

  const filteredVehicles = useMemo(() => {
    const term = search.toLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesSearch = [
        vehicle.registration,
        vehicle.make,
        vehicle.model,
        vehicle.driver,
      ].some((value) => value.toLowerCase().includes(term));

      return (
        matchesSearch &&
        (statusFilter === "All" || vehicle.status === statusFilter)
      );
    });
  }, [vehicles, search, statusFilter]);

  const filteredTrips = useMemo(() => {
    const term = search.toLowerCase();

    return trips.filter((trip) => {
      const matchesSearch = [
        trip.reference,
        trip.driver,
        trip.origin,
        trip.destination,
        trip.client,
        trip.vehicleRegistration,
      ].some((value) => value.toLowerCase().includes(term));

      return (
        matchesSearch &&
        (statusFilter === "All" || trip.status === statusFilter)
      );
    });
  }, [trips, search, statusFilter]);

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(ENDPOINTS.vehicles, "POST", {
        registration: vehicleForm.registration.trim().toUpperCase(),
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        type: vehicleForm.type,
        capacity: Number(vehicleForm.capacity),
        driver: vehicleForm.driver.trim(),
        driver_phone: vehicleForm.driver_phone.trim(),
        status: vehicleForm.status,
        mileage: Number(vehicleForm.mileage),
        fuel_type: vehicleForm.fuel_type,
        last_service: vehicleForm.last_service || null,
      });

      setShowVehicleForm(false);
      setVehicleForm(initialVehicleForm);
      setSuccess("Vehicle registered successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    let createdTrip: ApiTrip | null = null;

    try {
      createdTrip = await apiRequest<ApiTrip>(ENDPOINTS.trips, "POST", {
        vehicle: Number(tripForm.vehicle),
        driver: tripForm.driver.trim(),
        origin: tripForm.origin.trim(),
        destination: tripForm.destination.trim(),
        cargo: tripForm.cargo.trim(),
        cargo_weight: Number(tripForm.cargo_weight),
        departure_date: tripForm.departure_date,
        expected_arrival: tripForm.expected_arrival,
        status: tripForm.status,
        client: tripForm.client.trim(),
      });

      const expenseDate = tripForm.departure_date;
      const expensesToCreate = [
        {
          category: "Fuel",
          description: `Fuel for ${createdTrip.reference}`,
          amount: Number(tripForm.fuelCost),
        },
        {
          category: "Other",
          description: `Other trip costs for ${createdTrip.reference}`,
          amount: Number(tripForm.otherCosts),
        },
      ].filter((expense) => expense.amount > 0);

      for (const expense of expensesToCreate) {
        await apiRequest(ENDPOINTS.expenses, "POST", {
          trip: createdTrip.id,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          expense_date: expenseDate,
        });
      }

      setShowTripForm(false);
      setTripForm(initialTripForm);
      setSuccess("Trip and applicable expenses saved successfully.");
      await loadData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save trip.";

      if (createdTrip) {
        setError(
          `Trip ${createdTrip.reference} was created, but an expense may not have been saved. Check this trip's expenses before retrying: ${message}`,
        );
        await loadData();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateVehicleStatus(
    vehicle: Vehicle,
    status: "Available" | "Maintenance",
  ) {
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `${ENDPOINTS.vehicles}${vehicle.id}/`,
        "PATCH",
        { status },
      );

      setSuccess(`${vehicle.registration} status updated.`);
      setSelectedVehicle(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update vehicle.");
    }
  }

  async function updateTripStatus(trip: Trip, status: TripStatus) {
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `${ENDPOINTS.trips}${trip.id}/`,
        "PATCH",
        { status },
      );

      setSuccess(`${trip.reference} status updated.`);
      setSelectedTrip(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update trip.");
    }
  }

  const selectedVehicleTrips = selectedVehicle
    ? trips.filter((trip) => trip.vehicleId === selectedVehicle.id)
    : [];

  return (
    <main className="min-h-0 w-full min-w-0 bg-slate-50 p-0 text-slate-900">
       <div className="w-full min-w-0 space-y-4">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Truck size={18} /> INVENTOR ERP / TRANSPORT
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Trucking Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your fleet, trips, and transport expenses.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => { setError(""); setShowVehicleForm(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <Plus size={17} /> Add Vehicle
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setTripForm(initialTripForm);
                setShowTripForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus size={17} /> Create Trip
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div role="status" className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} />
            <span className="flex-1">{success}</span>
            <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss message">
              <X size={18} />
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Fleet Vehicles" value={stats.totalVehicles} detail={`${stats.available} available`} icon={Truck} />
          <SummaryCard title="Active Trips" value={stats.activeTrips} detail="Planned and in progress" icon={Route} />
          <SummaryCard title="In Maintenance" value={stats.maintenance} detail="Vehicles requiring service" icon={Wrench} />
          <SummaryCard title="Recorded Trip Expenses" value={money(stats.totalExpenses)} detail="Fuel and other trip costs" icon={Fuel} />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setActiveTab("trips"); setStatusFilter("All"); }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "trips" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Route size={16} className="mr-2 inline" /> Trips
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("vehicles"); setStatusFilter("All"); }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "vehicles" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Truck size={16} className="mr-2 inline" /> Fleet
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={activeTab === "trips" ? "Search trips..." : "Search vehicles..."}
                  className={`${inputClass} pl-9`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass}
              >
                <option value="All">All statuses</option>
                {(activeTab === "trips"
                  ? ["Planned", "In Progress", "Completed", "Cancelled"]
                  : ["Available", "On Trip", "Maintenance"]
                ).map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-14 text-sm text-slate-500">
              <RefreshCw size={20} className="animate-spin" /> Loading data from Django...
            </div>
          ) : activeTab === "trips" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Trip / Client</th>
                    <th className="px-5 py-4">Route</th>
                    <th className="px-5 py-4">Vehicle / Driver</th>
                    <th className="px-5 py-4">Departure</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Expenses</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{trip.reference}</p>
                        <p className="mt-1 text-xs text-slate-500">{trip.client || "No client specified"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium">{trip.origin}</p>
                        <p className="my-1 text-xs text-slate-400"><ArrowRight size={13} className="inline" /></p>
                        <p className="font-medium">{trip.destination}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium">{trip.vehicleRegistration || `Vehicle #${trip.vehicleId}`}</p>
                        <p className="mt-1 text-xs text-slate-500">{trip.driver}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p>{displayDate(trip.departureDate)}</p>
                        <p className="mt-1 text-xs text-slate-500">Due {displayDate(trip.expectedArrival)}</p>
                      </td>
                      <td className="px-5 py-4"><Badge status={trip.status} /></td>
                      <td className="px-5 py-4 font-medium">{money(trip.fuelCost + trip.otherCosts)}</td>
                      <td className="px-5 py-4">
                        <button type="button" onClick={() => setSelectedTrip(trip)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTrips.length === 0 && (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-500">No trips found in the database.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Vehicle</th>
                    <th className="px-5 py-4">Type / Capacity</th>
                    <th className="px-5 py-4">Driver / Phone</th>
                    <th className="px-5 py-4">Mileage</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{vehicle.registration}</p>
                        <p className="mt-1 text-xs text-slate-500">{vehicle.make} {vehicle.model}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p>{vehicle.type}</p>
                        <p className="mt-1 text-xs text-slate-500">{vehicle.capacity} tonnes</p>
                      </td>
                      <td className="px-5 py-4">
                        <p>{vehicle.driver || "Unassigned"}</p>
                        <p className="mt-1 text-xs text-slate-500">{vehicle.driverPhone || "No phone"}</p>
                      </td>
                      <td className="px-5 py-4">{vehicle.mileage.toLocaleString()} km</td>
                      <td className="px-5 py-4"><Badge status={vehicle.status} /></td>
                      <td className="px-5 py-4">
                        <button type="button" onClick={() => setSelectedVehicle(vehicle)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100">
                          View / Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredVehicles.length === 0 && (
                    <tr><td colSpan={6} className="p-10 text-center text-slate-500">No vehicles found in the database.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-slate-500">
          <CheckCircle2 size={14} className="mr-1 inline text-green-600" />
          This page loads and saves data through the authenticated Django API.
        </p>
      </div>

      {showVehicleForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <section className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold">Register Vehicle</h2>
                <p className="mt-1 text-sm text-slate-500">Save a new fleet vehicle to the database.</p>
              </div>
              <button type="button" onClick={() => setShowVehicleForm(false)} aria-label="Close form"><X /></button>
            </div>
            <form onSubmit={saveVehicle} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Registration number">
                  <input required value={vehicleForm.registration} onChange={(e) => setVehicleForm({ ...vehicleForm, registration: e.target.value })} className={inputClass} placeholder="T 123 ABC" />
                </Field>
                <Field label="Vehicle type">
                  <select value={vehicleForm.type} onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })} className={inputClass}>
                    <option>Cargo Truck</option><option>Truck</option><option>Pickup</option><option>Van</option><option>Trailer</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Make">
                  <input required value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} className={inputClass} placeholder="Isuzu" />
                </Field>
                <Field label="Model">
                  <input required value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} className={inputClass} placeholder="FVR" />
                </Field>
                <Field label="Capacity (tonnes)">
                  <input required min="0.01" step="0.01" type="number" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Current mileage (km)">
                  <input required min="0" step="0.01" type="number" value={vehicleForm.mileage} onChange={(e) => setVehicleForm({ ...vehicleForm, mileage: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Driver name">
                  <input value={vehicleForm.driver} onChange={(e) => setVehicleForm({ ...vehicleForm, driver: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Driver phone">
                  <input value={vehicleForm.driver_phone} onChange={(e) => setVehicleForm({ ...vehicleForm, driver_phone: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Fuel type">
                  <select value={vehicleForm.fuel_type} onChange={(e) => setVehicleForm({ ...vehicleForm, fuel_type: e.target.value })} className={inputClass}>
                    <option>Diesel</option><option>Petrol</option><option>Electric</option><option>Hybrid</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Last service date">
                  <input type="date" value={vehicleForm.last_service} onChange={(e) => setVehicleForm({ ...vehicleForm, last_service: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <p className="text-xs text-slate-500">New vehicles are registered as Available. Trip status controls when a vehicle is On Trip.</p>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowVehicleForm(false)} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancel</button>
                <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? "Saving..." : "Save Vehicle"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showTripForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <section className="my-4 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold">Create Trip</h2>
                <p className="mt-1 text-sm text-slate-500">Create a trip and record any initial expenses.</p>
              </div>
              <button type="button" onClick={() => setShowTripForm(false)} aria-label="Close form"><X /></button>
            </div>
            <form onSubmit={saveTrip} className="space-y-4 p-5">
              {vehicles.filter((vehicle) => vehicle.status === "Available").length === 0 && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  No vehicles are currently Available. Register a vehicle or update an eligible vehicle before creating a trip.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vehicle">
                  <select required value={tripForm.vehicle} onChange={(e) => {
                    const vehicle = vehicles.find((item) => item.id === Number(e.target.value));
                    setTripForm({ ...tripForm, vehicle: e.target.value, driver: vehicle?.driver || tripForm.driver });
                  }} className={inputClass}>
                    <option value="">Select available vehicle</option>
                    {vehicles.filter((vehicle) => vehicle.status === "Available").map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.registration} — {vehicle.make} {vehicle.model} ({vehicle.capacity} tonnes)
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Driver">
                  <input required value={tripForm.driver} onChange={(e) => setTripForm({ ...tripForm, driver: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Origin">
                  <input required value={tripForm.origin} onChange={(e) => setTripForm({ ...tripForm, origin: e.target.value })} className={inputClass} placeholder="Dar es Salaam" />
                </Field>
                <Field label="Destination">
                  <input required value={tripForm.destination} onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })} className={inputClass} placeholder="Dodoma" />
                </Field>
                <Field label="Cargo description">
                  <input required value={tripForm.cargo} onChange={(e) => setTripForm({ ...tripForm, cargo: e.target.value })} className={inputClass} placeholder="Building materials" />
                </Field>
                <Field label="Cargo weight (tonnes)">
                  <input required min="0" step="0.01" type="number" value={tripForm.cargo_weight} onChange={(e) => setTripForm({ ...tripForm, cargo_weight: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Departure date">
                  <input required type="date" value={tripForm.departure_date} onChange={(e) => setTripForm({ ...tripForm, departure_date: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Expected arrival">
                  <input required min={tripForm.departure_date} type="date" value={tripForm.expected_arrival} onChange={(e) => setTripForm({ ...tripForm, expected_arrival: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Client">
                  <input value={tripForm.client} onChange={(e) => setTripForm({ ...tripForm, client: e.target.value })} className={inputClass} placeholder="Client or company name" />
                </Field>
                <Field label="Initial trip status">
                  <select value={tripForm.status} onChange={(e) => setTripForm({ ...tripForm, status: e.target.value as TripStatus })} className={inputClass}>
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </Field>
                <Field label="Fuel cost (TZS)">
                  <input min="0" step="0.01" type="number" value={tripForm.fuelCost} onChange={(e) => setTripForm({ ...tripForm, fuelCost: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Other costs (TZS)">
                  <input min="0" step="0.01" type="number" value={tripForm.otherCosts} onChange={(e) => setTripForm({ ...tripForm, otherCosts: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Initial expenses: <strong>{money(Math.max(0, Number(tripForm.fuelCost) || 0) + Math.max(0, Number(tripForm.otherCosts) || 0))}</strong>
                <p className="mt-1 text-xs text-slate-500">The trip and expenses are separate API requests. If expense recording fails after trip creation, check the trip before retrying.</p>
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowTripForm(false)} className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancel</button>
                <button disabled={saving || vehicles.every((vehicle) => vehicle.status !== "Available")} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? "Saving..." : "Create Trip"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <section className="my-4 w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold">{selectedVehicle.registration}</h2>
                <p className="text-sm text-slate-500">{selectedVehicle.make} {selectedVehicle.model}</p>
              </div>
              <button type="button" onClick={() => setSelectedVehicle(null)} aria-label="Close details"><X /></button>
            </div>
            <div className="space-y-5 p-5">
              <Badge status={selectedVehicle.status} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs text-slate-500">Vehicle type</p><p className="mt-1 font-medium">{selectedVehicle.type}</p></div>
                <div><p className="text-xs text-slate-500">Capacity</p><p className="mt-1 font-medium">{selectedVehicle.capacity} tonnes</p></div>
                <div><p className="text-xs text-slate-500">Driver</p><p className="mt-1 font-medium">{selectedVehicle.driver || "Unassigned"}</p></div>
                <div><p className="text-xs text-slate-500">Phone</p><p className="mt-1 font-medium">{selectedVehicle.driverPhone || "—"}</p></div>
                <div><p className="text-xs text-slate-500">Mileage</p><p className="mt-1 font-medium">{selectedVehicle.mileage.toLocaleString()} km</p></div>
                <div><p className="text-xs text-slate-500">Fuel type</p><p className="mt-1 font-medium">{selectedVehicle.fuelType}</p></div>
                <div><p className="text-xs text-slate-500">Last service</p><p className="mt-1 font-medium">{displayDate(selectedVehicle.lastService)}</p></div>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Trip history</h3>
                {selectedVehicleTrips.length ? selectedVehicleTrips.map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between border-t py-3 text-sm">
                    <div><p className="font-medium">{trip.reference}</p><p className="text-xs text-slate-500">{trip.origin} → {trip.destination}</p></div>
                    <Badge status={trip.status} />
                  </div>
                )) : <p className="text-sm text-slate-500">No trips recorded for this vehicle.</p>}
              </div>
              {selectedVehicle.status !== "On Trip" && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {selectedVehicle.status !== "Available" && (
                    <button type="button" onClick={() => void updateVehicleStatus(selectedVehicle, "Available")} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">
                      Mark Available
                    </button>
                  )}
                  {selectedVehicle.status !== "Maintenance" && (
                    <button type="button" onClick={() => void updateVehicleStatus(selectedVehicle, "Maintenance")} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
                      Mark Maintenance
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <section className="my-4 w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold">{selectedTrip.reference}</h2>
                <p className="text-sm text-slate-500">{selectedTrip.client || "No client specified"}</p>
              </div>
              <button type="button" onClick={() => setSelectedTrip(null)} aria-label="Close trip details"><X /></button>
            </div>
            <div className="space-y-5 p-5">
              <Badge status={selectedTrip.status} />
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Route</p>
                <p className="mt-2 flex items-center gap-2 font-semibold">
                  <MapPin size={17} /> {selectedTrip.origin}
                  <ArrowRight size={16} />
                  {selectedTrip.destination}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs text-slate-500">Vehicle</p><p className="mt-1 font-medium">{selectedTrip.vehicleRegistration || `Vehicle #${selectedTrip.vehicleId}`}</p></div>
                <div><p className="text-xs text-slate-500">Driver</p><p className="mt-1 font-medium">{selectedTrip.driver}</p></div>
                <div><p className="text-xs text-slate-500">Cargo</p><p className="mt-1 font-medium">{selectedTrip.cargo} ({selectedTrip.cargoWeight} tonnes)</p></div>
                <div><p className="text-xs text-slate-500">Departure</p><p className="mt-1 font-medium">{displayDate(selectedTrip.departureDate)}</p></div>
                <div><p className="text-xs text-slate-500">Expected arrival</p><p className="mt-1 font-medium">{displayDate(selectedTrip.expectedArrival)}</p></div>
                <div><p className="text-xs text-slate-500">Fuel expense</p><p className="mt-1 font-medium">{money(selectedTrip.fuelCost)}</p></div>
                <div><p className="text-xs text-slate-500">Other expenses</p><p className="mt-1 font-medium">{money(selectedTrip.otherCosts)}</p></div>
                <div><p className="text-xs text-slate-500">Total expenses</p><p className="mt-1 font-bold">{money(selectedTrip.fuelCost + selectedTrip.otherCosts)}</p></div>
              </div>
              <div className="border-t pt-4">
                <h3 className="mb-3 font-semibold">Update trip status</h3>
                <div className="flex flex-wrap gap-2">
                  {(["Planned", "In Progress", "Completed", "Cancelled"] as TripStatus[])
                    .filter((status) => status !== selectedTrip.status)
                    .map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void updateTripStatus(selectedTrip, status)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold ${status === "Cancelled" ? "bg-red-100 text-red-800 hover:bg-red-200" : status === "Completed" ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-blue-100 text-blue-800 hover:bg-blue-200"}`}
                      >
                        Mark {status}
                      </button>
                    ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Django validates the trip update and manages vehicle availability based on trip status.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
