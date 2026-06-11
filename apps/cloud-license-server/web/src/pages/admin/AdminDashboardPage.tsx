import { Link } from "react-router-dom";
import { AdminAlerts, AdminPageHeader, StatCard, StatusBadge } from "../../components/admin/admin-ui";
import { useAdminWorkspace } from "../../hooks/useAdminWorkspace";

export function AdminDashboardPage() {
  const { loading, overview, provisions, clients, activations } = useAdminWorkspace();

  if (loading || !overview) {
    return <p className="text-slate-400">Загрузка…</p>;
  }

  const expiringTrials = provisions.filter(
    (p) => p.plan === "trial" && p.status === "active" && p.days_until_expiry !== null && p.days_until_expiry <= 7,
  );

  return (
    <>
      <AdminPageHeader
        title="Обзор"
        description="Облачный license server — лицензирование и установки клиентов"
      />
      <AdminAlerts />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Клиенты (кабинет)" value={overview.portal_clients_total} />
        <StatCard
          label="Установки"
          value={`${overview.provisions_active} / ${overview.provisions_total}`}
          tone="ok"
        />
        <StatCard
          label="Онлайн за 7 дней"
          value={overview.online_last_7d}
          hint="Активации с контактом"
        />
        <StatCard
          label="Trial истекает ≤7 дн."
          value={overview.trials_expiring_7d}
          tone={overview.trials_expiring_7d > 0 ? "warn" : undefined}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Пробные периоды скоро истекают</h2>
          <ul className="mt-4 space-y-3">
            {expiringTrials.slice(0, 5).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{row.customer_name || row.account_email || "—"}</p>
                  <p className="font-mono text-xs text-slate-500">{row.installation_id.slice(0, 8)}…</p>
                </div>
                <span className="text-amber-300">{row.days_until_expiry} дн.</span>
              </li>
            ))}
            {!expiringTrials.length ? (
              <li className="text-sm text-slate-500">Нет срочных trial</li>
            ) : null}
          </ul>
          <Link to="/admin/app/installations" className="mt-4 inline-block text-sm text-sky-300 hover:underline">
            Все установки →
          </Link>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Последние активации</h2>
          <ul className="mt-4 space-y-3">
            {activations.slice(0, 5).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{row.customer_name || "—"}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(row.last_seen_at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </li>
            ))}
            {!activations.length ? (
              <li className="text-sm text-slate-500">Нет активаций</li>
            ) : null}
          </ul>
          <Link to="/admin/app/activations" className="mt-4 inline-block text-sm text-sky-300 hover:underline">
            Все активации →
          </Link>
        </section>
      </div>

      <section className="card mt-8 p-5">
        <h2 className="font-semibold">Новые регистрации</h2>
        <ul className="mt-4 divide-y divide-white/5">
          {clients.slice(0, 5).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{c.company_name || c.email}</p>
                <p className="text-slate-500">{c.email}</p>
              </div>
              <p className="text-xs text-slate-500">
                {new Date(c.created_at).toLocaleDateString("ru-RU")} · {c.installations_count} уст.
              </p>
            </li>
          ))}
          {!clients.length ? <li className="py-3 text-sm text-slate-500">Пока нет клиентов</li> : null}
        </ul>
      </section>
    </>
  );
}
