import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_PRESETS } from "./plans.js";
import { calculateQuote, PRICING_CONFIG } from "./pricing.js";
import { upsertProvisionOnServer } from "./registry.js";
import { telemetryFromRow } from "./telemetry.js";
import type { LicenseFeatures, LicensePlan, PortalInstallationTariff, PortalInstallationView, PortalUsageTelemetry } from "./types.js";

export const FEATURE_LABELS: Record<string, string> = {
  workflows: "Маршруты согласования",
  templates: "Шаблоны документов",
  eds_signing: "Электронная подпись (ЭЦП)",
  office: "Редактор ONLYOFFICE",
  archive: "Архив документов",
  references: "Справочники СЭД",
  nomenclature: "Номенклатура дел",
  audit: "Аудит действий",
  knowledge_base: "База знаний",
  projects: "Проекты",
  contracts: "Договоры",
  counterparties: "Контрагенты",
  hr: "Кадры (HR)",
  substitutions: "Замещения",
  correspondence: "Корреспонденция",
  integrations: "Интеграции",
  reports: "Отчёты",
  monitoring: "Мониторинг",
};

export const PLAN_MARKETING: Record<
  LicensePlan,
  { title: string; subtitle: string; priceLabel: string; highlight?: boolean; cta: string }
> = {
  trial: {
    title: "Пробный",
    subtitle: "30 дней, все модули",
    priceLabel: "Бесплатно",
    cta: "Начать пробный период",
  },
  standard: {
    title: "Стандарт",
    subtitle: "Базовый документооборот",
    priceLabel: "По запросу",
    cta: "Запросить коммерческое",
  },
  professional: {
    title: "Professional",
    subtitle: "Полный СЭД для организации",
    priceLabel: "По запросу",
    highlight: true,
    cta: "Выбрать Professional",
  },
  enterprise: {
    title: "Enterprise",
    subtitle: "Без лимитов и с интеграциями",
    priceLabel: "Индивидуально",
    cta: "Связаться с нами",
  },
};

export function buildPublicPlans() {
  return (Object.keys(PLAN_PRESETS) as LicensePlan[]).map((plan) => {
    const preset = PLAN_PRESETS[plan];
    const marketing = PLAN_MARKETING[plan];
    const enabledFeatures = Object.entries(preset.features)
      .filter(([, v]) => v)
      .map(([k]) => ({ key: k, label: FEATURE_LABELS[k] ?? k }));

    return {
      plan,
      title: marketing.title,
      subtitle: marketing.subtitle,
      priceLabel: marketing.priceLabel,
      highlight: marketing.highlight ?? false,
      cta: marketing.cta,
      max_users: preset.max_users,
      trial_days: preset.trial_days ?? null,
      features: enabledFeatures,
    };
  });
}

export function buildInstallationTariff(input: {
  plan: LicensePlan;
  max_users: number;
  features: LicenseFeatures;
  expires_at: string | null;
}): PortalInstallationTariff {
  const marketing = PLAN_MARKETING[input.plan];
  const enabledFeatures = Object.entries(input.features)
    .filter(([, v]) => v)
    .map(([k]) => ({ key: k, label: FEATURE_LABELS[k] ?? k }));

  const days_remaining = input.expires_at
    ? Math.max(0, Math.ceil((new Date(input.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  if (input.plan === "trial") {
    return {
      title: marketing.title,
      subtitle: marketing.subtitle,
      price_label: marketing.priceLabel,
      days_remaining,
      is_trial: true,
      features: enabledFeatures,
      pricing: null,
    };
  }

  const quote = calculateQuote({
    users: input.max_users,
    period: "monthly",
    plan: input.plan,
  });

  return {
    title: marketing.title,
    subtitle: marketing.subtitle,
    price_label: marketing.priceLabel,
    days_remaining,
    is_trial: false,
    features: enabledFeatures,
    pricing: {
      currency_label: PRICING_CONFIG.currency_label,
      monthly: quote.monthly,
      yearly_total: quote.monthly * PRICING_CONFIG.yearly_months_paid,
      custom_quote: quote.custom_quote,
      extra_users: quote.extra_users,
      yearly_months_paid: PRICING_CONFIG.yearly_months_paid,
    },
  };
}

function parseProvisionFeatures(
  raw: unknown,
  plan: LicensePlan,
): LicenseFeatures {
  if (raw && typeof raw === "object" && Object.keys(raw as object).length > 0) {
    return raw as LicenseFeatures;
  }
  return PLAN_PRESETS[plan].features;
}

async function loadInstallationViews(
  supabase: SupabaseClient,
  installationIds: string[],
): Promise<PortalInstallationView[]> {
  if (!installationIds.length) return [];

  const { data: provisions, error } = await supabase
    .from("license_server_provisions")
    .select("*")
    .in("installation_id", installationIds);

  if (error) throw new Error(error.message);

  const { data: activations } = await supabase
    .from("license_server_activations")
    .select(
      "installation_id, last_seen_at, hostname, app_version, status, last_active_users, telemetry, telemetry_at",
    )
    .in("installation_id", installationIds)
    .eq("status", "active")
    .order("last_seen_at", { ascending: false });

  const actMap = new Map<string, Record<string, unknown>>();
  for (const row of activations ?? []) {
    const id = String((row as { installation_id: string }).installation_id);
    if (!actMap.has(id)) actMap.set(id, row as Record<string, unknown>);
  }

  const provMap = new Map(
    (provisions ?? []).map((p) => [String(p.installation_id), p as Record<string, unknown>]),
  );

  return installationIds.map((installationId) => {
    const prov = provMap.get(installationId);
    const act = actMap.get(installationId);
    const plan = prov ? (String(prov.plan) as LicensePlan) : null;
    const max_users = prov ? Number(prov.max_users) : null;
    const expires_at = prov?.expires_at ? String(prov.expires_at) : null;

    const tariff =
      plan && max_users
        ? buildInstallationTariff({
            plan,
            max_users,
            features: parseProvisionFeatures(prov?.features, plan),
            expires_at,
          })
        : null;

    return {
      installation_id: installationId,
      plan,
      max_users,
      status: prov ? String(prov.status) : "pending",
      customer_name: prov ? String(prov.customer_name ?? "") : "",
      expires_at,
      last_seen_at: act?.last_seen_at ? String(act.last_seen_at) : null,
      hostname: act?.hostname ? String(act.hostname) : null,
      app_version: act?.app_version ? String(act.app_version) : null,
      tariff,
      telemetry: telemetryFromRow(act),
    };
  });
}

export async function getPortalAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  account: { id: string; email: string; company_name: string };
  installations: PortalInstallationView[];
} | null> {
  const { data: account, error } = await supabase
    .from("portal_accounts")
    .select("id, email, company_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!account) return null;

  const { data: links, error: linkErr } = await supabase
    .from("portal_account_installations")
    .select("installation_id")
    .eq("account_id", account.id);

  if (linkErr) throw new Error(linkErr.message);

  const installationIds = (links ?? []).map((l) => String(l.installation_id));
  const installations = await loadInstallationViews(supabase, installationIds);

  return {
    account: {
      id: String(account.id),
      email: String(account.email),
      company_name: String(account.company_name),
    },
    installations,
  };
}

export async function bootstrapPortalAccount(
  supabase: SupabaseClient,
  user: { id: string; email: string },
  companyName: string,
): Promise<{
  account: { id: string; email: string; company_name: string };
  installations: PortalInstallationView[];
  created: boolean;
}> {
  const existing = await getPortalAccount(supabase, user.id);
  if (existing) {
    return { ...existing, created: false };
  }

  const installationId = randomUUID();
  const preset = PLAN_PRESETS.trial;
  const trialExpires = new Date(Date.now() + (preset.trial_days ?? 30) * 86400000).toISOString();

  const { data: account, error: accErr } = await supabase
    .from("portal_accounts")
    .insert({
      user_id: user.id,
      email: user.email,
      company_name: companyName.trim(),
    })
    .select("id, email, company_name")
    .single();

  if (accErr) throw new Error(accErr.message);

  const { error: linkErr } = await supabase.from("portal_account_installations").insert({
    account_id: account.id,
    installation_id: installationId,
    label: "Основная установка",
  });

  if (linkErr) throw new Error(linkErr.message);

  await upsertProvisionOnServer(supabase, {
    installation_id: installationId,
    plan: "trial",
    max_users: preset.max_users,
    features: preset.features as Record<string, boolean>,
    customer_name: companyName.trim(),
    expires_at: trialExpires,
  });

  const installations = await loadInstallationViews(supabase, [installationId]);

  return {
    account: {
      id: String(account.id),
      email: String(account.email),
      company_name: String(account.company_name),
    },
    installations,
    created: true,
  };
}
