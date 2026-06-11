import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { adminLogin } from "../lib/admin-api";
import { useAdminSession } from "../hooks/useAdminSession";

export function AdminLoginPage() {
  const { session, loading, refresh } = useAdminSession();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session?.authenticated) {
    return <Navigate to="/admin/console" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await adminLogin(code.replace(/\s/g, ""));
      await refresh();
      navigate("/admin/console");
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
          <p className="text-xs uppercase tracking-widest text-sky-400">Vendor</p>
          <h1 className="mt-2 text-2xl font-bold">Админка License Server</h1>
          <p className="mt-2 text-sm text-slate-400">
            Вход по одноразовому support code (15 мин). Секрет не вводится в браузер.
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
              Получите код:{" "}
              <code className="text-slate-400">npm run support-code</code> (локально с тем же
              секретом)
            </p>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button type="submit" disabled={submitting || code.length < 8} className="btn-primary w-full">
              {submitting ? "Проверка…" : "Войти"}
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
