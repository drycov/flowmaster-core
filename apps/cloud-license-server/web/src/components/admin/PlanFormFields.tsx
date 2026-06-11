import { LICENSE_PLANS, PLAN_LABELS, type LicensePlan } from "../../lib/admin-api";

export function PlanFormFields(props: {
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
