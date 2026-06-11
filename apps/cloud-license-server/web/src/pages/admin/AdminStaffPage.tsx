import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminAlerts, AdminPageHeader } from "../../components/admin/admin-ui";
import {
  createVendorStaff,
  fetchAdminSession,
  fetchVendorStaff,
  updateVendorStaff,
  type VendorStaffRow,
  type VendorStaffRole,
} from "../../lib/admin-api";

const ROLES: VendorStaffRole[] = ["owner", "admin", "staff"];

export function AdminStaffPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<VendorStaffRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<VendorStaffRole>("staff");
  const [telegramChatId, setTelegramChatId] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [session, staff] = await Promise.all([fetchAdminSession(), fetchVendorStaff()]);
      const r = session.identity?.role;
      setCanManage(r === "owner" || r === "admin");
      setItems(staff.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createVendorStaff({
        email,
        password,
        full_name: fullName || undefined,
        role,
        telegram_chat_id: telegramChatId || undefined,
      });
      setMessage("Сотрудник создан");
      setShowCreate(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("staff");
      setTelegramChatId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(row: VendorStaffRow) {
    setBusy(true);
    setError("");
    try {
      await updateVendorStaff(row.id, {
        status: row.status === "active" ? "disabled" : "active",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Сотрудники вендора"
        description="Учётные записи Cloud Admin — отдельно от клиентов (/cabinet)"
      />
      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-emerald-400">{message}</p> : null}

      {canManage ? (
        <div className="mb-6">
          <button type="button" className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Отмена" : "Добавить сотрудника"}
          </button>
        </div>
      ) : null}

      {showCreate && canManage ? (
        <form onSubmit={(e) => void onCreate(e)} className="card mb-6 grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Email</label>
            <input className="input w-full" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Пароль</label>
            <input className="input w-full" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">ФИО</label>
            <input className="input w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Роль</label>
            <select className="input w-full" value={role} onChange={(e) => setRole(e.target.value as VendorStaffRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-slate-400">Telegram chat_id</label>
            <input className="input w-full font-mono" placeholder="8328036041" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Создание…" : "Создать"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-slate-400">Загрузка…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">ФИО</th>
                <th className="p-3">Email</th>
                <th className="p-3">Роль</th>
                <th className="p-3">Telegram</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Последний вход</th>
                {canManage ? <th className="p-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="p-3 font-medium">{row.full_name}</td>
                  <td className="p-3">{row.email}</td>
                  <td className="p-3">{row.role}</td>
                  <td className="p-3 font-mono text-xs text-slate-400">{row.telegram_chat_id || "—"}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3 text-slate-400">
                    {row.last_login_at ? new Date(row.last_login_at).toLocaleString("ru-RU") : "—"}
                  </td>
                  {canManage ? (
                    <td className="p-3">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busy}
                        onClick={() => void toggleStatus(row)}
                      >
                        {row.status === "active" ? "Отключить" : "Включить"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="p-8 text-center text-slate-500">
                    Нет сотрудников. Owner создаётся из LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS (пароль в Telegram).
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
