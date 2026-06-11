import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { bootstrapPortal, fetchPortalMe } from "../lib/api";
import { getAccessToken } from "../lib/supabase";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("portal_company_name") ?? "";
    if (stored) setCompany(stored);

    (async () => {
      const token = await getAccessToken();
      if (!token) {
        navigate("/login");
        return;
      }
      try {
        const me = await fetchPortalMe(token);
        if (me.account) {
          navigate("/cabinet");
          return;
        }
      } catch {
        /* new user */
      }
      setLoading(false);
    })();
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = await getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await bootstrapPortal(token, company);
      sessionStorage.removeItem("portal_company_name");
      navigate("/cabinet");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-bold">Настройка организации</h1>
        <p className="mt-2 text-sm text-slate-400">
          Создадим пробную лицензию и уникальный installation_id для вашей установки ЕСЭДО.
        </p>
        <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Название организации</label>
            <input
              className="input"
              required
              minLength={2}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Создание лицензии…" : "Активировать пробный период"}
          </button>
        </form>
      </div>
    </div>
  );
}
