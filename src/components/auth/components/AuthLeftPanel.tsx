import { ShieldCheck, FileCheck2, Workflow, Archive } from "lucide-react";
import { useI18n } from "@/i18n";

export function AuthLeftPanel() {
  const { t } = useI18n();

  const features = [
    {
      icon: FileCheck2,
      title: t("auth.feature.documents.title"),
      description: t("auth.feature.documents.desc"),
    },
    {
      icon: Workflow,
      title: t("auth.feature.workflow.title"),
      description: t("auth.feature.workflow.desc"),
    },
    {
      icon: ShieldCheck,
      title: t("auth.feature.eds.title"),
      description: t("auth.feature.eds.desc"),
    },
    {
      icon: Archive,
      title: t("auth.feature.archive.title"),
      description: t("auth.feature.archive.desc"),
    },
  ];

  return (
    <div className="gov-stripe relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-14 xl:py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />

      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur">
          <span className="text-lg font-bold">{t("shell.brandAbbr")}</span>
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t("app.name")}</h1>
          <p className="text-sm text-white/70">{t("app.tagline")}</p>
        </div>
      </div>

      <div className="relative max-w-lg">
        <h2 className="mb-4 text-3xl font-semibold leading-tight xl:text-4xl">
          {t("auth.heroTitle")}
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-white/75 xl:text-base">
          {t("auth.heroDescription")}
        </p>

        <div className="space-y-4">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/90" />
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs leading-relaxed text-white/65">{item.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative text-xs text-white/45">{t("shell.version")}</div>
    </div>
  );
}
