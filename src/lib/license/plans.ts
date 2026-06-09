import type { LicenseFeature, LicenseFeatures, LicensePlan } from "./types";

export type PlanPreset = {
  plan: LicensePlan;
  max_users: number;
  features: LicenseFeatures;
  trial_days?: number;
};

const ALL_FEATURES: LicenseFeatures = {
  workflows: true,
  templates: true,
  eds_signing: true,
  archive: true,
  references: true,
  nomenclature: true,
  audit: true,
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
      workflows: true,
      templates: true,
      eds_signing: true,
      archive: true,
      references: true,
      nomenclature: true,
      audit: false,
    },
  },
  professional: {
    plan: "professional",
    max_users: 100,
    features: ALL_FEATURES,
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
  };
  return labels[feature][locale];
}
