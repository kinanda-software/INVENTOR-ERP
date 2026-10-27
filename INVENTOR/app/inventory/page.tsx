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
  Package,
  Boxes,
  AlertTriangle,
  CircleDollarSign,
  Search,
  Plus,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  Pencil,
  Warehouse,
  History,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api/inventory";

type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";
type MovementType = "Stock In" | "Stock Out";
type MovementHistoryType = MovementType | "Adjustment";

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  unitCost: number;
  supplier: string;
};

type Movement = {
  id: number;
  productId: number;
  productName: string;
  type: MovementHistoryType;
  quantity: number;
  reference: string;
  date: string;
  notes: string;
};

type ProductForm = {
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  quantity: string;
  unit: string;
  reorderLevel: string;
  unitCost: string;
  supplier: string;
};

type ApiProduct = {
  id: number;
  code: string;
  name: string;
  description?: string;
  category?: string;
  warehouse?: string;
  quantity_on_hand?: string | number | null;
  unit_of_measure?: string;
  reorder_level?: string | number;
  unit_cost?: string | number;
  supplier?: string;
};

type ApiMovement = {
  id: number;
  item: number;
  item_code?: string;
  item_name?: string;
  movement_type: "RECEIPT" | "ISSUE" | "ADJUSTMENT";
  quantity: string | number;
  reference: string;
  notes?: string;
  created_at: string;
};

const emptyForm: ProductForm = {
  sku: "",
  name: "",
  category: "Office Supplies",
  warehouse: "Main Warehouse",
  quantity: "0",
  unit: "Pieces",
  reorderLevel: "10",
  unitCost: "0",
  supplier: "",
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;

  const keys = [
    "token",
    "access_token",
    "accessToken",
    "authToken",
    "jwt",
    "jwt_token",
    "audit-token",
  ];

  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  return null;
}

async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set(
      "Authorization",
      token.startsWith("Bearer ") || token.startsWith("Token ")
        ? token
        : `Token ${token}`,
    );
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Cannot connect to Django. Make sure the backend server is running at http://127.0.0.1:8000.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Authentication failed. Sign in again and check that your token is valid.",
      );
    }

    if (typeof data === "string" && data) {
      throw new Error(data);
    }

    if (data && typeof data === "object") {
      const errors = Object.entries(data as Record<string, unknown>)
        .map(([key, value]) => {
          const detail = Array.isArray(value)
            ? value.join(", ")
            : String(value);

          return `${key}: ${detail}`;
        })
        .join(" | ");

      throw new Error(errors || `Request failed (${response.status}).`);
    }

    throw new Error(`Request failed (${response.status}).`);
  }

  return data as T;
}

function extractList<T>(data: T[] | { results?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function unitToApi(unit: string): string {
  const mapping: Record<string, string> = {
    Pieces: "pcs",
    Boxes: "boxes",
    Reams: "reams",
    Packets: "packets",
    Bottles: "bottles",
    Litres: "litres",
    Kilograms: "kg",
    Tonnes: "tonnes",
    Metres: "metres",
    Units: "units",
  };

  return mapping[unit] ?? unit.toLowerCase();
}

function unitFromApi(unit?: string): string {
  const mapping: Record<string, string> = {
    pcs: "Pieces",
    pc: "Pieces",
    piece: "Pieces",
    pieces: "Pieces",
    box: "Boxes",
    boxes: "Boxes",
    ream: "Reams",
    reams: "Reams",
    packet: "Packets",
    packets: "Packets",
    bottle: "Bottles",
    bottles: "Bottles",
    litre: "Litres",
    litres: "Litres",
    kg: "Kilograms",
    kilogram: "Kilograms",
    kilograms: "Kilograms",
    tonne: "Tonnes",
    tonnes: "Tonnes",
    metre: "Metres",
    metres: "Metres",
    unit: "Units",
    units: "Units",
  };

  if (!unit) return "Pieces";

  return mapping[unit.toLowerCase().trim()] ?? unit;
}

function mapProduct(item: ApiProduct): Product {
  return {
    id: item.id,
    sku: item.code,
    name: item.name,
    category: item.category || "Other",
    warehouse: item.warehouse || "Main Warehouse",
    quantity: Number(item.quantity_on_hand ?? 0),
    unit: unitFromApi(item.unit_of_measure),
    reorderLevel: Number(item.reorder_level ?? 10),
    unitCost: Number(item.unit_cost ?? 0),
    supplier: item.supplier || "",
  };
}

function mapMovement(item: ApiMovement): Movement {
  const movementType: MovementHistoryType =
    item.movement_type === "RECEIPT"
      ? "Stock In"
      : item.movement_type === "ISSUE"
        ? "Stock Out"
        : "Adjustment";

  return {
    id: item.id,
    productId: item.item,
    productName:
      item.item_name || item.item_code || `Item #${item.item}`,
    type: movementType,
    quantity: Number(item.quantity),
    reference: item.reference,
    date: item.created_at ? item.created_at.slice(0, 10) : "",
    notes: item.notes || "",
  };
}

function getStockStatus(product: Product): StockStatus {
  if (product.quantity <= 0) return "Out of Stock";
  if (product.quantity <= product.reorderLevel) return "Low Stock";
  return "In Stock";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-TZ").format(amount);
}

function getLocalDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function makeReference(type: MovementType): string {
  const prefix = type === "Stock In" ? "GRN" : "ISS";

  return `${prefix}-${getLocalDate()}-${Date.now().toString().slice(-6)}`;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [activeTab, setActiveTab] = useState<"products" | "movements">(
    "products",
  );

  const [showProductForm, setShowProductForm] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>("Stock In");
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [productForm, setProductForm] = useState<ProductForm>(emptyForm);

  const [movementForm, setMovementForm] = useState({
    productId: "",
    quantity: "1",
    reference: "",
    notes: "",
  });

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [itemsData, movementsData] = await Promise.all([
        apiRequest<ApiProduct[] | { results?: ApiProduct[] }>("/items/"),
        apiRequest<ApiMovement[] | { results?: ApiMovement[] }>("/movements/"),
      ]);

      setProducts(extractList(itemsData).map(mapProduct));
      setMovements(extractList(movementsData).map(mapMovement));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load inventory data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))),
    [products],
  );

  const totalProducts = products.length;

  const totalUnits = products.reduce(
    (total, product) => total + product.quantity,
    0,
  );

  const stockValue = products.reduce(
    (total, product) => total + product.quantity * product.unitCost,
    0,
  );

  const lowStockCount = products.filter(
    (product) => getStockStatus(product) === "Low Stock",
  ).length;

  const outOfStockCount = products.filter(
    (product) => getStockStatus(product) === "Out of Stock",
  ).length;

  const filteredProducts = useMemo(() => {
    const query = search.toLowerCase().trim();

    return products.filter((product) => {
      const matchesSearch = [
        product.sku,
        product.name,
        product.category,
        product.supplier,
        product.warehouse,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      const matchesCategory =
        categoryFilter === "All" || product.category === categoryFilter;

      const matchesStatus =
        statusFilter === "All" || getStockStatus(product) === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  function openNewProductForm() {
    setEditingProduct(null);
    setProductForm(emptyForm);
    setMessage("");
    setError("");
    setShowProductForm(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);

    setProductForm({
      sku: product.sku,
      name: product.name,
      category: product.category,
      warehouse: product.warehouse,
      quantity: String(product.quantity),
      unit: product.unit,
      reorderLevel: String(product.reorderLevel),
      unitCost: String(product.unitCost),
      supplier: product.supplier,
    });

    setMessage("");
    setError("");
    setShowProductForm(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const sku = productForm.sku.trim().toUpperCase();
    const name = productForm.name.trim();
    const quantity = Number(productForm.quantity);
    const reorderLevel = Number(productForm.reorderLevel);
    const unitCost = Number(productForm.unitCost);

    if (!sku || !name) {
      setError("Product code and product name are required.");
      return;
    }

    const duplicateSku = products.some(
      (product) =>
        product.sku.toLowerCase() === sku.toLowerCase() &&
        product.id !== editingProduct?.id,
    );

    if (duplicateSku) {
      setError("This product code already exists. Use a unique code.");
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(reorderLevel) ||
      !Number.isFinite(unitCost) ||
      quantity < 0 ||
      reorderLevel < 0 ||
      unitCost < 0
    ) {
      setError("Enter valid non-negative numbers for quantity and cost.");
      return;
    }

    if (!Number.isInteger(quantity)) {
      setError("Opening quantity must be a whole number.");
      return;
    }

    const payload = {
      code: sku,
      name,
      category: productForm.category,
      warehouse: productForm.warehouse,
      unit_of_measure: unitToApi(productForm.unit),
      reorder_level: reorderLevel,
      unit_cost: unitCost,
      supplier: productForm.supplier.trim(),
      is_active: true,
    };

    setSaving(true);

    try {
      if (editingProduct) {
        await apiRequest<ApiProduct>(`/items/${editingProduct.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setShowProductForm(false);
        setEditingProduct(null);

        setMessage(
          `${name} updated. Stock quantities are changed through stock movements.`,
        );

        await loadData(true);
        return;
      }

      const created = await apiRequest<ApiProduct>("/items/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (quantity > 0) {
        try {
          await apiRequest("/movements/record/", {
            method: "POST",
            body: JSON.stringify({
              item: created.id,
              movement_type: "RECEIPT",
              quantity,
              reference: `OPENING-${sku}`,
              notes: "Opening stock entered when registering the product.",
            }),
          });

          setMessage(
            `${name} was created and opening stock of ${quantity} ${productForm.unit} was recorded.`,
          );
        } catch (movementError) {
          setMessage(
            `${name} was created, but opening stock was not recorded. Open Stock In and record the quantity. ${
              movementError instanceof Error
                ? movementError.message
                : ""
            }`,
          );
        }
      } else {
        setMessage(`${name} was added to the inventory.`);
      }

      setShowProductForm(false);
      setEditingProduct(null);

      await loadData(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save the product.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openMovementForm(type: MovementType, product?: Product) {
    setMovementType(type);

    const selected = product ?? selectedProduct;

    setMovementForm({
      productId: selected ? String(selected.id) : "",
      quantity: "1",
      reference: "",
      notes: "",
    });

    setSelectedProduct(null);
    setMessage("");
    setError("");
    setShowMovementForm(true);
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const productId = Number(movementForm.productId);
    const quantity = Number(movementForm.quantity);
    const product = products.find((item) => item.id === productId);

    if (!product) {
      setError("Please select a valid product.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    if (movementType === "Stock Out" && quantity > product.quantity) {
      setError(
        `Insufficient stock. Available quantity: ${product.quantity} ${product.unit}.`,
      );
      return;
    }

    const reference =
      movementForm.reference.trim() || makeReference(movementType);

    setSaving(true);

    try {
      await apiRequest("/movements/record/", {
        method: "POST",
        body: JSON.stringify({
          item: productId,
          movement_type: movementType === "Stock In" ? "RECEIPT" : "ISSUE",
          quantity,
          reference,
          notes: movementForm.notes.trim(),
        }),
      });

      setShowMovementForm(false);

      setMessage(
        `${movementType === "Stock In" ? "Received" : "Issued"} ${quantity} ${product.unit} of ${product.name}. The database has been updated.`,
      );

      await loadData(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to record stock movement.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
     <div className="min-h-0 w-full min-w-0 bg-slate-50 p-0 text-slate-900">
       <div className="w-full min-w-0 space-y-4">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Warehouse size={18} />
              INVENTORY OPERATIONS
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Inventory Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Monitor stock levels, manage products and record stock movements.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openMovementForm("Stock In")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-100"
            >
              <ArrowDownToLine size={17} />
              Stock In
            </button>

            <button
              type="button"
              onClick={() => openMovementForm("Stock Out")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-100"
            >
              <ArrowUpFromLine size={17} />
              Issue Stock
            </button>

            <button
              type="button"
              onClick={openNewProductForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <Plus size={18} />
              Add Product
            </button>

            <button
              type="button"
              disabled={refreshing || loading}
              onClick={() => void loadData(true)}
              title="Refresh inventory"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </header>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>Live database mode:</strong> products and stock movements are
          loaded from Django. Stock changes are saved through the backend.
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total products"
            value={loading ? "—" : formatNumber(totalProducts)}
            description="Registered inventory items"
            icon={<Package size={22} />}
          />

          <SummaryCard
            title="Units in stock"
            value={loading ? "—" : formatNumber(totalUnits)}
            description="Combined stock quantity"
            icon={<Boxes size={22} />}
          />

          <SummaryCard
            title="Stock value"
            value={loading ? "—" : formatMoney(stockValue)}
            description="Estimated current stock cost"
            icon={<CircleDollarSign size={22} />}
          />

          <SummaryCard
            title="Low / out of stock"
            value={
              loading
                ? "—"
                : formatNumber(lowStockCount + outOfStockCount)
            }
            description={`${lowStockCount} low stock · ${outOfStockCount} out of stock`}
            icon={<AlertTriangle size={22} />}
            warning
          />
        </section>

        {!loading && (lowStockCount > 0 || outOfStockCount > 0) && (
          <section className="rounded-2xl border border-amber-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                <AlertTriangle size={21} />
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="font-bold">Stock alerts</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The following products need your attention.
                </p>

                <div className="mt-4 space-y-3">
                  {products
                    .filter(
                      (product) => getStockStatus(product) !== "In Stock",
                    )
                    .map((product) => (
                      <div
                        key={product.id}
                        className="flex flex-col justify-between gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-xs text-slate-500">
                            SKU: {product.sku} · Reorder level:{" "}
                            {product.reorderLevel} {product.unit}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            {formatNumber(product.quantity)} {product.unit}
                          </span>

                          <StatusBadge status={getStockStatus(product)} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-bold">Inventory register</h2>
              <p className="mt-1 text-sm text-slate-500">
                Search products, check stock and manage inventory.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  activeTab === "products"
                    ? "bg-blue-700 text-white"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Products
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("movements")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                  activeTab === "movements"
                    ? "bg-blue-700 text-white"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <History size={16} />
                Stock movements
              </button>
            </div>
          </div>

          {activeTab === "products" ? (
            <>
              <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-3">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search SKU, product, supplier..."
                    aria-label="Search inventory products"
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-600"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  aria-label="Filter by category"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="All">All categories</option>

                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by stock status"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="All">All stock statuses</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Product</th>
                      <th className="px-5 py-4">Category</th>
                      <th className="px-5 py-4">Warehouse</th>
                      <th className="px-5 py-4">Quantity</th>
                      <th className="px-5 py-4">Unit cost</th>
                      <th className="px-5 py-4">Stock value</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-10 text-center text-slate-500"
                        >
                          Loading inventory from Django...
                        </td>
                      </tr>
                    ) : (
                      <>
                        {filteredProducts.map((product) => (
                          <tr
                            key={product.id}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <p className="font-semibold">{product.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {product.sku}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              {product.category}
                            </td>

                            <td className="px-5 py-4">
                              {product.warehouse}
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-semibold">
                                {formatNumber(product.quantity)} {product.unit}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Reorder at {product.reorderLevel}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              {formatMoney(product.unitCost)}
                            </td>

                            <td className="px-5 py-4 font-semibold">
                              {formatMoney(
                                product.quantity * product.unitCost,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={getStockStatus(product)}
                              />
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedProduct(product)
                                  }
                                  title="View product"
                                  aria-label={`View ${product.name}`}
                                  className="text-blue-700 hover:text-blue-900"
                                >
                                  <Eye size={17} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditProduct(product)}
                                  title="Edit product"
                                  aria-label={`Edit ${product.name}`}
                                  className="text-slate-600 hover:text-slate-900"
                                >
                                  <Pencil size={17} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openMovementForm("Stock In", product)
                                  }
                                  title="Receive stock"
                                  aria-label={`Receive stock for ${product.name}`}
                                  className="text-emerald-700 hover:text-emerald-900"
                                >
                                  <ArrowDownToLine size={17} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {filteredProducts.length === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="p-10 text-center text-slate-500"
                            >
                              {error
                                ? "Inventory could not be loaded. Check the error above."
                                : "No matching products found."}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
                Showing {filteredProducts.length} of {products.length} products
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">Movement</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Reference</th>
                    <th className="px-5 py-4">Notes</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-10 text-center text-slate-500"
                      >
                        Loading stock movements...
                      </td>
                    </tr>
                  ) : (
                    <>
                      {movements.map((movement) => (
                        <tr
                          key={movement.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            {movement.date}
                          </td>

                          <td className="px-5 py-4 font-semibold">
                            {movement.productName}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                movement.type === "Stock In"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : movement.type === "Stock Out"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {movement.type}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-semibold">
                            {movement.type === "Stock In"
                              ? "+"
                              : movement.type === "Stock Out"
                                ? "-"
                                : ""}
                            {formatNumber(movement.quantity)}
                          </td>

                          <td className="px-5 py-4">
                            {movement.reference}
                          </td>

                          <td className="px-5 py-4 text-slate-500">
                            {movement.notes || "—"}
                          </td>
                        </tr>
                      ))}

                      {movements.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-10 text-center text-slate-500"
                          >
                            No stock movements recorded yet.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showProductForm && (
        <Modal
          title={editingProduct ? "Edit product" : "Add new product"}
          onClose={() => {
            if (!saving) setShowProductForm(false);
          }}
        >
          <form onSubmit={saveProduct} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU / Product code *">
                <input
                  required
                  value={productForm.sku}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      sku: event.target.value,
                    })
                  }
                  placeholder="OFF-003"
                  className="field-input"
                />
              </Field>

              <Field label="Product name *">
                <input
                  required
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="Enter product name"
                  className="field-input"
                />
              </Field>

              <Field label="Category *">
                <select
                  value={productForm.category}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      category: event.target.value,
                    })
                  }
                  className="field-input"
                >
                  <option>Office Supplies</option>
                  <option>IT Equipment</option>
                  <option>Safety Equipment</option>
                  <option>Cleaning Supplies</option>
                  <option>Raw Materials</option>
                  <option>Spare Parts</option>
                  <option>Other</option>
                </select>
              </Field>

              <Field label="Warehouse *">
                <select
                  value={productForm.warehouse}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      warehouse: event.target.value,
                    })
                  }
                  className="field-input"
                >
                  <option>Main Warehouse</option>
                  <option>IT Store</option>
                  <option>Safety Store</option>
                  <option>Raw Materials Store</option>
                  <option>Spare Parts Store</option>
                </select>
              </Field>

              <Field
                label={
                  editingProduct
                    ? "Current quantity (read-only)"
                    : "Opening quantity *"
                }
              >
                <input
                  required
                  disabled={Boolean(editingProduct)}
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.quantity}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      quantity: event.target.value,
                    })
                  }
                  className="field-input disabled:bg-slate-100 disabled:text-slate-500"
                />

                {editingProduct && (
                  <span className="mt-1 block text-xs text-slate-500">
                    Record stock in or stock out to change this quantity.
                  </span>
                )}
              </Field>

              <Field label="Unit of measure *">
                <select
                  value={productForm.unit}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      unit: event.target.value,
                    })
                  }
                  className="field-input"
                >
                  <option>Pieces</option>
                  <option>Boxes</option>
                  <option>Reams</option>
                  <option>Packets</option>
                  <option>Bottles</option>
                  <option>Litres</option>
                  <option>Kilograms</option>
                  <option>Tonnes</option>
                  <option>Metres</option>
                  <option>Units</option>
                </select>
              </Field>

              <Field label="Reorder level *">
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={productForm.reorderLevel}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      reorderLevel: event.target.value,
                    })
                  }
                  className="field-input"
                />
              </Field>

              <Field label="Unit cost (TZS) *">
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={productForm.unitCost}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      unitCost: event.target.value,
                    })
                  }
                  className="field-input"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Preferred supplier">
                  <input
                    value={productForm.supplier}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        supplier: event.target.value,
                      })
                    }
                    placeholder="Supplier name"
                    className="field-input"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowProductForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingProduct
                    ? "Save changes"
                    : "Add product"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showMovementForm && (
        <Modal
          title={movementType === "Stock In" ? "Receive stock" : "Issue stock"}
          onClose={() => {
            if (!saving) setShowMovementForm(false);
          }}
        >
          <form onSubmit={saveMovement} className="space-y-4">
            <Field label="Product *">
              <select
                required
                value={movementForm.productId}
                onChange={(event) =>
                  setMovementForm({
                    ...movementForm,
                    productId: event.target.value,
                  })
                }
                className="field-input"
              >
                <option value="">Select a product</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name} ({product.quantity}{" "}
                    {product.unit} available)
                  </option>
                ))}
              </select>
            </Field>

            {movementForm.productId && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Current stock:{" "}
                <strong>
                  {products.find(
                    (product) =>
                      product.id === Number(movementForm.productId),
                  )?.quantity ?? 0}{" "}
                  {products.find(
                    (product) =>
                      product.id === Number(movementForm.productId),
                  )?.unit ?? "units"}
                </strong>
              </div>
            )}

            <Field label="Quantity *">
              <input
                required
                type="number"
                min="0.01"
                step="any"
                value={movementForm.quantity}
                onChange={(event) =>
                  setMovementForm({
                    ...movementForm,
                    quantity: event.target.value,
                  })
                }
                className="field-input"
              />
            </Field>

            <Field label="Reference number">
              <input
                value={movementForm.reference}
                onChange={(event) =>
                  setMovementForm({
                    ...movementForm,
                    reference: event.target.value,
                  })
                }
                placeholder={
                  movementType === "Stock In"
                    ? "e.g. GRN-2026-005"
                    : "e.g. ISS-2026-002"
                }
                className="field-input"
              />
            </Field>

            <Field label="Notes">
              <textarea
                rows={3}
                value={movementForm.notes}
                onChange={(event) =>
                  setMovementForm({
                    ...movementForm,
                    notes: event.target.value,
                  })
                }
                placeholder="Reason or details for this movement"
                className="field-input"
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowMovementForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  movementType === "Stock In"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-blue-700 hover:bg-blue-800"
                }`}
              >
                {saving
                  ? "Saving..."
                  : movementType === "Stock In"
                    ? "Confirm stock in"
                    : "Confirm issue"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedProduct && (
        <Modal
          title="Product details"
          onClose={() => setSelectedProduct(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <span className="rounded-xl bg-blue-100 p-3 text-blue-700">
                <Package size={25} />
              </span>

              <div>
                <h3 className="text-lg font-bold">
                  {selectedProduct.name}
                </h3>

                <p className="text-sm text-slate-500">
                  SKU: {selectedProduct.sku}
                </p>

                <div className="mt-2">
                  <StatusBadge
                    status={getStockStatus(selectedProduct)}
                  />
                </div>
              </div>
            </div>

            <Detail
              label="Category"
              value={selectedProduct.category}
            />

            <Detail
              label="Warehouse"
              value={selectedProduct.warehouse}
            />

            <Detail
              label="Available quantity"
              value={`${selectedProduct.quantity} ${selectedProduct.unit}`}
            />

            <Detail
              label="Reorder level"
              value={`${selectedProduct.reorderLevel} ${selectedProduct.unit}`}
            />

            <Detail
              label="Unit cost"
              value={formatMoney(selectedProduct.unitCost)}
            />

            <Detail
              label="Total stock value"
              value={formatMoney(
                selectedProduct.quantity * selectedProduct.unitCost,
              )}
            />

            <Detail
              label="Supplier"
              value={selectedProduct.supplier || "Not specified"}
            />

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  const product = selectedProduct;
                  setSelectedProduct(null);
                  openEditProduct(product);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Edit product
              </button>

              <button
                type="button"
                onClick={() =>
                  openMovementForm("Stock In", selectedProduct)
                }
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Receive stock
              </button>

              <button
                type="button"
                onClick={() =>
                  openMovementForm("Stock Out", selectedProduct)
                }
                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Issue stock
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
  warning = false,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{title}</p>

        <span
          className={`rounded-xl p-2 ${
            warning
              ? "bg-amber-50 text-amber-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {icon}
        </span>
      </div>

      <p className="mt-4 break-words text-2xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  const styles: Record<StockStatus, string> = {
    "In Stock": "bg-emerald-50 text-emerald-700",
    "Low Stock": "bg-amber-50 text-amber-700",
    "Out of Stock": "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
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
    <label className="block space-y-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
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
      <span className="break-words font-medium sm:text-right">{value}</span>
    </div>
  );
}