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

export function AdminKeysPage() {
  const { loading, keys, createKey, setError, setMessage } = useAdminWorkspace();
  const [showModal, setShowModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [genPlan, setGenPlan] = useState<LicensePlan>("professional");
  const [genCustomer, setGenCustomer] = useState("");
  const [genInstallationId, setGenInstallationId] = useState("");
  const [genMaxUsers, setGenMaxUsers] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const key = await createKey({
        installation_id: genInstallationId.trim(),
        plan: genPlan,
        customer: genCustomer.trim(),
        max_users: genMaxUsers ? Number.parseInt(genMaxUsers, 10) : undefined,
      });
      setGeneratedKey(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Ключи FM1"
        description="Legacy-ключи для offline / гибридных сценариев"
        actions={
          <button type="button" onClick={() => setShowModal(true)} className="btn-primary text-sm">
            + Создать FM1
          </button>
        }
      />
      <AdminAlerts />
      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : (
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
      )}

      {showModal ? (
        <Modal
          title="Новый FM1-ключ"
          onClose={() => {
            setShowModal(false);
            setGeneratedKey(null);
          }}
        >
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
                Создать ключ
              </button>
            </form>
          )}
        </Modal>
      ) : null}
    </>
  );
}
