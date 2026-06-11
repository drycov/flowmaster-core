import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { COMPANY } from "../lib/company";
import { adminLogin } from "../lib/admin-api";
import { useAdminSession } from "../hooks/useAdminSession";

export function AdminLoginPage() {
  const { session, loading, refresh } = useAdminSession();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session?.authenticated) {
    return <Navigate to="/admin/app" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await adminLogin(code.replace(/\s/g, ""));
      await refresh();
      navigate("/admin/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/30 to-violet-500/20 text-xl font-bold text-sky-200">
            Z
          </span>
          <p className="mt-4 text-xs uppercase tracking-widest text-sky-400">{COMPANY.brand}</p>
          <h1 className="mt-2 text-2xl font-bold">Админка сотрудника</h1>
          <p className="mt-2 text-sm text-slate-400">
            Управление лицензиями, клиентами и установками {COMPANY.product}. Вход по support code
            (15 мин) — секрет не вводится в браузер.
          </p>
        </div>

        {!loading && session && !session.configured ? (
          <div className="card border-amber-500/30 p-5 text-sm text-amber-200">
            <code className="text-amber-100">LICENSE_SERVER_ADMIN_SECRET</code> не задан на сервере.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Support code</label>
              <input
                className="input text-center font-mono text-lg tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
                maxLength={8}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </div>
            <p className="text-xs text-slate-500">
              Получите код: <code className="text-slate-400">npm run support-code</code>
            </p>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting || code.length < 8}
              className="btn-primary w-full"
            >
              {submitting ? "Проверка…" : "Войти в админку"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link to="/" className="text-sky-300 hover:underline">
            ← На сайт
          </Link>
        </p>
      </div>
    </div>
  );
}
