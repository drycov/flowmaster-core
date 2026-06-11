import { FormEvent, useState } from "react";
import { AdminAlerts, AdminPageHeader } from "../../components/admin/admin-ui";
import { useAdminWorkspace } from "../../hooks/useAdminWorkspace";

export function AdminToolsPage() {
  const { registerFm1Key, setError } = useAdminWorkspace();
  const [registerKeyVal, setRegisterKeyVal] = useState("");

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    try {
      await registerFm1Key(registerKeyVal.trim());
      setRegisterKeyVal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Инструменты"
        description="Pre-register существующего FM1 и служебные операции"
      />
      <AdminAlerts />

      <form onSubmit={(e) => void handleRegister(e)} className="card max-w-xl space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Регистрация FM1-ключа</h2>
          <p className="mt-1 text-sm text-slate-400">
            Добавить уже сгенерированный ключ в реестр license server
          </p>
        </div>
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          value={registerKeyVal}
          onChange={(e) => setRegisterKeyVal(e.target.value)}
          placeholder="FM1...."
        />
        <button type="submit" className="btn-primary">
          Зарегистрировать
        </button>
      </form>

      <div className="card mt-6 max-w-xl p-6 text-sm text-slate-400">
        <h2 className="font-semibold text-white">Support code для входа</h2>
        <p className="mt-2 leading-relaxed">
          На машине с <code className="text-sky-300">LICENSE_SERVER_ADMIN_SECRET</code>:
        </p>
        <pre className="mt-3 rounded-lg bg-black/30 p-3 text-xs text-slate-300">
          npm run support-code
        </pre>
        <p className="mt-3">Код действует 15 минут. Сессия в браузере — 4 часа.</p>
      </div>
    </>
  );
}
