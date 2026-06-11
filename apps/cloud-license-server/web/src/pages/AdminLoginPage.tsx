import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { COMPANY } from "../lib/company";
import { fetchAdminSession } from "../lib/admin-api";
import { useAdminSession } from "../hooks/useAdminSession";
import { supabase } from "../lib/supabase";

export function AdminLoginPage() {
  const { session, loading, refresh } = useAdminSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session?.authenticated) {
    return <Navigate to="/admin/app" replace />;
  }

  if (!loading && session?.step === "verify") {
    return <Navigate to="/admin/verify" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase не настроен (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      await refresh();
      const next = await fetchAdminSession();
      if (!next.identity) {
        await supabase.auth.signOut();
        setError("Нет доступа к Cloud Admin. Аккаунт не в списке vendor admin.");
        return;
      }
      if (next.authenticated) {
        navigate("/admin/app");
      } else {
        navigate("/admin/verify");
      }
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
          <p className="mt-4 text-xs uppercase tracking-widest text-sky-400">Cloud Admin</p>
          <h1 className="mt-2 text-2xl font-bold">Админка облачного сервера</h1>
          <p className="mt-2 text-sm text-slate-400">
            Вход сотрудника вендора: email + пароль, затем подтверждение в <strong>боте вендора</strong>{" "}
            (Telegram) или webhook. Локальный сервер — <strong>Console</strong> (support code + SSH).
            Клиенты —{" "}
            <Link to="/cabinet" className="text-sky-300 hover:underline">/cabinet</Link>.
          </p>
        </div>

        {!loading && session && !session.configured ? (
          <div className="card border-amber-500/30 p-5 text-sm text-amber-200">
            Admin UI не настроен: таблица <code className="text-amber-100">vendor_staff</code> пуста.
            Задайте <code className="text-amber-100">LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS</code> и{" "}
            <code className="text-amber-100">VENDOR_TELEGRAM_BOT_TOKEN</code> — owner создастся автоматически,
            пароль придёт в Telegram. Или: <code className="text-amber-100">npm run vendor-staff:bootstrap</code>.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Email</label>
              <input
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">Пароль</label>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Вход…" : "Продолжить"}
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
