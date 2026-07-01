"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
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
  type BillingCycle,
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
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>(
    usage.subscription?.billing_cycle ?? "monthly",
  );
  const [busyPlanId, setBusyPlanId] = useState<PlanId | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    getPaymentStatusMessage(paymentStatus),
  );
  const currentPlan = getSubscriptionPlan(currentPlanId);
  const currentBillingCycle = subscription?.billing_cycle ?? "monthly";
  const maxProfessionals = subscription?.max_professionals ?? currentPlan.maxProfessionals;
  const maxServices = subscription?.max_services ?? currentPlan.maxServices;
  const checkoutExpired = paymentStatus === "expirado" || subscription?.provider_status === "CHECKOUT_EXPIRED";
  const checkoutReturnedSuccess =
    paymentStatus === "sucesso" ||
    getCheckoutReturnStatus(subscription) === "sucesso" ||
    isPaidProviderStatus(subscription?.provider_status);
  const isWaitingAutomaticConfirmation = checkoutReturnedSuccess && subscription?.status === "pending";
  const showPageMessage = message && !(message.type === "success" && isWaitingAutomaticConfirmation);
  const statusLabel =
    isWaitingAutomaticConfirmation
      ? "Pagamento confirmado"
      : subscriptionStatusLabels[subscription?.status ?? "trialing"];
  const checkoutUrl = checkoutExpired || checkoutReturnedSuccess ? null : getStoredCheckoutUrl(subscription);
  const pendingPlanChange = getPendingPlanChange(subscription);
  const pendingPlan = pendingPlanChange ? getSubscriptionPlan(pendingPlanChange.planId) : null;
  const managedActiveSubscription = isManagedActiveSubscription(subscription);

  async function handlePlanAction(planId: PlanId) {
    if (shouldRequestPlanChange(subscription, planId, selectedBillingCycle, currentPlanId, currentBillingCycle)) {
      await handlePlanChangeRequest(planId);
      return;
    }

    await handleCheckout(planId);
  }

  async function handlePlanChangeRequest(planId: PlanId) {
    setBusyPlanId(planId);
    setMessage(null);

    try {
      const response = await fetch("/api/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: selectedBillingCycle }),
      });
      const payload = (await response.json().catch(() => null)) as {
        subscription?: BusinessSubscriptionRecord;
        error?: string;
      } | null;

      if (!response.ok || !payload?.subscription) {
        throw new Error(payload?.error ?? "Nao foi possivel registrar a solicitacao.");
      }

      setSubscription(payload.subscription);
      setCurrentPlanId(payload.subscription.plan_id);
      setMessage({
        type: "success",
        text: "Solicitacao registrada. A alteracao sera revisada para o fim do ciclo atual.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Nao foi possivel registrar a solicitacao.",
      });
    } finally {
      setBusyPlanId(null);
    }
  }

  async function handleCheckout(planId: PlanId) {
    if (planId === currentPlanId && selectedBillingCycle === currentBillingCycle && checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }

    setBusyPlanId(planId);
    setMessage(null);

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: selectedBillingCycle }),
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
      setSelectedBillingCycle(payload.subscription.billing_cycle);
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível criar o checkout do Asaas.",
      });
      setBusyPlanId(null);
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
        {showPageMessage && <AuthNotice type={message.type} message={message.text} />}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="border-primary/10 bg-white shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeading
                  title="Plano atual"
                  icon={CreditCard}
                  description="Resumo da assinatura e da proxima cobranca."
                />
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                    getStatusBadgeClass(subscription, checkoutReturnedSuccess),
                  )}
                >
                  <BadgeCheck className="size-3.5" />
                  {statusLabel}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <SummaryTile
                  icon={BadgeCheck}
                  label="Plano"
                  value={currentPlan.name}
                  helper={getPlanPriceLabel(currentPlan, currentBillingCycle)}
                />
                <SummaryTile
                  icon={RefreshCw}
                  label="Ciclo"
                  value={getBillingCycleTitle(currentBillingCycle)}
                  helper={getPlanCycleHelper(currentPlan, currentBillingCycle)}
                />
                <SummaryTile
                  label="Próxima data"
                  value={formatDate(subscription?.current_period_ends_at ?? subscription?.renews_at) ?? "Pendente"}
                  helper={managedActiveSubscription ? "Renovação ou fim do ciclo" : "Confirmada após pagamento"}
                />
              </div>

              {isWaitingAutomaticConfirmation && (
                <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Pagamento confirmado no Asaas. A assinatura será ativada assim que a confirmação automática chegar
                    ao sistema.
                  </p>
                </div>
              )}

              {pendingPlanChange && pendingPlan && (
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <ClipboardCheck className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-900">
                      Alteração solicitada para {pendingPlan.name} ({getBillingCycleLabel(pendingPlanChange.billingCycle)}).
                    </p>
                    <p className="mt-1">
                      Aplicação prevista para o fim do ciclo atual{getPeriodEndLabel(subscription)}.
                    </p>
                  </div>
                </div>
              )}

              {checkoutUrl && (
                <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <WalletCards className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p>Checkout Asaas criado. Continue por aqui se o pagamento ainda não foi concluído.</p>
                  </div>
                  <Button className="w-full sm:w-auto" type="button" onClick={() => void handleCheckout(currentPlanId)}>
                    <ExternalLink className="size-4" />
                    Continuar no Asaas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="border-b border-slate-100 pb-5">
                <SectionHeading
                  title="Uso do plano"
                  icon={WalletCards}
                  description="Acompanhe os limites disponiveis neste plano."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <UsageTile
                  icon={Users}
                  label="Profissionais"
                  current={usage.professionalsCount}
                  limit={maxProfessionals}
                />
                <UsageTile label="Serviços" current={usage.servicesCount} limit={maxServices} />
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="Planos"
              title="Escolha o plano"
              description={
                managedActiveSubscription
                  ? "Alterações em assinatura ativa ficam pendentes para o fim do ciclo."
                  : "Ao selecionar outro plano, o checkout do Asaas abre automaticamente."
              }
            />

            <div className="w-full max-w-xs">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ciclo de cobrança</p>
              <div className="grid grid-cols-2 rounded-lg border bg-white p-1 text-sm">
                {[
                  ["monthly", "Mensal"],
                  ["annual", "Anual"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedBillingCycle(id as BillingCycle)}
                    className={cn(
                      "rounded-md px-4 py-2 font-medium transition",
                      selectedBillingCycle === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {subscriptionPlans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const isBusy = busyPlanId === plan.id;
                const isOverProfessionals = usage.professionalsCount > plan.maxProfessionals;
                const isOverServices = usage.servicesCount > plan.maxServices;
                const isCurrentCycle = isCurrent && selectedBillingCycle === currentBillingCycle;
                const canContinueCheckout = isCurrentCycle && Boolean(checkoutUrl);
                const canRegenerateCheckout = isCurrentCycle && checkoutExpired;
                const shouldRequestChange = shouldRequestPlanChange(
                  subscription,
                  plan.id,
                  selectedBillingCycle,
                  currentPlanId,
                  currentBillingCycle,
                );
                const isPendingRequest =
                  pendingPlanChange?.planId === plan.id && pendingPlanChange.billingCycle === selectedBillingCycle;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex min-h-[430px] flex-col rounded-lg border bg-white p-5 shadow-sm transition",
                      isCurrent ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/40",
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
                    <p className="mt-5 text-3xl font-semibold text-slate-950">
                      {getPlanPriceLabel(plan, selectedBillingCycle)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {getPlanCycleHelper(plan, selectedBillingCycle)}
                    </p>

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
                      variant={isCurrentCycle && !canContinueCheckout ? "secondary" : "default"}
                      disabled={
                        isPendingRequest ||
                        (isCurrentCycle && !canContinueCheckout && !canRegenerateCheckout) ||
                        busyPlanId !== null
                      }
                      onClick={() => void handlePlanAction(plan.id)}
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : shouldRequestChange ? (
                        <ClipboardCheck className="size-4" />
                      ) : canContinueCheckout || canRegenerateCheckout || !isCurrent ? (
                        <ExternalLink className="size-4" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {isBusy
                        ? shouldRequestChange
                          ? "Registrando..."
                          : "Abrindo Asaas..."
                        : isPendingRequest
                          ? "Solicitado"
                        : canContinueCheckout
                          ? "Continuar no Asaas"
                          : isCurrent
                            ? canRegenerateCheckout
                              ? "Gerar novo checkout"
                              : isCurrentCycle
                                ? "Plano atual"
                                : shouldRequestChange
                                  ? "Solicitar alteração"
                                  : "Alterar ciclo no Asaas"
                            : shouldRequestChange
                              ? "Solicitar alteração"
                              : "Selecionar e abrir Asaas"}
                    </Button>
                  </div>
                );
              })}
            </div>
        </section>
      </div>
    </AdminShell>
  );
}

function SummaryTile({
  icon: Icon = CalendarClock,
  label,
  value,
  helper,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border border-primary/15 bg-secondary/50 p-4">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
        <Icon className="size-4" />
      </div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <strong className="mt-2 block text-lg leading-tight text-slate-950">{value}</strong>
      {helper && <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>}
    </div>
  );
}

function UsageTile({
  icon: Icon = ClipboardCheck,
  label,
  current,
  limit,
}: {
  icon?: LucideIcon;
  label: string;
  current: number;
  limit: number;
}) {
  const percentage = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;

  return (
    <div className="rounded-lg border border-primary/15 bg-secondary/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
            <Icon className="size-4" />
          </span>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <strong className="text-2xl text-slate-950">
          {current}/{limit}
        </strong>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

type PendingPlanChangeView = {
  planId: PlanId;
  billingCycle: BillingCycle;
  requestedAt: string | null;
};

function shouldRequestPlanChange(
  subscription: BusinessSubscriptionRecord | null,
  planId: PlanId,
  billingCycle: BillingCycle,
  currentPlanId: PlanId,
  currentBillingCycle: BillingCycle,
) {
  return isManagedActiveSubscription(subscription) && (planId !== currentPlanId || billingCycle !== currentBillingCycle);
}

function isManagedActiveSubscription(subscription: BusinessSubscriptionRecord | null) {
  return (
    subscription?.status === "active" &&
    Boolean(subscription.provider === "asaas" || subscription.provider_subscription_id || subscription.provider_checkout_id)
  );
}

function getPendingPlanChange(subscription: BusinessSubscriptionRecord | null): PendingPlanChangeView | null {
  const metadata = subscription?.metadata;

  if (!isRecord(metadata)) {
    return null;
  }

  const change = metadata.pending_plan_change;

  if (!isRecord(change) || getString(change.status) !== "requested") {
    return null;
  }

  const planId = getString(change.requested_plan_id ?? change.plan_id);
  const billingCycle = getString(change.requested_billing_cycle ?? change.billing_cycle);

  if (!isPlanId(planId) || !isBillingCycle(billingCycle)) {
    return null;
  }

  return {
    planId,
    billingCycle,
    requestedAt: getString(change.requested_at),
  };
}

function getStatusBadgeClass(subscription: BusinessSubscriptionRecord | null, checkoutReturnedSuccess: boolean) {
  if (checkoutReturnedSuccess && subscription?.status === "pending") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (subscription?.status === "active") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (subscription?.status === "past_due") {
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  }

  if (subscription?.status === "canceled") {
    return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }

  return "bg-primary/10 text-primary ring-1 ring-primary/15";
}

function getBillingCycleTitle(billingCycle: BillingCycle) {
  return billingCycle === "annual" ? "Anual" : "Mensal";
}

function getBillingCycleLabel(billingCycle: BillingCycle) {
  return billingCycle === "annual" ? "anual" : "mensal";
}

function getPeriodEndLabel(subscription: BusinessSubscriptionRecord | null) {
  const label = formatDate(subscription?.current_period_ends_at ?? subscription?.renews_at);
  return label ? ` (${label})` : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function isPlanId(value: string | null): value is PlanId {
  return subscriptionPlans.some((plan) => plan.id === value);
}

function isBillingCycle(value: string | null): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStoredCheckoutUrl(subscription: BusinessSubscriptionRecord | null) {
  if (
    !subscription?.provider_checkout_id ||
    subscription.provider_subscription_id ||
    subscription.status === "active" ||
    isPaidProviderStatus(subscription.provider_status)
  ) {
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

function isPaidProviderStatus(status: string | null | undefined) {
  return (
    status === "CHECKOUT_SUCCESS" ||
    status === "CHECKOUT_PAID" ||
    status === "PAYMENT_CONFIRMED" ||
    status === "PAYMENT_RECEIVED"
  );
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
