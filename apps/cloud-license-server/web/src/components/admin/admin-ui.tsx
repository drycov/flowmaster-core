import { useAdminWorkspace } from "../../hooks/useAdminWorkspace";

export function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  const revoked = status === "revoked";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-500/20 text-emerald-300"
          : revoked
            ? "bg-red-500/15 text-red-300"
            : "bg-slate-500/20 text-slate-400"
      }`}
    >
      {active ? "Активен" : revoked ? "Отозван" : status}
    </span>
  );
}

export function AdminAlerts() {
  const { error, message, setError, setMessage } = useAdminWorkspace();
  if (!error && !message) return null;
  return (
    <div className="mb-6 space-y-3">
      {message ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {message}
          <button
            type="button"
            className="ml-3 text-emerald-400/70 hover:text-emerald-200"
            onClick={() => setMessage("")}
          >
            ✕
          </button>
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
          <button
            type="button"
            className="ml-3 text-red-400/70 hover:text-red-200"
            onClick={() => setError("")}
          >
            ✕
          </button>
        </p>
      ) : null}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const { busy, reload } = useAdminWorkspace();
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      <div className="flex gap-2">
        {actions}
        <button type="button" onClick={() => void reload()} disabled={busy} className="btn-secondary text-sm">
          {busy ? "…" : "Обновить"}
        </button>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : ""
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
