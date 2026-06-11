import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  adminLogout,
  fetchAdminActivations,
  fetchAdminKeys,
  fetchAdminOverview,
  fetchAdminProvisions,
  generateKey,
  LICENSE_PLANS,
  PLAN_LABELS,
  provisionInstallation,
  registerKey,
  revokeTarget,
  type ActivationRow,
  type AdminOverview,
  type KeyRow,
  type LicensePlan,
  type ProvisionRow,
} from "../lib/admin-api";
import { useAdminSession } from "../hooks/useAdminSession";

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400"
      }`}
    >
      {active ? "Активен" : status}
    </span>
  );
}

export function AdminConsolePage() {
  const { session, loading, refresh } = useAdminSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"provisions" | "keys" | "activations" | "register">("provisions");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [provisions, setProvisions] = useState<ProvisionRow[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [activations, setActivations] = useState<ActivationRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [registerKeyVal, setRegisterKeyVal] = useState("");
  const [showProvision, setShowProvision] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPlan, setGenPlan] = useState<LicensePlan>("professional");
  const [genCustomer, setGenCustomer] = useState("");
  const [genInstallationId, setGenInstallationId] = useState("");
  const [genMaxUsers, setGenMaxUsers] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [ov, prov, k, act] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminProvisions(),
        fetchAdminKeys(),
        fetchAdminActivations(),
      ]);
      setOverview(ov);
      setProvisions(prov.items);
      setKeys(k.items);
      setActivations(act.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session?.authenticated) void reload();
  }, [session?.authenticated, reload]);

  async function logout() {
    await adminLogout();
    await refresh();
    navigate("/admin");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">Загрузка…</div>
    );
  }

  if (!session?.authenticated) {
    return <Navigate to="/admin" replace />;
  }

  async function handleProvision(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await provisionInstallation({
        installation_id: genInstallationId.trim(),
        plan: genPlan,
        customer_name: genCustomer.trim(),
        max_users: genMaxUsers ? Number.parseInt(genMaxUsers, 10) : undefined,
      });
      setMessage("Установка зарегистрирована");
      setShowProvision(false);
      setGenCustomer("");
      setGenInstallationId("");
      setGenMaxUsers("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const result = await generateKey({
        installation_id: genInstallationId.trim(),
        plan: genPlan,
        customer: genCustomer.trim(),
        max_users: genMaxUsers ? Number.parseInt(genMaxUsers, 10) : undefined,
      });
      setGeneratedKey(result.license_key);
      setMessage("Ключ создан");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRegisterKey(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await registerKey(registerKeyVal.trim());
      setMessage("Ключ зарегистрирован");
      setRegisterKeyVal("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRevoke(installationId: string) {
    if (!confirm(`Отозвать установку ${installationId}?`)) return;
    setError("");
    try {
      const result = await revokeTarget({
        installation_id: installationId,
        reason: "Отозвано поставщиком",
      });
      setMessage(`Отозвано: ключей ${result.revoked_keys}, активаций ${result.revoked_activations}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const tabs = [
    { id: "provisions" as const, label: "Установки" },
    { id: "keys" as const, label: "Ключи" },
    { id: "activations" as const, label: "Активации" },
    { id: "register" as const, label: "Регистрация FM1" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-sky-400">Vendor Admin</p>
            <h1 className="text-lg font-semibold">License Server Console</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void reload()} disabled={busy} className="btn-secondary text-sm">
              {busy ? "…" : "Обновить"}
            </button>
            <button type="button" onClick={() => void logout()} className="btn-secondary text-sm">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {message ? (
          <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {overview ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Установки", overview.provisions_active, overview.provisions_total],
              ["Ключи", overview.keys_active, overview.keys_total],
              ["Активации", overview.activations_active, overview.activations_total],
              ["Обновлено", new Date(overview.checked_at).toLocaleTimeString("ru-RU"), ""],
            ].map(([label, a, b]) => (
              <div key={String(label)} className="card p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold">
                  {b !== "" ? `${a} / ${b}` : a}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2 border-b border-white/10 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-sky-500/20 text-sky-200" : "text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "provisions" && (
          <section className="space-y-4">
            <div className="flex justify-end">
              <button type="button" onClick={() => setShowProvision(true)} className="btn-primary text-sm">
                + Зарегистрировать установку
              </button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Заказчик</th>
                    <th className="p-3">Installation ID</th>
                    <th className="p-3">Тариф</th>
                    <th className="p-3">Мест</th>
                    <th className="p-3">Срок</th>
                    <th className="p-3">Статус</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {provisions.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="p-3">{row.customer_name || "—"}</td>
                      <td className="p-3 font-mono text-xs">{row.installation_id}</td>
                      <td className="p-3">{row.plan_label}</td>
                      <td className="p-3">{row.max_users}</td>
                      <td className="p-3 text-slate-400">
                        {row.expires_at
                          ? new Date(row.expires_at).toLocaleDateString("ru-RU")
                          : "∞"}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="p-3">
                        {row.status === "active" && (
                          <button
                            type="button"
                            className="text-xs text-red-400 hover:underline"
                            onClick={() => void handleRevoke(row.installation_id)}
                          >
                            Отозвать
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!provisions.length && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Нет установок
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "keys" && (
          <section className="space-y-4">
            <div className="flex justify-end">
              <button type="button" onClick={() => setShowGenerate(true)} className="btn-primary text-sm">
                + Создать FM1
              </button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Заказчик</th>
                    <th className="p-3">Хеш</th>
                    <th className="p-3">Тариф</th>
                    <th className="p-3">Активации</th>
                    <th className="p-3">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="p-3">{row.customer_name || "—"}</td>
                      <td className="p-3 font-mono text-xs">{row.key_hash_short}</td>
                      <td className="p-3">{row.plan_label}</td>
                      <td className="p-3">
                        {row.active_activations}/{row.max_activations}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "activations" && (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Заказчик</th>
                  <th className="p-3">Installation ID</th>
                  <th className="p-3">Хост</th>
                  <th className="p-3">Контакт</th>
                  <th className="p-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {activations.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="p-3">{row.customer_name || "—"}</td>
                    <td className="p-3 font-mono text-xs">{row.installation_id}</td>
                    <td className="p-3 max-w-[180px] truncate">{row.hostname || "—"}</td>
                    <td className="p-3 text-slate-400">
                      {new Date(row.last_seen_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegisterKey} className="card max-w-xl space-y-4 p-6">
            <p className="text-sm text-slate-400">Pre-register существующего FM1-ключа</p>
            <textarea
              className="input min-h-[100px] font-mono text-xs"
              value={registerKeyVal}
              onChange={(e) => setRegisterKeyVal(e.target.value)}
              placeholder="FM1...."
            />
            <button type="submit" className="btn-primary">
              Зарегистрировать
            </button>
          </form>
        )}

        <p className="mt-10 text-center text-sm text-slate-500">
          <Link to="/" className="text-sky-300 hover:underline">
            ← На сайт
          </Link>
        </p>
      </main>

      {showProvision && (
        <Modal title="Новая облачная установка" onClose={() => setShowProvision(false)}>
          <form onSubmit={handleProvision} className="space-y-4">
            <PlanFormFields
              genPlan={genPlan}
              setGenPlan={setGenPlan}
              genCustomer={genCustomer}
              setGenCustomer={setGenCustomer}
              genInstallationId={genInstallationId}
              setGenInstallationId={setGenInstallationId}
              genMaxUsers={genMaxUsers}
              setGenMaxUsers={setGenMaxUsers}
            />
            <button type="submit" className="btn-primary w-full">
              Зарегистрировать
            </button>
          </form>
        </Modal>
      )}

      {showGenerate && (
        <Modal title="Новый FM1-ключ" onClose={() => { setShowGenerate(false); setGeneratedKey(null); }}>
          {generatedKey ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Сохраните ключ — повторно не показывается.</p>
              <textarea readOnly className="input min-h-[100px] font-mono text-xs" value={generatedKey} />
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(generatedKey);
                  setMessage("Скопировано");
                }}
              >
                Копировать
              </button>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <PlanFormFields
                genPlan={genPlan}
                setGenPlan={setGenPlan}
                genCustomer={genCustomer}
                setGenCustomer={setGenCustomer}
                genInstallationId={genInstallationId}
                setGenInstallationId={setGenInstallationId}
                genMaxUsers={genMaxUsers}
                setGenMaxUsers={setGenMaxUsers}
              />
              <button type="submit" className="btn-primary w-full">
                Создать ключ
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({
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
      <div className="card w-full max-w-lg p-6">
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

function PlanFormFields(props: {
  genPlan: LicensePlan;
  setGenPlan: (p: LicensePlan) => void;
  genCustomer: string;
  setGenCustomer: (v: string) => void;
  genInstallationId: string;
  setGenInstallationId: (v: string) => void;
  genMaxUsers: string;
  setGenMaxUsers: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label className="mb-1 block text-sm text-slate-400">Тариф</label>
        <select
          className="input"
          value={props.genPlan}
          onChange={(e) => props.setGenPlan(e.target.value as LicensePlan)}
        >
          {LICENSE_PLANS.map((p) => (
            <option key={p} value={p}>
              {PLAN_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-400">Заказчик</label>
        <input
          className="input"
          value={props.genCustomer}
          onChange={(e) => props.setGenCustomer(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-400">Installation ID</label>
        <input
          className="input font-mono text-sm"
          required
          value={props.genInstallationId}
          onChange={(e) => props.setGenInstallationId(e.target.value)}
          placeholder="uuid"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-400">Лимит пользователей</label>
        <input
          className="input"
          type="number"
          min={1}
          value={props.genMaxUsers}
          onChange={(e) => props.setGenMaxUsers(e.target.value)}
          placeholder="По умолчанию из тарифа"
        />
      </div>
    </>
  );
}
