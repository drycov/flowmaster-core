import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../hooks/useAuth";

export function RegisterPage() {
  const { session, supabase } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/cabinet" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase не настроен (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
      return;
    }
    setLoading(true);
    setError("");
    const { error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { company_name: company } },
    });
    setLoading(false);
    if (signErr) {
      setError(signErr.message);
      return;
    }
    sessionStorage.setItem("portal_company_name", company);
    navigate("/onboarding");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-bold">Регистрация</h1>
        <p className="mt-2 text-sm text-slate-400">
          Пробный тариф на 30 дней — все модули, до 10 пользователей
        </p>
        <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Организация</label>
            <input
              className="input"
              required
              minLength={2}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="ТОО «Пример»"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Email</label>
            <input
              className="input"
              type="email"
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
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Создание…" : "Создать аккаунт"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="text-sky-300 hover:underline">
            Вход
          </Link>
        </p>
      </div>
    </div>
  );
}
