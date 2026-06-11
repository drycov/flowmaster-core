import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { TariffSummary } from "../components/TariffSummary";
import { UsageTelemetrySummary } from "../components/UsageTelemetrySummary";
import { useAuth } from "../hooks/useAuth";
import { fetchPortalMe, salesContactHref, type PortalInstallation, type PortalMe } from "../lib/api";
import { getAccessToken } from "../lib/supabase";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex gap-2">
        <code className="input flex-1 font-mono text-xs">{value}</code>
        <button
          type="button"
          className="btn-secondary shrink-0 px-3"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function InstallationCard({ item, licenseServerUrl }: { item: PortalInstallation; licenseServerUrl: string }) {
  const statusTone =
    item.status === "active"
      ? "text-emerald-400"
      : item.status === "revoked"
        ? "text-red-400"
        : "text-amber-400";

  const statusLabel =
    item.status === "active"
      ? "Активна"
      : item.status === "revoked"
        ? "Отозвана"
        : item.status === "suspended"
          ? "Приостановлена"
          : item.status;

  return (
    <article className="card space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{item.customer_name || "Установка"}</h3>
          <p className={`mt-1 text-sm ${statusTone}`}>{statusLabel}</p>
        </div>
      </div>

      {item.tariff ? (
        <TariffSummary tariff={item.tariff} planCode={item.plan} maxUsers={item.max_users} />
      ) : null}

      {item.telemetry ? <UsageTelemetrySummary telemetry={item.telemetry} /> : null}

      <CopyField label="Installation ID" value={item.installation_id} />
      <CopyField label="LICENSE_SERVER_URL" value={licenseServerUrl} />

      <div className="rounded-xl bg-black/20 p-4 text-sm text-slate-300">
        <p className="font-medium text-white">Подключение EDMS</p>
        <p className="mt-2 leading-relaxed text-slate-400">
          Добавьте в <code className="text-sky-300">.env</code> клиентской установки:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-slate-300">
          {`INSTALLATION_ID=${item.installation_id}\nLICENSE_SERVER_URL=${licenseServerUrl}`}
        </pre>
        <p className="mt-3 text-xs text-slate-500">
          Лицензия подключится автоматически — ключ FM1 вводить не нужно.
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Действует до</dt>
          <dd className="mt-0.5">
            {item.expires_at
              ? new Date(item.expires_at).toLocaleDateString("ru-RU")
              : "Бессрочно"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Последний контакт</dt>
          <dd className="mt-0.5">
            {item.last_seen_at
              ? new Date(item.last_seen_at).toLocaleString("ru-RU")
              : "Ещё не подключалась"}
          </dd>
        </div>
        {item.hostname ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Хост установки</dt>
            <dd className="mt-0.5 truncate">{item.hostname}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export function CabinetPage() {
  const { session, supabase } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PortalMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const licenseServerUrl =
    import.meta.env.VITE_LICENSE_SERVER_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        navigate("/login");
        return;
      }
      try {
        const me = await fetchPortalMe(token);
        if (!me.account) {
          navigate("/onboarding");
          return;
        }
        setData(me);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function logout() {
    await supabase?.auth.signOut();
    navigate("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Загрузка кабинета…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Личный кабинет</h1>
            <p className="mt-1 text-slate-400">{data?.account?.company_name}</p>
            <p className="text-sm text-slate-500">{session?.user.email}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="btn-secondary">
            Выйти
          </button>
        </div>

        {error ? <p className="mt-6 text-red-400">{error}</p> : null}

        <div className="mt-10 space-y-6">
          {(data?.installations ?? []).map((item) => (
            <InstallationCard key={item.installation_id} item={item} licenseServerUrl={licenseServerUrl} />
          ))}
        </div>

        <div className="card mt-10 p-6">
          <h2 className="font-semibold">Нужен другой тариф?</h2>
          <p className="mt-2 text-sm text-slate-400">
            Сравните планы в калькуляторе или напишите в отдел продаж — поможем подобрать Standard,
            Professional или Enterprise.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/#calculator" className="btn-primary">
              Калькулятор тарифов
            </Link>
            <a href={salesContactHref("Смена тарифа ЕСЭДО")} className="btn-secondary">
              Написать в продажи
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link to="/" className="text-sky-300 hover:underline">
            ← На главную
          </Link>
        </p>
      </div>
    </div>
  );
}
