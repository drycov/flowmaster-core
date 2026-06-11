import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { COMPANY } from "../../lib/company";
import { adminLogout } from "../../lib/admin-api";
import { useAdminSession } from "../../hooks/useAdminSession";

const NAV: { to: string; end?: boolean; label: string; icon: string }[] = [
  { to: "/admin/app", end: true, label: "Обзор", icon: "◫" },
  { to: "/admin/app/clients", label: "Клиенты", icon: "◎" },
  { to: "/admin/app/installations", label: "Установки", icon: "⬡" },
  { to: "/admin/app/activations", label: "Активации", icon: "↻" },
  { to: "/admin/app/keys", label: "Ключи FM1", icon: "🔑" },
  { to: "/admin/app/tools", label: "Инструменты", icon: "⚙" },
];

export function AdminShell() {
  const navigate = useNavigate();
  const { refresh } = useAdminSession();

  async function logout() {
    await adminLogout();
    await refresh();
    navigate("/admin");
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-white/10 bg-slate-950 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/30 to-violet-500/20 text-sm font-bold text-sky-200">
            Z
          </span>
          <div>
            <p className="text-sm font-semibold">{COMPANY.brand}</p>
            <p className="text-xs text-slate-500">Админка сотрудника</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-6">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-sky-500/20 text-sky-100"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <span className="text-base opacity-80">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-3 lg:block">
          <button type="button" onClick={() => void logout()} className="btn-secondary w-full text-sm">
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 lg:hidden">
          <p className="text-sm font-medium">{COMPANY.brand} · Admin</p>
          <button type="button" onClick={() => void logout()} className="btn-secondary text-xs">
            Выйти
          </button>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
