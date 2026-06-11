/** Публичные реквизиты ИП ZEUS для landing (без банковских и персональных документов). */
export const COMPANY = {
  brand: "ZEUS",
  product: "ЕСЭДО",
  productFull: "Единая система электронного документооборота",
  legalName: "Индивидуальный предприниматель ZEUS",
  owner: "Рыков Денис Игорьевич",
  iin: "951025351348",
  phone: "+7 771 051 5252",
  phoneTel: "+77710515252",
  email: import.meta.env.VITE_SALES_EMAIL?.trim() || "",
  city: "Серебрянск",
  region: "Восточно-Казахстанская область",
  country: "Казахстан",
  addressShort: "г. Серебрянск, пер. Коммунальный, д. 5",
  addressFull:
    "Республика Казахстан, Восточно-Казахстанская область, район Алтай, г. Серебрянск, пер. Коммунальный, д. 5",
  ipRegisteredAt: "18.04.2025",
  primaryOked: {
    code: "62011",
    name: "Разработка и тестирование программного кода",
  },
  activities: [
    "Разработка и сопровождение корпоративного ПО",
    "Предоставление программных продуктов и SaaS",
    "IT-инфраструктура и телекоммуникации",
    "Внедрение и поддержка систем документооборота",
  ],
} as const;

export function salesContactHref(subject?: string): string {
  if (COMPANY.email) {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    return `mailto:${COMPANY.email}${q}`;
  }
  return `tel:${COMPANY.phoneTel}`;
}

export const SALES_EMAIL = COMPANY.email;
