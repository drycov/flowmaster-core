import { AdminAlerts, AdminPageHeader, StatusBadge } from "../../components/admin/admin-ui";
import { useAdminWorkspace } from "../../hooks/useAdminWorkspace";

export function AdminActivationsPage() {
  const { loading, activations } = useAdminWorkspace();

  return (
    <>
      <AdminPageHeader
        title="Активации"
        description="Phone-home от EDMS — телеметрия и последний контакт"
      />
      <AdminAlerts />
      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Заказчик</th>
                <th className="p-3">Installation ID</th>
                <th className="p-3">Пользователи</th>
                <th className="p-3">Документы</th>
                <th className="p-3">Версия</th>
                <th className="p-3">Хост</th>
                <th className="p-3">Последний контакт</th>
                <th className="p-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {activations.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="p-3">{row.customer_name || "—"}</td>
                  <td className="p-3 font-mono text-xs">{row.installation_id}</td>
                  <td className="p-3 tabular-nums">
                    {row.total_users > 0 || row.active_users > 0
                      ? `${row.active_users} / ${row.total_users || "?"}`
                      : "—"}
                  </td>
                  <td className="p-3 tabular-nums">{row.documents_total || "—"}</td>
                  <td className="p-3 text-xs text-slate-400">{row.app_version || "—"}</td>
                  <td className="p-3 max-w-[160px] truncate text-slate-400">{row.hostname || "—"}</td>
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
    </>
  );
}
