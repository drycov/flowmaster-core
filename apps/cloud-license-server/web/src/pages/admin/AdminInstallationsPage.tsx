import { FormEvent, useState } from "react";
import {
  AdminAlerts,
  AdminPageHeader,
  Modal,
  StatusBadge,
} from "../../components/admin/admin-ui";
import { PlanFormFields } from "../../components/admin/PlanFormFields";
import { useAdminWorkspace } from "../../hooks/useAdminWorkspace";
import type { LicensePlan } from "../../lib/admin-api";

export function AdminInstallationsPage() {
  const { loading, provisions, createProvision, revokeInstallation, setError } = useAdminWorkspace();
  const [showModal, setShowModal] = useState(false);
  const [genPlan, setGenPlan] = useState<LicensePlan>("professional");
  const [genCustomer, setGenCustomer] = useState("");
  const [genInstallationId, setGenInstallationId] = useState("");
  const [genMaxUsers, setGenMaxUsers] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createProvision({
        installation_id: genInstallationId.trim(),
        plan: genPlan,
        customer_name: genCustomer.trim(),
        max_users: genMaxUsers ? Number.parseInt(genMaxUsers, 10) : undefined,
      });
      setShowModal(false);
      setGenCustomer("");
      setGenInstallationId("");
      setGenMaxUsers("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm(`Отозвать установку ${id}?`)) return;
    try {
      await revokeInstallation(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Установки"
        description="Облачные provision — связка installation_id с тарифом"
        actions={
          <button type="button" onClick={() => setShowModal(true)} className="btn-primary text-sm">
            + Новая установка
          </button>
        }
      />
      <AdminAlerts />
      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Заказчик</th>
                <th className="p-3">Email кабинета</th>
                <th className="p-3">Installation ID</th>
                <th className="p-3">Тариф</th>
                <th className="p-3">Польз.</th>
                <th className="p-3">Документы</th>
                <th className="p-3">Контакт</th>
                <th className="p-3">Срок</th>
                <th className="p-3">Статус</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {provisions.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="p-3">{row.customer_name || "—"}</td>
                  <td className="p-3 text-slate-400">{row.account_email || "—"}</td>
                  <td className="p-3 font-mono text-xs">{row.installation_id}</td>
                  <td className="p-3">{row.plan_label}</td>
                  <td className="p-3 tabular-nums">
                    {row.active_users > 0 ? `${row.active_users}/${row.max_users}` : row.max_users}
                  </td>
                  <td className="p-3 tabular-nums">{row.documents_total || "—"}</td>
                  <td className="p-3 text-xs text-slate-400">
                    {row.last_seen_at
                      ? new Date(row.last_seen_at).toLocaleString("ru-RU")
                      : "Не подключалась"}
                  </td>
                  <td className="p-3 text-slate-400">
                    {row.expires_at ? (
                      <span className={row.days_until_expiry !== null && row.days_until_expiry <= 7 ? "text-amber-300" : ""}>
                        {new Date(row.expires_at).toLocaleDateString("ru-RU")}
                        {row.days_until_expiry !== null ? ` (${row.days_until_expiry} д.)` : ""}
                      </span>
                    ) : (
                      "∞"
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="p-3">
                    {row.status === "active" ? (
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => void handleRevoke(row.installation_id)}
                      >
                        Отозвать
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal ? (
        <Modal title="Новая облачная установка" onClose={() => setShowModal(false)}>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
      ) : null}
    </>
  );
}
