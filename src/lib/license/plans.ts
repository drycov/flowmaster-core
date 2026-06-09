import type { LicenseFeature, LicenseFeatures, LicensePlan } from "./types";

export type PlanPreset = {
  plan: LicensePlan;
  max_users: number;
  features: LicenseFeatures;
  trial_days?: number;
};

const CORE_FEATURES: LicenseFeatures = {
  workflows: true,
  templates: true,
  eds_signing: true,
  archive: true,
  references: true,
  nomenclature: true,
  correspondence: true,
  substitutions: true,
  counterparties: true,
};

const PROFESSIONAL_FEATURES: LicenseFeatures = {
  ...CORE_FEATURES,
  audit: true,
  knowledge_base: true,
  projects: true,
  contracts: true,
  hr: true,
};

const ALL_FEATURES: LicenseFeatures = {
  ...PROFESSIONAL_FEATURES,
  integrations: true,
};

export const PLAN_PRESETS: Record<LicensePlan, PlanPreset> = {
  trial: {
    plan: "trial",
    max_users: 10,
    features: ALL_FEATURES,
    trial_days: 30,
  },
  standard: {
    plan: "standard",
    max_users: 25,
    features: {
      ...CORE_FEATURES,
      audit: false,
      knowledge_base: false,
      projects: false,
      contracts: false,
      hr: false,
      integrations: false,
    },
  },
  professional: {
    plan: "professional",
    max_users: 100,
    features: PROFESSIONAL_FEATURES,
  },
  enterprise: {
    plan: "enterprise",
    max_users: 9999,
    features: ALL_FEATURES,
  },
};

export function planLabel(plan: LicensePlan, locale: "ru" | "kk"): string {
  const labels: Record<LicensePlan, { ru: string; kk: string }> = {
    trial: { ru: "Пробная", kk: "Сынақ" },
    standard: { ru: "Стандарт", kk: "Стандарт" },
    professional: { ru: "Профессиональная", kk: "Кәсіби" },
    enterprise: { ru: "Корпоративная", kk: "Корпоративтік" },
  };
  return labels[plan][locale];
}

export function featureLabel(feature: LicenseFeature, locale: "ru" | "kk"): string {
  const labels: Record<LicenseFeature, { ru: string; kk: string }> = {
    workflows: { ru: "Маршруты согласования", kk: "Келісу бағыттары" },
    templates: { ru: "Шаблоны документов", kk: "Құжат үлгілері" },
    eds_signing: { ru: "Подписание ЭЦП", kk: "ЭЦҚ қол қою" },
    archive: { ru: "Архив", kk: "Мұрағат" },
    references: { ru: "Справочники СЭД", kk: "СЭД анықтамалықтары" },
    nomenclature: { ru: "Номенклатура дел", kk: "Іс номенклатурасы" },
    audit: { ru: "Журнал аудита", kk: "Аудит журналы" },
    knowledge_base: { ru: "База знаний", kk: "Білім базасы" },
    projects: { ru: "Проекты документов", kk: "Құжат жобалары" },
    contracts: { ru: "Договоры", kk: "Шарттар" },
    counterparties: { ru: "Контрагенты", kk: "Контрагенттер" },
    hr: { ru: "Кадры и отпуска", kk: "Кадрлар және демалыс" },
    substitutions: { ru: "Замещения", kk: "Ауыстырулар" },
    correspondence: { ru: "Корреспонденция", kk: "Корреспонденция" },
    integrations: { ru: "Интеграции и API", kk: "Интеграциялар және API" },
  };
  return labels[feature][locale];
}
