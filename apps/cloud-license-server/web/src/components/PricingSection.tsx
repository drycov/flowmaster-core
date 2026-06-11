import { Link } from "react-router-dom";
import { salesContactHref } from "../lib/company";
import type { PublicPlan } from "../lib/api";

export function PricingSection({ plans }: { plans: PublicPlan[] }) {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Тарифные планы</h2>
        <p className="mt-3 text-slate-400">
          Облачная лицензия подключается автоматически — без ввода ключей на стороне клиента.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <article
            key={plan.plan}
            className={`card flex flex-col p-6 ${plan.highlight ? "border-sky-400/40 ring-1 ring-sky-400/20" : ""}`}
          >
            {plan.highlight ? (
              <span className="mb-3 inline-flex w-fit rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-200">
                Рекомендуем
              </span>
            ) : null}
            <h3 className="text-xl font-semibold">{plan.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{plan.subtitle}</p>
            <p className="mt-5 text-3xl font-bold">{plan.priceLabel}</p>
            <p className="mt-1 text-sm text-slate-400">до {plan.max_users} пользователей</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-300">
              {plan.features.slice(0, 6).map((f) => (
                <li key={f.key} className="flex gap-2">
                  <span className="text-sky-400">✓</span>
                  <span>{f.label}</span>
                </li>
              ))}
              {plan.features.length > 6 ? (
                <li className="text-slate-500">+ ещё {plan.features.length - 6} модулей</li>
              ) : null}
            </ul>
            <div className="mt-6">
              {plan.plan === "trial" ? (
                <Link to="/register" className="btn-primary w-full">
                  {plan.cta}
                </Link>
              ) : (
                <a
                  href={salesContactHref(`Тариф ${plan.title} — ЕСЭДО`)}
                  className="btn-secondary w-full"
                >
                  {plan.cta}
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
