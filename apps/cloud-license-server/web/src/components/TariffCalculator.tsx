import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { salesContactHref } from "../lib/company";
import {
  fetchPricingConfig,
  fetchPricingQuote,
  formatKzt,
  type BillingPeriod,
  type PricingConfig,
  type PricingQuote,
} from "../lib/pricing-calculator";

export function TariffCalculator() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [users, setUsers] = useState(25);
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const [extended, setExtended] = useState(false);
  const [integrations, setIntegrations] = useState(false);
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPricingConfig().then(setConfig);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPricingQuote({ users, period, extended, integrations })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [users, period, extended, integrations]);

  const presets = useMemo(() => config?.user_presets ?? [5, 10, 25, 50, 100, 250, 500], [config]);

  const currencyLabel = config?.currency_label ?? "₸";

  return (
    <div id="calculator" className="card mb-10 overflow-hidden p-6 sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h3 className="text-xl font-semibold">Калькулятор тарифа</h3>
          <p className="mt-2 text-sm text-slate-400">
            Подберите план по числу пользователей и опциям. Стоимость ориентировочная — итоговое КП
            уточняется при внедрении.
          </p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="users-range">Пользователей</label>
              <span className="font-mono font-semibold text-sky-300">{users}</span>
            </div>
            <input
              id="users-range"
              type="range"
              min={1}
              max={500}
              step={1}
              value={Math.min(users, 500)}
              onChange={(e) => setUsers(Number(e.target.value))}
              className="mt-2 w-full accent-sky-400"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setUsers(n)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    users === n
                      ? "bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/40"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUsers(750)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  users > 500
                    ? "bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                500+
              </button>
            </div>
            {users > 500 ? (
              <input
                type="number"
                min={501}
                max={9999}
                value={users}
                onChange={(e) => setUsers(Number(e.target.value) || 501)}
                className="input mt-3 max-w-[140px]"
              />
            ) : null}
          </div>

          <div className="mt-6 flex gap-2">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none sm:px-6 ${
                  period === p
                    ? "bg-sky-500 text-white"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {p === "monthly" ? "Помесячно" : "Ежегодно"}
              </button>
            ))}
          </div>
          {period === "yearly" && config ? (
            <p className="mt-2 text-xs text-emerald-400/90">
              Оплата за {config.yearly_months_paid} месяцев — {12 - config.yearly_months_paid} месяца
              в подарок
            </p>
          ) : null}

          <div className="mt-6 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/15">
              <input
                type="checkbox"
                checked={extended}
                onChange={(e) => setExtended(e.target.checked)}
                className="mt-0.5 accent-sky-400"
              />
              <span>
                <span className="block text-sm font-medium">Расширенный пакет</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  HR, ONLYOFFICE, отчёты, проекты, база знаний — тариф Professional и выше
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/15">
              <input
                type="checkbox"
                checked={integrations}
                onChange={(e) => setIntegrations(e.target.checked)}
                className="mt-0.5 accent-sky-400"
              />
              <span>
                <span className="block text-sm font-medium">Интеграции и мониторинг</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  API, webhooks, внешние системы — тариф Enterprise
                </span>
              </span>
            </label>
          </div>
        </div>

        <aside className="flex flex-col rounded-2xl border border-sky-400/20 bg-gradient-to-b from-sky-500/10 to-transparent p-6">
          {loading || !quote ? (
            <p className="text-sm text-slate-400">Расчёт…</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-500">Рекомендуемый тариф</p>
              <p className="mt-1 text-2xl font-bold">{quote.plan_label}</p>
              {quote.trial_eligible && quote.plan === "trial" ? (
                <p className="mt-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
                  Доступен бесплатный пробный период 30 дней
                </p>
              ) : null}

              <div className="mt-6 border-t border-white/10 pt-6">
                {quote.plan === "trial" ? (
                  <p className="text-3xl font-bold">Бесплатно</p>
                ) : quote.custom_quote ? (
                  <>
                    <p className="text-lg font-semibold text-slate-200">Индивидуальный расчёт</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Ориентир для {quote.users} польз.:
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      от {formatKzt(quote.monthly, currencyLabel)}
                      <span className="text-base font-normal text-slate-400"> / мес</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold">
                      {formatKzt(period === "yearly" ? quote.total : quote.monthly, currencyLabel)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {period === "yearly"
                        ? `за год (${quote.monthly.toLocaleString("ru-KZ")} ${currencyLabel}/мес)`
                        : "в месяц"}
                    </p>
                    {quote.savings_yearly > 0 ? (
                      <p className="mt-2 text-xs text-emerald-400">
                        Экономия {formatKzt(quote.savings_yearly, currencyLabel)} в год
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {quote.plan !== "trial" && quote.breakdown.base > 0 ? (
                <ul className="mt-4 space-y-1.5 text-xs text-slate-400">
                  <li className="flex justify-between gap-2">
                    <span>Базовый тариф</span>
                    <span>{formatKzt(quote.breakdown.base, currencyLabel)}</span>
                  </li>
                  {quote.extra_users > 0 ? (
                    <li className="flex justify-between gap-2">
                      <span>+{quote.extra_users} доп. пользов.</span>
                      <span>{formatKzt(quote.breakdown.extra, currencyLabel)}</span>
                    </li>
                  ) : null}
                </ul>
              ) : null}

              <div className="mt-auto flex flex-col gap-2 pt-6">
                {quote.trial_eligible && quote.plan === "trial" ? (
                  <Link to="/register" className="btn-primary text-center">
                    Начать пробный период
                  </Link>
                ) : (
                  <a
                    href={salesContactHref(
                      `КП ${quote.plan_label}, ${quote.users} польз. — ЕСЭДО`,
                    )}
                    className="btn-primary text-center"
                  >
                    Запросить коммерческое
                  </a>
                )}
                {quote.plan !== "trial" ? (
                  <Link to="/register" className="btn-secondary text-center text-xs">
                    Сначала попробовать бесплатно
                  </Link>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
