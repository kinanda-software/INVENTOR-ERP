
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";

type Supplier = {
  id: number;
  name: string;
  supplier_code: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  tax_number: string;
  is_active: boolean;
  created_at?: string;
};

type SupplierForm = Omit<Supplier, "id" | "created_at">;

type ApiError = {
  detail?: string;
  [field: string]: unknown;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const SUPPLIERS_ENDPOINT = `${API_URL}/api/procurement/suppliers/`;

const emptyForm: SupplierForm = {
  name: "",
  supplier_code: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  tax_number: "",
  is_active: true,
};

const inputClass =
  "mt-2 block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

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

  if (!data) {
    return `Request failed with HTTP ${response.status}.`;
  }

  if (data.detail) {
    return data.detail;
  }

  const messages = Object.entries(data)
    .map(([field, value]) => {
      const description = Array.isArray(value)
        ? value.join(", ")
        : typeof value === "string"
          ? value
          : JSON.stringify(value);

      return `${field}: ${description}`;
    })
    .join("; ");

  return messages || `Request failed with HTTP ${response.status}.`;
}

export default function ProcurementPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>({ ...emptyForm });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSuppliers() {
      setLoading(true);
      setError("");

      try {
        const token = getAuthToken();

        if (!token) {
          throw new Error(
            "No login token found. Sign in first and check the token key used by your login page.",
          );
        }

        const response = await fetch(SUPPLIERS_ENDPOINT, {
          method: "GET",
          headers: {
            Authorization: `Token ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const data: unknown = await response.json();

        let records: Supplier[];

        if (Array.isArray(data)) {
          records = data as Supplier[];
        } else if (
          data !== null &&
          typeof data === "object" &&
          "results" in data &&
          Array.isArray(data.results)
        ) {
          records = data.results as Supplier[];
        } else {
          throw new Error(
            "The supplier API returned an unexpected response format.",
          );
        }

        if (!cancelled) {
          setSuppliers(records);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading suppliers.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSuppliers();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = suppliers.filter(
    (supplier) => supplier.is_active,
  ).length;

  const inactiveCount = suppliers.length - activeCount;

  const filteredSuppliers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return suppliers.filter((supplier) => {
      const matchesSearch = [
        supplier.name,
        supplier.supplier_code,
        supplier.contact_person,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.tax_number,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && supplier.is_active) ||
        (statusFilter === "inactive" && !supplier.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, search, statusFilter]);

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(supplier: Supplier) {
    setEditingId(supplier.id);

    setForm({
      name: supplier.name,
      supplier_code: supplier.supplier_code,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      tax_number: supplier.tax_number,
      is_active: supplier.is_active,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function updateField<K extends keyof SupplierForm>(
    field: K,
    value: SupplierForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedName = form.name.trim();
    const normalizedCode = form.supplier_code.trim();

    if (!normalizedName || !normalizedCode) {
      setError("Supplier name and supplier code are required.");
      return;
    }

    const duplicateCode = suppliers.some(
      (supplier) =>
        supplier.supplier_code.trim().toLowerCase() ===
          normalizedCode.toLowerCase() &&
        supplier.id !== editingId,
    );

    if (duplicateCode) {
      setError("That supplier code already exists. Please use another code.");
      return;
    }

    const cleanedForm: SupplierForm = {
      ...form,
      name: normalizedName,
      supplier_code: normalizedCode,
      contact_person: form.contact_person.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      tax_number: form.tax_number.trim(),
    };

    setSaving(true);

    try {
      const token = getAuthToken();

      if (!token) {
        throw new Error("Your login token is missing. Please sign in again.");
      }

      const isEditing = editingId !== null;

      const response = await fetch(
        isEditing
          ? `${SUPPLIERS_ENDPOINT}${editingId}/`
          : SUPPLIERS_ENDPOINT,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(cleanedForm),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const savedSupplier = (await response.json()) as Supplier;

      setSuppliers((current) => {
        if (isEditing) {
          return current.map((supplier) =>
            supplier.id === savedSupplier.id ? savedSupplier : supplier,
          );
        }

        return [...current, savedSupplier];
      });

      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });

      setSuccess(
        isEditing
          ? "Supplier updated successfully in the database."
          : "Supplier created successfully in the database.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving the supplier.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleSupplier(supplier: Supplier) {
    const action = supplier.is_active ? "deactivate" : "activate";

    if (!window.confirm(`Do you want to ${action} ${supplier.name}?`)) {
      return;
    }

    setError("");
    setSuccess("");
    setUpdatingId(supplier.id);

    try {
      const token = getAuthToken();

      if (!token) {
        throw new Error("Your login token is missing. Please sign in again.");
      }

      const response = await fetch(
        `${SUPPLIERS_ENDPOINT}${supplier.id}/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            is_active: !supplier.is_active,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const updatedSupplier = (await response.json()) as Supplier;

      setSuppliers((current) =>
        current.map((item) =>
          item.id === updatedSupplier.id ? updatedSupplier : item,
        ),
      );

      setSuccess(
        `Supplier ${action === "activate" ? "activated" : "deactivated"} successfully.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update supplier status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="min-h-0 w-full min-w-0 overflow-x-clip bg-slate-50 p-0 text-slate-900">
        <div className="w-full min-w-0 space-y-4">
        <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Truck size={17} className="shrink-0" />
              PROCUREMENT
            </div>

            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
              Supplier Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage supplier information, contacts and account status.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus size={18} />
            Add supplier
          </button>
        </header>

        <div className="flex min-w-0 items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900 sm:p-4">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <p className="min-w-0 break-words">
            Supplier records are loaded from your Django database. New records
            and changes are saved through the API.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex min-w-0 items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800 sm:p-4"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p className="min-w-0 break-words">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="ml-auto shrink-0 rounded-lg p-1 hover:bg-red-100"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex min-w-0 items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800 sm:p-4"
          >
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p className="min-w-0 break-words">{success}</p>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success message"
              className="ml-auto shrink-0 rounded-lg p-1 hover:bg-emerald-100"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <section
          aria-label="Supplier summary"
          className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
        >
          <SummaryCard
            label="Total suppliers"
            value={suppliers.length}
            description="All registered records"
          />

          <SummaryCard
            label="Active suppliers"
            value={activeCount}
            description="Available for procurement"
            valueClass="text-emerald-700"
          />

          <SummaryCard
            label="Inactive suppliers"
            value={inactiveCount}
            description="Not currently available"
            valueClass="text-slate-500"
          />

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm text-slate-500">Supplier register</p>
            <div className="mt-3 flex min-w-0 items-center gap-2">
              <UserRound size={25} className="shrink-0 text-blue-700" />
              <span className="break-words text-lg font-bold">Management</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Search and maintain records
            </p>
          </div>
        </section>

        <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-w-0 flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="font-bold">Registered suppliers</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Search, review and manage supplier details.
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative w-full min-w-0 sm:flex-1 lg:w-64 lg:flex-none">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search suppliers..."
                  aria-label="Search suppliers"
                  className="block w-full min-w-0 rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter suppliers by status"
                className="block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-auto"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              Loading suppliers from the database...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="px-4 py-12 text-center sm:px-8">
              <UserRound size={30} className="mx-auto text-slate-400" />
              <h3 className="mt-4 font-semibold">No suppliers found</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Change your search or add a new supplier.
              </p>
              {search || statusFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  className="mt-4 text-sm font-semibold text-blue-700 hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-4 sm:px-5">
                        Supplier
                      </th>
                      <th scope="col" className="px-4 py-4 sm:px-5">
                        Contact person
                      </th>
                      <th scope="col" className="px-4 py-4 sm:px-5">
                        Phone / Email
                      </th>
                      <th scope="col" className="px-4 py-4 sm:px-5">
                        Tax number
                      </th>
                      <th scope="col" className="px-4 py-4 sm:px-5">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-4 sm:px-5">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredSuppliers.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="max-w-64 px-4 py-4 sm:px-5">
                          <p className="break-words font-semibold">
                            {supplier.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {supplier.supplier_code}
                          </p>
                        </td>

                        <td className="px-4 py-4 sm:px-5">
                          {supplier.contact_person || "—"}
                        </td>

                        <td className="px-4 py-4 sm:px-5">
                          <p>{supplier.phone || "—"}</p>
                          <p className="mt-1 break-all text-xs text-slate-500">
                            {supplier.email || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-4 sm:px-5">
                          {supplier.tax_number || "—"}
                        </td>

                        <td className="px-4 py-4 sm:px-5">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                              supplier.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {supplier.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-4 py-4 sm:px-5">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openEditForm(supplier)}
                              className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-blue-700 hover:underline"
                            >
                              <Edit3 size={14} />
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={updatingId === supplier.id}
                              onClick={() => toggleSupplier(supplier)}
                              className="whitespace-nowrap font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updatingId === supplier.id
                                ? "Updating..."
                                : supplier.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-1 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span>
                  Showing {filteredSuppliers.length} of {suppliers.length}{" "}
                  suppliers
                </span>
                <span className="text-slate-400">
                  Scroll the table horizontally to see all columns.
                </span>
              </div>
            </>
          )}
        </section>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/50 p-2 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-form-title"
            className="my-auto max-h-[94dvh] w-full max-w-2xl min-w-0 overflow-y-auto rounded-xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-5">
              <div className="min-w-0">
                <h2 id="supplier-form-title" className="text-lg font-bold">
                  {editingId !== null ? "Edit supplier" : "Add supplier"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Enter the supplier&apos;s business and contact information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
                className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveSupplier} className="space-y-5 p-4 sm:p-5">
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-medium">
                  Supplier name *
                  <input
                    required
                    maxLength={200}
                    autoComplete="organization"
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Enter supplier name"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium">
                  Supplier code *
                  <input
                    required
                    maxLength={30}
                    value={form.supplier_code}
                    onChange={(event) =>
                      updateField("supplier_code", event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. SUP-004"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium">
                  Contact person
                  <input
                    maxLength={150}
                    value={form.contact_person}
                    onChange={(event) =>
                      updateField("contact_person", event.target.value)
                    }
                    className={inputClass}
                    autoComplete="name"
                    placeholder="Contact person's name"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium">
                  Phone
                  <input
                    type="tel"
                    maxLength={30}
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    className={inputClass}
                    autoComplete="tel"
                    placeholder="+255..."
                  />
                </label>

                <label className="min-w-0 text-sm font-medium">
                  Email
                  <input
                    type="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    className={inputClass}
                    autoComplete="email"
                    placeholder="supplier@example.com"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium">
                  Tax number
                  <input
                    maxLength={50}
                    value={form.tax_number}
                    onChange={(event) =>
                      updateField("tax_number", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Enter tax number"
                  />
                </label>

                <label className="min-w-0 text-sm font-medium sm:col-span-2">
                  Address
                  <textarea
                    rows={3}
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Street, town, region"
                  />
                </label>

                <label className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      updateField("is_active", event.target.checked)
                    }
                    className="h-4 w-4 shrink-0 accent-blue-700"
                  />
                  <span>Supplier is active</span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeForm}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                >
                  <Plus size={17} />
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save changes"
                      : "Create supplier"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: number;
  description: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
    </div>
  );
}
