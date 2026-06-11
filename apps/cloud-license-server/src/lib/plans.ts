import type { LicenseFeatures, LicensePlan } from "./types.js";

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
  office: false,
  reports: false,
  monitoring: false,
};

const PROFESSIONAL_FEATURES: LicenseFeatures = {
  ...CORE_FEATURES,
  audit: true,
  knowledge_base: true,
  projects: true,
  contracts: true,
  hr: true,
  office: true,
  reports: true,
};

const ALL_FEATURES: LicenseFeatures = {
  ...PROFESSIONAL_FEATURES,
  integrations: true,
  monitoring: true,
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
      office: false,
      reports: false,
      monitoring: false,
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

export function planLabel(plan: LicensePlan): string {
  const labels: Record<LicensePlan, string> = {
    trial: "Пробный",
    standard: "Стандарт",
    professional: "Professional",
    enterprise: "Enterprise",
  };
  return labels[plan];
}
