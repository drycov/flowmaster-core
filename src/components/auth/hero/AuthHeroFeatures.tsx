import { Check } from "lucide-react";

import { sap } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";

const FEATURE_KEYS = [
  "auth.hero.benefit.documents",
  "auth.hero.benefit.workflow",
  "auth.hero.benefit.eds",
  "auth.hero.benefit.archive",
] as const;

export function AuthHeroFeatures() {
  const { t } = useI18n();

  return (
    <ul
      className="divide-y rounded-sm border"
      style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" }}
    >
      {FEATURE_KEYS.map((key) => (
        <li key={key} className="flex items-center gap-3 px-4 py-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
            style={{ backgroundColor: "rgba(0,112,242,0.25)" }}
          >
            <Check className="h-3.5 w-3.5 stroke-[2.5]" style={{ color: "#A9CFFF" }} />
          </span>
          <span className="text-sm font-normal" style={{ color: sap.textOnShell }}>
            {t(key)}
          </span>
        </li>
      ))}
    </ul>
  );
}
