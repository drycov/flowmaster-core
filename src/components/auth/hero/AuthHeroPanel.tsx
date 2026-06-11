import { AuthHeroFeatures } from "./AuthHeroFeatures";
import { AuthWorkflowIllustration } from "./AuthWorkflowIllustration";
import { sap } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";

export function AuthHeroPanel() {
  const { t } = useI18n();

  return (
    <section
      className="order-2 flex flex-col justify-center px-6 py-10 sm:px-10 lg:order-1 lg:px-12 lg:py-12 xl:px-16 2xl:px-20"
      style={{ backgroundColor: sap.heroBg }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 xl:max-w-3xl xl:gap-10">
        <div className="space-y-4 border-l-4 pl-4" style={{ borderColor: sap.brand }}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {t("app.name")}
          </p>
          <h1
            className="text-2xl font-semibold leading-tight sm:text-3xl xl:text-4xl 2xl:text-[2.5rem]"
            style={{ color: sap.textOnShell }}
          >
            {t("auth.heroTitle")}
          </h1>
          <p
            className="max-w-xl text-sm leading-relaxed sm:text-base xl:text-[1.05rem]"
            style={{ color: sap.textOnShellMuted }}
          >
            {t("auth.heroDescription")}
          </p>
        </div>

        <AuthHeroFeatures />

        <div className="flex justify-center lg:justify-start">
          <AuthWorkflowIllustration />
        </div>
      </div>
    </section>
  );
}
