"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AuthNotice } from "@/components/auth-notice";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppBusiness } from "@/lib/auth/server";
import type { BusinessSubscriptionRecord, PlanUsage } from "@/lib/business/types";
import {
  getPlanCycleHelper,
  getPlanPriceLabel,
  getSubscriptionPlan,
  subscriptionPlans,
  subscriptionStatusLabels,
  type PlanId,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

export function SubscriptionView({
  business,
  usage,
  paymentStatus,
}: {
  business: AppBusiness;
  usage: PlanUsage;
  paymentStatus?: "sucesso" | "cancelado" | "expirado";
}) {
  const [subscription, setSubscription] = useState<BusinessSubscriptionRecord | null>(usage.subscription);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>(getSubscriptionPlan(usage.subscription?.plan_id).id);
  const [checkoutPlanId, setCheckoutPlanId] = useState<PlanId | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    getPaymentStatusMessage(paymentStatus),
  );
  const currentPlan = getSubscriptionPlan(currentPlanId);
  const billingCycle = subscription?.billing_cycle ?? "monthly";
  const maxProfessionals = subscription?.max_professionals ?? currentPlan.maxProfessionals;
  const maxServices = subscription?.max_services ?? currentPlan.maxServices;
  const checkoutExpired = paymentStatus === "expirado";
  const checkoutReturnedSuccess = paymentStatus === "sucesso" || getCheckoutReturnStatus(subscription) === "sucesso";
  const statusLabel =
    checkoutReturnedSuccess && subscription?.status === "pending"
      ? "Pagamento confirmado"
      : subscriptionStatusLabels[subscription?.status ?? "trialing"];
  const checkoutUrl = checkoutExpired || checkoutReturnedSuccess ? null : getStoredCheckoutUrl(subscription);

  async function handleCheckout(planId: PlanId) {
    if (planId === currentPlanId && checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }

    setCheckoutPlanId(planId);
    setMessage(null);

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      });
      const payload = (await response.json().catch(() => null)) as {
        checkoutUrl?: string;
        subscription?: BusinessSubscriptionRecord;
        error?: string;
      } | null;

      if (!response.ok || !payload?.checkoutUrl || !payload.subscription) {
        throw new Error(payload?.error ?? "Não foi possível criar o checkout do Asaas.");
      }

      setSubscription(payload.subscription);
      setCurrentPlanId(payload.subscription.plan_id);
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível criar o checkout do Asaas.",
      });
      setCheckoutPlanId(null);
    }
  }

  return (
    <AdminShell
      title="Assinatura"
      description="Plano, limites e cobrança do estabelecimento."
      businessName={business.name}
      businessLogoUrl={business.logo_url}
      themeKey={business.theme_key}
    >
      <div className="space-y-6">
        {message && <AuthNotice type={message.type} message={message.text} />}

        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <Card>
            <CardContent className="space-y-5 p-5">
              <SectionHeading title="Plano atual" icon={CreditCard} />
              <div className="rounded-lg border bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Assinatura</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">{currentPlan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{getPlanPriceLabel(currentPlan, billingCycle)}</p>
                  </div>
                  <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {statusLabel}
                  </span>
                </div>

                {checkoutReturnedSuccess && subscription?.status === "pending" && (
                  <div className="mt-4 rounded-lg bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">
                      Pagamento confirmado no Asaas. Agora estamos aguardando a baixa automática para ativar a
                      assinatura no sistema.
                    </p>
                  </div>
                )}

                {checkoutUrl && (
                  <div className="mt-4 rounded-lg bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">
                      Checkout Asaas criado. Continue pelo botão abaixo se ainda não concluiu o pagamento.
                    </p>
                    <Button className="mt-3" type="button" onClick={() => void handleCheckout(currentPlanId)}>
                      Continuar no Asaas
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionHeading title="Uso do plano" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-lg bg-secondary p-4">
                  <p className="text-sm text-muted-foreground">Profissionais</p>
                  <strong className="mt-1 block text-2xl text-slate-950">
                    {usage.professionalsCount}/{maxProfessionals}
                  </strong>
                </div>
                <div className="rounded-lg bg-secondary p-4">
                  <p className="text-sm text-muted-foreground">Serviços</p>
                  <strong className="mt-1 block text-2xl text-slate-950">
                    {usage.servicesCount}/{maxServices}
                  </strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-5 p-5">
            <SectionHeading
              eyebrow="Planos"
              title="Escolha o plano"
              description="Ao selecionar outro plano, o checkout do Asaas abre automaticamente para concluir a alteração."
            />

            <div className="grid gap-4 lg:grid-cols-3">
              {subscriptionPlans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const isBusy = checkoutPlanId === plan.id;
                const isOverProfessionals = usage.professionalsCount > plan.maxProfessionals;
                const isOverServices = usage.servicesCount > plan.maxServices;
                const canContinueCheckout = isCurrent && Boolean(checkoutUrl);
                const canRegenerateCheckout = isCurrent && checkoutExpired;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex min-h-[420px] flex-col rounded-lg border bg-white p-5",
                      isCurrent && "border-primary ring-2 ring-primary/15",
                    )}
                  >
                    <div className="flex min-h-8 items-start justify-between gap-3">
                      <h3 className="text-xl font-semibold text-slate-950">{plan.name}</h3>
                      {plan.highlight && (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                          {plan.highlight}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 min-h-12 text-sm text-muted-foreground">{plan.description}</p>
                    <p className="mt-5 text-3xl font-semibold text-slate-950">{getPlanPriceLabel(plan, billingCycle)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{getPlanCycleHelper(plan, billingCycle)}</p>

                    <div className="mt-5 grid gap-3 text-sm text-slate-700">
                      {plan.features.map((feature) => (
                        <span key={feature} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </span>
                      ))}
                    </div>

                    {(isOverProfessionals || isOverServices) && (
                      <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                        Seu uso atual está acima deste plano. Novos cadastros ficam bloqueados até o uso voltar ao limite.
                      </p>
                    )}

                    <Button
                      className="mt-auto"
                      type="button"
                      variant={isCurrent && !canContinueCheckout ? "secondary" : "default"}
                      disabled={(isCurrent && !canContinueCheckout && !canRegenerateCheckout) || checkoutPlanId !== null}
                      onClick={() => void handleCheckout(plan.id)}
                    >
                      {isBusy && <Loader2 className="size-4 animate-spin" />}
                      {isBusy
                        ? "Abrindo Asaas..."
                        : canContinueCheckout
                          ? "Continuar no Asaas"
                          : isCurrent
                            ? canRegenerateCheckout
                              ? "Gerar novo checkout"
                              : "Plano atual"
                            : "Selecionar e abrir Asaas"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

function getStoredCheckoutUrl(subscription: BusinessSubscriptionRecord | null) {
  if (!subscription?.provider_checkout_id || subscription.provider_subscription_id) {
    return null;
  }

  const metadata = subscription.metadata;

  if (!isRecord(metadata)) {
    return null;
  }

  const checkout = metadata.asaas_checkout;

  if (!isRecord(checkout) || typeof checkout.link !== "string") {
    return null;
  }

  return checkout.link.startsWith("https://") ? checkout.link : null;
}

function getCheckoutReturnStatus(subscription: BusinessSubscriptionRecord | null) {
  const metadata = subscription?.metadata;

  if (!isRecord(metadata)) {
    return null;
  }

  const checkout = metadata.asaas_checkout;

  if (!isRecord(checkout) || typeof checkout.return_status !== "string") {
    return null;
  }

  return checkout.return_status;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPaymentStatusMessage(status: "sucesso" | "cancelado" | "expirado" | undefined) {
  if (status === "sucesso") {
    return {
      type: "success" as const,
      text: "Pagamento confirmado no Asaas. A assinatura será ativada assim que a baixa automática chegar ao sistema.",
    };
  }

  if (status === "cancelado") {
    return { type: "error" as const, text: "Checkout cancelado. Escolha um plano ou continue o checkout pendente." };
  }

  if (status === "expirado") {
    return { type: "error" as const, text: "O checkout expirou. Escolha o plano novamente para gerar um novo link." };
  }

  return null;
}
