import { Link } from "react-router-dom";
import { salesContactHref, type PortalInstallationTariff } from "../lib/api";
import { formatKzt } from "../lib/pricing-calculator";

function daysLabel(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return `${days} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${days} дня`;
  return `${days} дней`;
}

export function TariffSummary({
  tariff,
  planCode,
  maxUsers,
}: {
  tariff: PortalInstallationTariff;
  planCode: string | null;
  maxUsers: number | null;
}) {
  const visibleFeatures = tariff.features.slice(0, 8);
  const hiddenCount = tariff.features.length - visibleFeatures.length;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Тариф</p>
          <h4 className="mt-1 text-lg font-semibold">{tariff.title}</h4>
          <p className="mt-0.5 text-sm text-slate-400">{tariff.subtitle}</p>
        </div>
        {tariff.is_trial ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
            Пробный период
          </span>
        ) : (
          <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-200">
            {tariff.price_label}
          </span>
        )}
      </div>

      {tariff.days_remaining !== null ? (
        <p
          className={`mt-4 text-sm ${
            tariff.days_remaining <= 7 ? "text-amber-300" : "text-slate-300"
          }`}
        >
          {tariff.days_remaining === 0
            ? "Срок лицензии истекает сегодня"
            : `Осталось ${daysLabel(tariff.days_remaining)}`}
        </p>
      ) : null}

      {tariff.is_trial ? (
        <p className="mt-2 text-2xl font-bold">Бесплатно</p>
      ) : tariff.pricing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-slate-500">Ориентир / месяц</p>
            <p className="mt-1 text-lg font-semibold">
              {tariff.pricing.custom_quote ? "от " : ""}
              {formatKzt(tariff.pricing.monthly, tariff.pricing.currency_label)}
            </p>
            {tariff.pricing.extra_users > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                incl. +{tariff.pricing.extra_users} доп. пользов.
              </p>
            ) : null}
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-slate-500">
              При оплате за год ({tariff.pricing.yearly_months_paid} мес.)
            </p>
            <p className="mt-1 text-lg font-semibold">
              {tariff.pricing.custom_quote ? "от " : ""}
              {formatKzt(tariff.pricing.yearly_total, tariff.pricing.currency_label)}
            </p>
          </div>
        </div>
      ) : null}

      {maxUsers ? (
        <p className="mt-4 text-sm text-slate-400">
          Лимит: <span className="text-slate-200">до {maxUsers} пользователей</span>
        </p>
      ) : null}

      {visibleFeatures.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Включённые модули</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {visibleFeatures.map((f) => (
              <li key={f.key} className="flex gap-2 text-sm text-slate-300">
                <span className="text-sky-400">✓</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <p className="mt-2 text-xs text-slate-500">+ ещё {hiddenCount} модулей</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {tariff.is_trial ? (
          <a
            href={salesContactHref(`Переход с пробного тарифа (${planCode ?? "trial"}) — ЕСЭДО`)}
            className="btn-primary text-sm"
          >
            Перейти на платный тариф
          </a>
        ) : (
          <a
            href={salesContactHref(`Смена тарифа ${tariff.title} — ЕСЭДО`)}
            className="btn-secondary text-sm"
          >
            Изменить тариф
          </a>
        )}
        <Link to="/#calculator" className="btn-secondary text-sm">
          Калькулятор
        </Link>
      </div>
    </div>
  );
}
