export const planIds = ["basic", "plus", "business"] as const;

export type PlanId = (typeof planIds)[number];

export type SubscriptionStatus = "trialing" | "pending" | "active" | "canceled" | "past_due";

export type SubscriptionPlan = {
  id: PlanId;
  name: string;
  priceCents: number;
  priceLabel: string;
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
    priceCents: 1500,
    priceLabel: "R$ 15/mês",
    description: "Para autônomos que querem começar com uma agenda simples.",
    maxProfessionals: 1,
    maxServices: 5,
    features: ["1 profissional", "5 serviços", "Agenda pública", "Remarcação e cancelamento"],
  },
  {
    id: "plus",
    name: "Plus",
    priceCents: 3000,
    priceLabel: "R$ 30/mês",
    description: "Para pequenas equipes que precisam organizar mais atendimentos.",
    maxProfessionals: 5,
    maxServices: 20,
    highlight: "Mais escolhido",
    features: ["Até 5 profissionais", "20 serviços", "Lista e grade de agenda", "Personalização visual"],
  },
  {
    id: "business",
    name: "Business",
    priceCents: 5990,
    priceLabel: "R$ 59,90/mês",
    description: "Para negócios com operação maior e mais capacidade.",
    maxProfessionals: 15,
    maxServices: 60,
    features: ["Até 15 profissionais", "60 serviços", "Relatórios futuros", "Mais configurações"],
  },
];

export function getSubscriptionPlan(planId: string | null | undefined) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? subscriptionPlans[0];
}
