export type BillingPeriod = "monthly" | "yearly";

export type PricingQuote = {
  plan: string;
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

export type PricingConfig = {
  currency: string;
  currency_label: string;
  yearly_months_paid: number;
  user_presets: number[];
  plans: {
    plan: string;
    label: string;
    monthly_base: number;
    included_users: number;
    extra_user_monthly: number;
    custom_quote?: boolean;
  }[];
};

const FALLBACK_CONFIG: PricingConfig = {
  currency: "KZT",
  currency_label: "₸",
  yearly_months_paid: 10,
  user_presets: [5, 10, 25, 50, 100, 250, 500],
  plans: [
    { plan: "trial", label: "Пробный", monthly_base: 0, included_users: 10, extra_user_monthly: 0 },
    {
      plan: "standard",
      label: "Стандарт",
      monthly_base: 89_000,
      included_users: 25,
      extra_user_monthly: 3_500,
    },
    {
      plan: "professional",
      label: "Professional",
      monthly_base: 249_000,
      included_users: 100,
      extra_user_monthly: 2_500,
    },
    {
      plan: "enterprise",
      label: "Enterprise",
      monthly_base: 0,
      included_users: 100,
      extra_user_monthly: 2_000,
      custom_quote: true,
    },
  ],
};

export function formatKzt(amount: number, currencyLabel = "₸"): string {
  if (amount <= 0) return "Бесплатно";
  return `${new Intl.NumberFormat("ru-KZ").format(amount)} ${currencyLabel}`;
}

export async function fetchPricingConfig(): Promise<PricingConfig> {
  try {
    const res = await fetch("/api/v1/portal/pricing-config");
    if (!res.ok) return FALLBACK_CONFIG;
    return (await res.json()) as PricingConfig;
  } catch {
    return FALLBACK_CONFIG;
  }
}

export async function fetchPricingQuote(input: {
  users: number;
  period: BillingPeriod;
  extended?: boolean;
  integrations?: boolean;
}): Promise<PricingQuote> {
  const res = await fetch("/api/v1/portal/pricing-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
  return payload.quote as PricingQuote;
}

export function recommendPlanLabel(
  users: number,
  options: { extended?: boolean; integrations?: boolean },
  config: PricingConfig,
): string {
  let plan = "standard";
  if (options.integrations || users > 100) plan = "enterprise";
  else if (options.extended || users > 25) plan = "professional";
  else if (users <= 10) plan = "trial";
  return config.plans.find((p) => p.plan === plan)?.label ?? plan;
}
