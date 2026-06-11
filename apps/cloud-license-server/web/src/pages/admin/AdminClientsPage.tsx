import { AdminAlerts, AdminPageHeader } from "../../components/admin/admin-ui";
import { useAdminWorkspace } from "../../hooks/useAdminWorkspace";

export function AdminClientsPage() {
  const { loading, clients } = useAdminWorkspace();

  return (
    <>
      <AdminPageHeader
        title="Клиенты"
        description="Аккаунты личного кабинета (регистрация на сайте)"
      />
      <AdminAlerts />
      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Компания</th>
                <th className="p-3">Email</th>
                <th className="p-3">Установок</th>
                <th className="p-3">Регистрация</th>
                <th className="p-3">Installation IDs</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="p-3 font-medium">{row.company_name || "—"}</td>
                  <td className="p-3">{row.email}</td>
                  <td className="p-3 tabular-nums">{row.installations_count}</td>
                  <td className="p-3 text-slate-400">
                    {new Date(row.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-400">
                    {row.installation_ids.length
                      ? row.installation_ids.map((id) => id.slice(0, 8)).join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
              {!clients.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Нет зарегистрированных клиентов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
