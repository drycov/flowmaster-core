import { ClipboardList, Lock, ShieldCheck, Stamp } from "lucide-react";

import { sap } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";

const ITEMS = [
  { key: "auth.security.edsNuc", icon: Stamp },
  { key: "auth.security.audit", icon: ClipboardList },
  { key: "auth.security.secureAccess", icon: Lock },
  { key: "auth.security.compliance", icon: ShieldCheck },
] as const;

export function AuthSecurityBlock() {
  const { t } = useI18n();

  return (
    <div
      className="rounded-sm border-l-4 p-4"
      style={{
        borderLeftColor: sap.brand,
        borderTop: `1px solid ${sap.borderLight}`,
        borderRight: `1px solid ${sap.borderLight}`,
        borderBottom: `1px solid ${sap.borderLight}`,
        backgroundColor: sap.messageInfoBg,
      }}
    >
      <p
        className="mb-3 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: sap.textSecondary }}
      >
        {t("auth.security.title")}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex items-start gap-2 text-xs leading-snug"
            style={{ color: sap.text }}
          >
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: sap.brand }} />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
