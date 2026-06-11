import { COMPANY } from "../lib/company";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-lg font-semibold text-white">
              {COMPANY.brand} · {COMPANY.product}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{COMPANY.productFull}</p>
            <p className="mt-4 text-xs text-slate-500">
              Разработчик: {COMPANY.legalName}
              <br />
              {COMPANY.owner}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Контакты</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>
                <a href={`tel:${COMPANY.phoneTel}`} className="hover:text-sky-300">
                  {COMPANY.phone}
                </a>
              </li>
              {COMPANY.email ? (
                <li>
                  <a href={`mailto:${COMPANY.email}`} className="hover:text-sky-300">
                    {COMPANY.email}
                  </a>
                </li>
              ) : null}
              <li className="text-slate-400">{COMPANY.addressShort}</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Реквизиты</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-400">
              <li>ИИН {COMPANY.iin}</li>
              <li>ИП с {COMPANY.ipRegisteredAt}</li>
              <li>
                ОКЭД {COMPANY.primaryOked.code} — {COMPANY.primaryOked.name}
              </li>
              <li>
                {COMPANY.city}, {COMPANY.region}
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} {COMPANY.brand}. {COMPANY.product} — корпоративный
          документооборот для организаций Казахстана.
        </p>
      </div>
    </footer>
  );
}
