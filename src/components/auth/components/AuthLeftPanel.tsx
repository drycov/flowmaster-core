import { ShieldCheck, FileCheck2, Workflow, Archive } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function AuthLeftPanel() {
  const { t } = useI18n();

  const features = [
    {
      icon: FileCheck2,
      title: "Управление документами",
      description:
        "Единое пространство для регистрации, согласования и контроля исполнения документов.",
    },
    {
      icon: Workflow,
      title: "Workflow и согласование",
      description:
        "Гибкие маршруты согласования, SLA, делегирование и автоматическая эскалация.",
    },
    {
      icon: ShieldCheck,
      title: "Юридически значимая подпись",
      description:
        "Интеграция с NCALayer, ЭЦП РК, журналирование и контроль подлинности документов.",
    },
    {
      icon: Archive,
      title: "Электронный архив",
      description:
        "Долговременное хранение документов с полной историей изменений и действий.",
    },
  ];

  return (
    <div className="gov-stripe hidden lg:flex flex-col justify-between px-14 py-12 text-white">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-white/10 backdrop-blur">
          <span className="text-xl font-bold">ED</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t("app.name")}
          </h1>
          <p className="text-sm text-white/70">{t("app.tagline")}</p>
        </div>
      </div>

      <div className="max-w-xl">
        <h2 className="mb-5 text-4xl font-semibold leading-tight">
          Корпоративная система
          <br />
          электронного
          <br />
          документооборота
        </h2>

        <p className="mb-8 text-base leading-relaxed text-white/75">
          Автоматизация полного жизненного цикла документов —
          от создания и согласования до подписания ЭЦП и архивного хранения.
        </p>

        <div className="space-y-5">
          {features.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="flex gap-4">
                <div className="mt-1">
                  <Icon className="h-5 w-5 text-white/90" />
                </div>

                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm leading-relaxed text-white/70">
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-1 text-xs text-white/50">
        <div>Enterprise Document Management System</div>
        <div>Audit • Workflow • EDS • Archive</div>
      </div>
    </div>
  );
}