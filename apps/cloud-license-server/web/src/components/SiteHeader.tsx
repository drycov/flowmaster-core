import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { COMPANY } from "../lib/company";

export function SiteHeader() {
  const { session } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2.5 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/30 to-violet-500/20 text-sm font-bold text-sky-200">
            Z
          </span>
          <span className="leading-tight">
            <span className="block text-[15px]">{COMPANY.brand}</span>
            <span className="block text-xs font-normal text-slate-400">{COMPANY.product}</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <a href="/#about" className="hidden text-slate-300 hover:text-white md:inline">
            О нас
          </a>
          <a href="/#features" className="hidden text-slate-300 hover:text-white sm:inline">
            Возможности
          </a>
          <a href="/#pricing" className="hidden text-slate-300 hover:text-white sm:inline">
            Тарифы
          </a>
          <a href="/#calculator" className="hidden text-slate-300 hover:text-white lg:inline">
            Калькулятор
          </a>
          <a href="/#contact" className="hidden text-slate-300 hover:text-white md:inline">
            Контакты
          </a>
          {session ? (
            <Link to="/cabinet" className="btn-primary">
              Кабинет
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-secondary hidden sm:inline-flex">
                Вход
              </Link>
              <Link to="/register" className="btn-primary">
                Попробовать
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
