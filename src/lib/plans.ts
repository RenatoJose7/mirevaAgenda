export const planIds = ["basic", "plus", "business"] as const;

export type PlanId = (typeof planIds)[number];
export type BillingCycle = "monthly" | "annual";

export type SubscriptionStatus = "trialing" | "pending" | "active" | "canceled" | "past_due";

export type SubscriptionPlan = {
  id: PlanId;
  name: string;
  priceCents: number;
  priceLabel: string;
  annualPriceCents: number;
  annualPriceLabel: string;
  description: string;
  maxProfessionals: number;
  maxServices: number;
  highlight?: string;
  features: string[];
};

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Básico",
    priceCents: 3990,
    priceLabel: "R$ 39,90/mês",
    annualPriceCents: 39900,
    annualPriceLabel: "R$ 399/ano",
    description: "Para autônomos que querem uma agenda simples.",
    maxProfessionals: 1,
    maxServices: 5,
    features: ["1 profissional", "5 serviços", "Agenda pública", "Remarcação e cancelamento"],
  },
  {
    id: "plus",
    name: "Plus",
    priceCents: 8990,
    priceLabel: "R$ 89,90/mês",
    annualPriceCents: 89900,
    annualPriceLabel: "R$ 899/ano",
    description: "Para pequenas equipes que precisam organizar melhor os atendimentos.",
    maxProfessionals: 5,
    maxServices: 20,
    highlight: "Mais escolhido",
    features: ["Até 5 profissionais", "20 serviços", "Lista e grade de agenda", "Personalização visual"],
  },
  {
    id: "business",
    name: "Business",
    priceCents: 17990,
    priceLabel: "R$ 179,90/mês",
    annualPriceCents: 179900,
    annualPriceLabel: "R$ 1.799/ano",
    description: "Para negócios com mais profissionais, mais serviços e maior volume de agendamentos.",
    maxProfessionals: 15,
    maxServices: 60,
    features: ["Até 15 profissionais", "60 serviços", "Relatórios futuros", "Mais configurações"],
  },
];

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  trialing: "Período grátis",
  pending: "Pagamento pendente",
  active: "Ativo",
  canceled: "Cancelado",
  past_due: "Pagamento atrasado",
};

export function getSubscriptionPlan(planId: string | null | undefined) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? subscriptionPlans[0];
}

export function getPlanPriceLabel(plan: SubscriptionPlan, billingCycle: BillingCycle) {
  return billingCycle === "annual" ? plan.annualPriceLabel : plan.priceLabel;
}

export function getPlanCycleHelper(plan: SubscriptionPlan, billingCycle: BillingCycle) {
  if (billingCycle === "annual") {
    return `Equivale a 10 meses no plano ${plan.name}.`;
  }

  return "Cobrança mensal, sem fidelidade.";
}
