import type { PortalUsageTelemetry } from "../lib/api";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

export function UsageTelemetrySummary({ telemetry }: { telemetry: PortalUsageTelemetry }) {
  const hasData =
    telemetry.total_users > 0 ||
    telemetry.active_users > 0 ||
    telemetry.documents_total > 0 ||
    telemetry.workflows_published > 0;

  if (!hasData && !telemetry.app_version) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-sm font-medium">Телеметрия использования</p>
        <p className="mt-2 text-sm text-slate-500">
          Данные появятся после первой синхронизации лицензии с EDMS. Передаются только
          агрегированные показатели — без содержимого документов и персональных данных.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Телеметрия использования</p>
          <p className="mt-1 text-xs text-slate-500">
            Агрегированная статистика с вашей установки — без конфиденциальных данных
          </p>
        </div>
        {telemetry.reported_at ? (
          <p className="text-xs text-slate-500">
            Обновлено {new Date(telemetry.reported_at).toLocaleString("ru-RU")}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Пользователей" value={telemetry.total_users} />
        <Stat
          label="По лимиту лицензии"
          value={
            telemetry.max_users_allowed > 0
              ? `${telemetry.active_users} / ${telemetry.max_users_allowed}`
              : telemetry.active_users
          }
        />
        <Stat label="Документов всего" value={telemetry.documents_total} />
        <Stat label="Документов за 30 дней" value={telemetry.documents_30d} />
        <Stat label="Опубликованных маршрутов" value={telemetry.workflows_published} />
        {telemetry.app_version ? <Stat label="Версия ЕСЭДО" value={telemetry.app_version} /> : null}
      </div>

      {telemetry.environment || telemetry.platform ? (
        <p className="mt-4 text-xs text-slate-500">
          {telemetry.environment ? `Среда: ${telemetry.environment}` : null}
          {telemetry.environment && telemetry.platform ? " · " : null}
          {telemetry.platform ? telemetry.platform : null}
        </p>
      ) : null}
    </div>
  );
}
