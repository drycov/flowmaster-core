import { planLabel } from "./plans.js";
import type { LicensePlan } from "./types.js";

export type BillingPeriod = "monthly" | "yearly";

export type PricingQuote = {
  plan: LicensePlan;
  plan_label: string;
  users: number;
  period: BillingPeriod;
  monthly: number;
  total: number;
  extra_users: number;
  custom_quote: boolean;
  savings_yearly: number;
  trial_eligible: boolean;
  breakdown: { base: number; extra: number };
};

export const PRICING_CONFIG = {
  currency: "KZT",
  currency_label: "₸",
  yearly_months_paid: 10,
  user_presets: [5, 10, 25, 50, 100, 250, 500],
  rates: {
    trial: {
      monthly_base: 0,
      included_users: 10,
      extra_user_monthly: 0,
    },
    standard: {
      monthly_base: 89_000,
      included_users: 25,
      extra_user_monthly: 3_500,
    },
    professional: {
      monthly_base: 249_000,
      included_users: 100,
      extra_user_monthly: 2_500,
    },
    enterprise: {
      monthly_base: 0,
      included_users: 100,
      extra_user_monthly: 2_000,
      custom_quote: true,
    },
  },
} as const;

export function recommendPlan(
  users: number,
  options?: { extended?: boolean; integrations?: boolean },
): LicensePlan {
  if (options?.integrations) return "enterprise";
  if (users > 100) return "enterprise";
  if (options?.extended) return "professional";
  if (users <= 10) return "trial";
  return "standard";
}

export function calculateQuote(input: {
  users: number;
  period: BillingPeriod;
  plan?: LicensePlan;
  extended?: boolean;
  integrations?: boolean;
}): PricingQuote {
  const users = Math.max(1, Math.min(9999, Math.round(input.users)));
  const period = input.period;
  const plan = input.plan ?? recommendPlan(users, input);
  const trial_eligible = users <= PRICING_CONFIG.rates.trial.included_users;

  if (plan === "trial") {
    return {
      plan,
      plan_label: planLabel(plan),
      users,
      period,
      monthly: 0,
      total: 0,
      extra_users: 0,
      custom_quote: false,
      savings_yearly: 0,
      trial_eligible,
      breakdown: { base: 0, extra: 0 },
    };
  }

  const rate = PRICING_CONFIG.rates[plan];

  if (plan === "enterprise" && "custom_quote" in rate && rate.custom_quote) {
    const prof = PRICING_CONFIG.rates.professional;
    const extraUsers = Math.max(0, users - prof.included_users);
    const monthly =
      prof.monthly_base + extraUsers * PRICING_CONFIG.rates.enterprise.extra_user_monthly;

    return {
      plan,
      plan_label: planLabel(plan),
      users,
      period,
      monthly,
      total: period === "yearly" ? monthly * PRICING_CONFIG.yearly_months_paid : monthly,
      extra_users: extraUsers,
      custom_quote: true,
      savings_yearly:
        period === "yearly" ? monthly * (12 - PRICING_CONFIG.yearly_months_paid) : 0,
      trial_eligible,
      breakdown: { base: prof.monthly_base, extra: extraUsers * PRICING_CONFIG.rates.enterprise.extra_user_monthly },
    };
  }

  const extraUsers = Math.max(0, users - rate.included_users);
  const monthly = rate.monthly_base + extraUsers * rate.extra_user_monthly;
  const savings_yearly =
    period === "yearly" ? monthly * (12 - PRICING_CONFIG.yearly_months_paid) : 0;

  return {
    plan,
    plan_label: planLabel(plan),
    users,
    period,
    monthly,
    total: period === "yearly" ? monthly * PRICING_CONFIG.yearly_months_paid : monthly,
    extra_users: extraUsers,
    custom_quote: false,
    savings_yearly,
    trial_eligible,
    breakdown: {
      base: rate.monthly_base,
      extra: extraUsers * rate.extra_user_monthly,
    },
  };
}

export function buildPricingConfig() {
  return {
    ...PRICING_CONFIG,
    plans: (["trial", "standard", "professional", "enterprise"] as LicensePlan[]).map((plan) => ({
      plan,
      label: planLabel(plan),
      ...PRICING_CONFIG.rates[plan],
    })),
  };
}
