
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  Settings,
  Building2,
  Bell,
  ShieldCheck,
  Globe,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  Phone,
  MapPin,
  FileText,
  Package,
  Wallet,
  Truck,
  LockKeyhole,
} from "lucide-react";

type SettingsTab = "Company Profile" | "General" | "Notifications" | "Security";

type CompanySettings = {
  companyName: string;
  registrationNumber: string;
  taxNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
};

type GeneralSettings = {
  currency: string;
  dateFormat: string;
  timeZone: string;
  language: string;
};

type NotificationSettings = {
  lowStock: boolean;
  overduePayments: boolean;
  tripUpdates: boolean;
  purchaseOrders: boolean;
  emailNotifications: boolean;
};

type SecuritySettings = {
  sessionTimeout: string;
  passwordLength: string;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
};

const initialCompany: CompanySettings = {
  companyName: "Your Company Limited",
  registrationNumber: "",
  taxNumber: "",
  email: "",
  phone: "",
  address: "",
  city: "Dar es Salaam",
  country: "Tanzania",
};

const initialGeneral: GeneralSettings = {
  currency: "TZS",
  dateFormat: "DD/MM/YYYY",
  timeZone: "Africa/Dar_es_Salaam",
  language: "English",
};

const initialNotifications: NotificationSettings = {
  lowStock: true,
  overduePayments: true,
  tripUpdates: true,
  purchaseOrders: true,
  emailNotifications: false,
};

const initialSecurity: SecuritySettings = {
  sessionTimeout: "30",
  passwordLength: "8",
  requireUppercase: true,
  requireNumber: true,
  requireSpecialCharacter: false,
};

const tabs: {
  name: SettingsTab;
  description: string;
  icon: typeof Settings;
}[] = [
  {
    name: "Company Profile",
    description: "Business identity and contact details",
    icon: Building2,
  },
  {
    name: "General",
    description: "Currency, language, and regional preferences",
    icon: Globe,
  },
  {
    name: "Notifications",
    description: "Operational alerts and reminders",
    icon: Bell,
  },
  {
    name: "Security",
    description: "Password and session preferences",
    icon: ShieldCheck,
  },
];

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 md:px-6">
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Company Profile");

  const [company, setCompany] = useState(initialCompany);
  const [general, setGeneral] = useState(initialGeneral);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [security, setSecurity] = useState(initialSecurity);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");

  function updateCompany<K extends keyof CompanySettings>(
    key: K,
    value: CompanySettings[K],
  ) {
    setCompany((current) => ({ ...current, [key]: value }));
  }

  function updateGeneral<K extends keyof GeneralSettings>(
    key: K,
    value: GeneralSettings[K],
  ) {
    setGeneral((current) => ({ ...current, [key]: value }));
  }

  function updateNotifications<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) {
    setNotifications((current) => ({ ...current, [key]: value }));
  }

  function updateSecurity<K extends keyof SecuritySettings>(
    key: K,
    value: SecuritySettings[K],
  ) {
    setSecurity((current) => ({ ...current, [key]: value }));
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeTab === "Company Profile" && !company.companyName.trim()) {
      setNoticeType("error");
      setNotice("Company name is required.");
      return;
    }

    // Demo only: settings are held in React state and are not persisted.
    setNoticeType("success");
    setNotice(
      `${activeTab} settings are updated in this demo. They will reset after a page refresh.`,
    );
  }

  function resetCurrentTab() {
    if (activeTab === "Company Profile") {
      setCompany({ ...initialCompany });
    } else if (activeTab === "General") {
      setGeneral({ ...initialGeneral });
    } else if (activeTab === "Notifications") {
      setNotifications({ ...initialNotifications });
    } else {
      setSecurity({ ...initialSecurity });
    }

    setNoticeType("success");
    setNotice(`${activeTab} settings have been reset to their demo defaults.`);
  }

  const activeTabDetails = tabs.find((tab) => tab.name === activeTab)!;
  const ActiveIcon = activeTabDetails.icon;

  return (
    <main className="min-h-0 w-full min-w-0 bg-slate-50 p-0 text-slate-900">
        <div className="w-full min-w-0 space-y-4">
        {/* Page heading */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Settings size={16} />
            <span>Administration</span>
            <span>/</span>
            <span>Settings</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            System Settings
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Configure your company profile, regional preferences, alerts, and
            security options.
          </p>
        </div>

        {/* Demo notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <AlertCircle size={19} className="mt-0.5 shrink-0 text-blue-700" />
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Demonstration mode
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Settings are stored in the current page state only. Saving does
              not yet update Django, PostgreSQL, real email notifications, or
              application security policies.
            </p>
          </div>
        </div>

        {notice && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${
              noticeType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {noticeType === "success" ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
            )}
            <p className="flex-1 text-sm">{notice}</p>
            <button
              onClick={() => setNotice("")}
              type="button"
              aria-label="Dismiss notification"
              className="text-current opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Settings navigation */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Configuration
            </p>

            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.name;

                return (
                  <button
                    key={tab.name}
                    onClick={() => {
                      setActiveTab(tab.name);
                      setNotice("");
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                      isActive
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      size={19}
                      className={`mt-0.5 shrink-0 ${
                        isActive ? "text-blue-700" : "text-slate-400"
                      }`}
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {tab.name}
                      </span>
                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          isActive ? "text-blue-700" : "text-slate-500"
                        }`}
                      >
                        {tab.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-emerald-700" />
                <p className="text-sm font-semibold text-slate-800">
                  Configuration status
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                These controls are UI demonstrations. Enforce sensitive settings
                and access controls on the backend before production use.
              </p>
            </div>
          </aside>

          {/* Main settings content */}
          <div className="min-w-0 space-y-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
                <ActiveIcon size={23} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {activeTab}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeTabDetails.description}
                </p>
              </div>
            </div>

            <form onSubmit={saveSettings} className="space-y-5">
              {/* Company profile */}
              {activeTab === "Company Profile" && (
                <>
                  <Section
                    title="Business Information"
                    description="Enter the main identification details for your company."
                  >
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <Field
                        label="Company name"
                        value={company.companyName}
                        onChange={(value) => updateCompany("companyName", value)}
                        placeholder="Your Company Limited"
                        required
                      />

                      <Field
                        label="Registration number"
                        value={company.registrationNumber}
                        onChange={(value) =>
                          updateCompany("registrationNumber", value)
                        }
                        placeholder="e.g. 123456"
                      />

                      <Field
                        label="Tax identification number (TIN)"
                        value={company.taxNumber}
                        onChange={(value) => updateCompany("taxNumber", value)}
                        placeholder="Enter company TIN"
                      />

                      <Field
                        label="Company email"
                        type="email"
                        value={company.email}
                        onChange={(value) => updateCompany("email", value)}
                        placeholder="info@yourcompany.co.tz"
                      />
                    </div>
                  </Section>

                  <Section
                    title="Contact Information"
                    description="Provide contact details and the company's business address."
                  >
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <Field
                        label="Phone number"
                        value={company.phone}
                        onChange={(value) => updateCompany("phone", value)}
                        placeholder="+255..."
                      />

                      <Field
                        label="City or district"
                        value={company.city}
                        onChange={(value) => updateCompany("city", value)}
                        placeholder="Dar es Salaam"
                      />

                      <Field
                        label="Country"
                        value={company.country}
                        onChange={(value) => updateCompany("country", value)}
                        required
                      />

                      <div className="md:col-span-2">
                        <Field
                          label="Physical address"
                          value={company.address}
                          onChange={(value) => updateCompany("address", value)}
                          placeholder="Street, building, or postal address"
                        />
                      </div>
                    </div>
                  </Section>

                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <Building2
                      size={20}
                      className="mt-0.5 shrink-0 text-slate-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Company logo
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Logo upload and storage can be added when this settings
                        page is connected to the backend.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* General settings */}
              {activeTab === "General" && (
                <>
                  <Section
                    title="Regional Preferences"
                    description="Set the default formats used throughout the system."
                  >
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <SelectField
                        label="Default currency"
                        value={general.currency}
                        onChange={(value) => updateGeneral("currency", value)}
                        options={[
                          { label: "TZS — Tanzanian Shilling", value: "TZS" },
                          { label: "USD — US Dollar", value: "USD" },
                          { label: "KES — Kenyan Shilling", value: "KES" },
                          { label: "UGX — Ugandan Shilling", value: "UGX" },
                        ]}
                      />

                      <SelectField
                        label="Date format"
                        value={general.dateFormat}
                        onChange={(value) => updateGeneral("dateFormat", value)}
                        options={[
                          { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
                          { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
                          { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
                        ]}
                      />

                      <SelectField
                        label="Time zone"
                        value={general.timeZone}
                        onChange={(value) => updateGeneral("timeZone", value)}
                        options={[
                          {
                            label: "East Africa Time — Dar es Salaam",
                            value: "Africa/Dar_es_Salaam",
                          },
                          {
                            label: "UTC",
                            value: "UTC",
                          },
                          {
                            label: "Nairobi — East Africa Time",
                            value: "Africa/Nairobi",
                          },
                          {
                            label: "Kampala — East Africa Time",
                            value: "Africa/Kampala",
                          },
                        ]}
                      />

                      <SelectField
                        label="Application language"
                        value={general.language}
                        onChange={(value) => updateGeneral("language", value)}
                        options={[
                          { label: "English", value: "English" },
                          { label: "Kiswahili", value: "Kiswahili" },
                        ]}
                      />
                    </div>
                  </Section>

                  <Section
                    title="Default Business Preferences"
                    description="These are intended as defaults for future business forms and reports."
                  >
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Wallet
                          size={19}
                          className="mt-0.5 text-emerald-700"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Financial records
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Selected currency: {general.currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <FileText
                          size={19}
                          className="mt-0.5 text-blue-700"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Document dates
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Selected format: {general.dateFormat}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Globe
                          size={19}
                          className="mt-0.5 text-violet-700"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Regional settings
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {general.timeZone.replaceAll("_", " ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Section>
                </>
              )}

              {/* Notifications */}
              {activeTab === "Notifications" && (
                <>
                  <Section
                    title="Operational Notifications"
                    description="Choose which types of operational events you want the application to flag."
                  >
                    <div className="divide-y divide-slate-100">
                      <Toggle
                        label="Low-stock alerts"
                        description="Flag products that reach or fall below their reorder levels."
                        checked={notifications.lowStock}
                        onChange={(value) =>
                          updateNotifications("lowStock", value)
                        }
                      />

                      <Toggle
                        label="Overdue payment alerts"
                        description="Flag outstanding payments that have passed their due dates."
                        checked={notifications.overduePayments}
                        onChange={(value) =>
                          updateNotifications("overduePayments", value)
                        }
                      />

                      <Toggle
                        label="Trip updates"
                        description="Prepare alerts for planned, active, and completed trips."
                        checked={notifications.tripUpdates}
                        onChange={(value) =>
                          updateNotifications("tripUpdates", value)
                        }
                      />

                      <Toggle
                        label="Purchase order updates"
                        description="Prepare alerts for purchase order creation and status changes."
                        checked={notifications.purchaseOrders}
                        onChange={(value) =>
                          updateNotifications("purchaseOrders", value)
                        }
                      />
                    </div>
                  </Section>

                  <Section
                    title="Email Delivery"
                    description="Email delivery requires a configured email service on the backend."
                  >
                    <Toggle
                      label="Email notifications"
                      description="Preference for sending supported system alerts by email."
                      checked={notifications.emailNotifications}
                      onChange={(value) =>
                        updateNotifications("emailNotifications", value)
                      }
                    />

                    {notifications.emailNotifications && (
                      <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <Mail
                          size={18}
                          className="mt-0.5 shrink-0 text-amber-700"
                        />
                        <p className="text-sm text-amber-800">
                          Email notifications are selected, but no messages
                          will be sent until an email provider and backend
                          notification jobs are configured.
                        </p>
                      </div>
                    )}
                  </Section>
                </>
              )}

              {/* Security */}
              {activeTab === "Security" && (
                <>
                  <Section
                    title="Session Preferences"
                    description="Demonstration settings for future server-enforced session controls."
                  >
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <SelectField
                        label="Session timeout"
                        value={security.sessionTimeout}
                        onChange={(value) =>
                          updateSecurity("sessionTimeout", value)
                        }
                        options={[
                          { label: "15 minutes", value: "15" },
                          { label: "30 minutes", value: "30" },
                          { label: "60 minutes", value: "60" },
                          { label: "120 minutes", value: "120" },
                        ]}
                      />

                      <SelectField
                        label="Minimum password length"
                        value={security.passwordLength}
                        onChange={(value) =>
                          updateSecurity("passwordLength", value)
                        }
                        options={[
                          { label: "8 characters", value: "8" },
                          { label: "10 characters", value: "10" },
                          { label: "12 characters", value: "12" },
                          { label: "16 characters", value: "16" },
                        ]}
                      />
                    </div>

                    <div className="mt-6 divide-y divide-slate-100">
                      <Toggle
                        label="Require uppercase letters"
                        description="Require at least one uppercase character in passwords."
                        checked={security.requireUppercase}
                        onChange={(value) =>
                          updateSecurity("requireUppercase", value)
                        }
                      />

                      <Toggle
                        label="Require a number"
                        description="Require at least one numeric character."
                        checked={security.requireNumber}
                        onChange={(value) =>
                          updateSecurity("requireNumber", value)
                        }
                      />

                      <Toggle
                        label="Require a special character"
                        description="Require a symbol such as !, @, or #."
                        checked={security.requireSpecialCharacter}
                        onChange={(value) =>
                          updateSecurity("requireSpecialCharacter", value)
                        }
                      />
                    </div>
                  </Section>

                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <LockKeyhole
                      size={20}
                      className="mt-0.5 shrink-0 text-amber-700"
                    />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Backend enforcement required
                      </p>
                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        Changing these values does not change Django password
                        validation, token expiry, or session behavior. Enforce
                        these controls server-side before production deployment.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Form actions */}
              <div className="flex flex-col-reverse justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={resetCurrentTab}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw size={16} />
                  Reset section
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Save size={17} />
                  Save Settings
                </button>
              </div>
            </form>

            {/* Configuration summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900">
                Current configuration summary
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Company</p>
                    <p className="text-sm font-medium text-slate-800">
                      {company.companyName || "Not configured"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Wallet size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Currency</p>
                    <p className="text-sm font-medium text-slate-800">
                      {general.currency}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Session timeout</p>
                    <p className="text-sm font-medium text-slate-800">
                      {security.sessionTimeout} minutes (demo setting)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Bell size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Enabled alert types</p>
                    <p className="text-sm font-medium text-slate-800">
                      {
                        [
                          notifications.lowStock,
                          notifications.overduePayments,
                          notifications.tripUpdates,
                          notifications.purchaseOrders,
                        ].filter(Boolean).length
                      }{" "}
                      of 4 operational alerts
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-800">
                      {company.phone || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-800">
                      {[company.city, company.country]
                        .filter(Boolean)
                        .join(", ") || "Not configured"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-500">
          Integrated Finance, Procurement, Inventory & Trucking System
          <span className="mx-2">·</span>
          System Settings
        </footer>
      </div>
    </main>
  );
}
