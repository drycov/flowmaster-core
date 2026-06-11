import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PricingSection } from "../components/PricingSection";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { fetchPlans, type PublicPlan } from "../lib/api";
import { COMPANY, salesContactHref } from "../lib/company";

const FEATURES = [
  {
    title: "Маршруты согласования",
    text: "Настраиваемые процессы согласования, замещения и контроль сроков.",
  },
  {
    title: "ЭЦП и юридическая значимость",
    text: "Подписание документов электронной цифровой подписью в контуре системы.",
  },
  {
    title: "ONLYOFFICE",
    text: "Редактирование офисных документов без выгрузки из СЭД.",
  },
  {
    title: "Архив и номенклатура",
    text: "Хранение, поиск и учёт документов по установленным правилам.",
  },
  {
    title: "Кадры и корреспонденция",
    text: "HR-модули, входящая/исходящая корреспонденция, контрагенты.",
  },
  {
    title: "Облачная лицензия",
    text: "Автоподключение установки по ID — лицензия сохраняется при потере связи с облаком.",
  },
];

export function LandingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-sky-300/80">
            {COMPANY.brand} · {COMPANY.product} · {COMPANY.country}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {COMPANY.product} — документооборот для вашей организации в{" "}
            <span className="gradient-text">одной системе</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Корпоративная платформа от {COMPANY.legalName}: согласования, ЭЦП, архив, кадры и
            отчёты. Развёртывание on-premise — данные остаются у вас, лицензия управляется через
            облако {COMPANY.brand}.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/register" className="btn-primary px-6 py-3 text-base">
              Начать бесплатный период
            </Link>
            <a href={`tel:${COMPANY.phoneTel}`} className="btn-secondary px-6 py-3 text-base">
              {COMPANY.phone}
            </a>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              ["30 дней", "пробный доступ ко всем модулям"],
              ["On-prem", "данные на ваших серверах"],
              ["Offline", "лицензия при потере связи"],
            ].map(([a, b]) => (
              <div key={a} className="card p-5">
                <p className="text-2xl font-bold text-sky-300">{a}</p>
                <p className="mt-1 text-sm text-slate-400">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="border-t border-white/10 bg-slate-900/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className="text-3xl font-bold">О {COMPANY.brand}</h2>
              <p className="mt-4 leading-relaxed text-slate-300">
                {COMPANY.legalName} ({COMPANY.owner}) — казахстанский разработчик программного
                обеспечения. Основной вид деятельности по ОКЭД {COMPANY.primaryOked.code}:{" "}
                {COMPANY.primaryOked.name.toLowerCase()}.
              </p>
              <p className="mt-4 leading-relaxed text-slate-400">
                Мы создаём и сопровождаем {COMPANY.product} — систему электронного документооборота
                для государственных и коммерческих организаций. Внедрение, настройка маршрутов,
                интеграция с ЭЦП и сопровождение на всей территории {COMPANY.country}.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                {COMPANY.activities.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-sky-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold text-white">Юридическая информация</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                  <dt className="text-slate-500">Наименование</dt>
                  <dd className="text-right text-slate-200">{COMPANY.legalName}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                  <dt className="text-slate-500">ИИН</dt>
                  <dd className="font-mono text-slate-200">{COMPANY.iin}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                  <dt className="text-slate-500">Регистрация ИП</dt>
                  <dd className="text-slate-200">{COMPANY.ipRegisteredAt}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                  <dt className="text-slate-500">ОКЭД</dt>
                  <dd className="text-right text-slate-200">
                    {COMPANY.primaryOked.code}
                    <span className="block text-xs text-slate-500">{COMPANY.primaryOked.name}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Адрес</dt>
                  <dd className="mt-1 text-slate-300">{COMPANY.addressFull}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold">Возможности {COMPANY.product}</h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            Модульная архитектура — подключайте только нужные блоки в зависимости от тарифа.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="card p-5">
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {plans.length > 0 ? <PricingSection plans={plans} /> : null}

      <section id="contact" className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">Связаться с нами</h2>
              <p className="mt-4 text-slate-400">
                Консультация по внедрению, демонстрация системы и коммерческое предложение — по
                телефону или через регистрацию пробного доступа.
              </p>
              <div className="mt-8 space-y-4">
                <a
                  href={`tel:${COMPANY.phoneTel}`}
                  className="card flex items-center gap-4 p-5 transition hover:border-sky-400/30"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                    ☎
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Телефон</p>
                    <p className="text-lg font-semibold">{COMPANY.phone}</p>
                  </div>
                </a>
                {COMPANY.email ? (
                  <a
                    href={`mailto:${COMPANY.email}`}
                    className="card flex items-center gap-4 p-5 transition hover:border-sky-400/30"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                      ✉
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                      <p className="text-lg font-semibold">{COMPANY.email}</p>
                    </div>
                  </a>
                ) : null}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold">Быстрый старт</h3>
              <p className="mt-2 text-sm text-slate-400">
                Зарегистрируйтесь — получите installation_id и подключите установку {COMPANY.product}{" "}
                к облаку лицензирования {COMPANY.brand} за несколько минут.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link to="/register" className="btn-primary text-center">
                  Создать аккаунт
                </Link>
                <a
                  href={salesContactHref("Запрос на внедрение ЕСЭДО")}
                  className="btn-secondary text-center"
                >
                  Запросить консультацию
                </a>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                {COMPANY.city}, {COMPANY.region}, {COMPANY.country}
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
