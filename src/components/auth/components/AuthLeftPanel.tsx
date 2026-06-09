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
    <div className="gov-stripe hidden lg:flex flex-col justify-between px-14 py-12 text-white">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-white/10 backdrop-blur">
          <span className="text-xl font-bold">ED</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("app.name")}</h1>
          <p className="text-sm text-white/70">{t("app.tagline")}</p>
        </div>
      </div>

      <div className="max-w-xl">
        <h2 className="mb-5 text-4xl font-semibold leading-tight">{t("auth.heroTitle")}</h2>

        <p className="mb-8 text-base leading-relaxed text-white/75">{t("auth.heroDescription")}</p>

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
                  <div className="text-sm leading-relaxed text-white/70">{item.description}</div>
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
