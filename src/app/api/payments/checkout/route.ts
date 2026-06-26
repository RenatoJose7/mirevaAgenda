import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import type { BusinessSubscriptionRecord } from "@/lib/business/types";
import { AsaasApiError, createAsaasCheckout } from "@/lib/payments/asaas";
import { getSubscriptionPlan, planIds } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  planId: z.enum(planIds),
  billingCycle: z.enum(["monthly", "annual"]).optional(),
});

const CHECKOUT_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const subscriptionSelect =
  "id,business_id,plan_id,billing_cycle,status,max_professionals,max_services,current_period_started_at,current_period_ends_at,trial_ends_at,provider,provider_customer_id,provider_subscription_id,provider_plan_id,provider_checkout_id,provider_payment_method,provider_status,started_at,renews_at,cancel_requested_at,cancel_at_period_end,metadata,canceled_at,created_at,updated_at";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente para assinar." }, { status: 401 });
  }

  const business = await getCurrentBusiness(user.id);

  if (!business) {
    return NextResponse.json({ error: "Configure o estabelecimento antes de assinar um plano." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Escolha um plano válido para continuar." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Apenas o proprietário pode assinar ou alterar o plano." }, { status: 403 });
  }

  const { data: remotePlan } = await admin
    .from("subscription_plans")
    .select("id,is_active")
    .eq("id", parsed.data.planId)
    .eq("is_active", true)
    .maybeSingle();

  if (!remotePlan) {
    return NextResponse.json({ error: "Este plano não está disponível." }, { status: 404 });
  }

  const { data: currentSubscription } = await admin
    .from("business_subscriptions")
    .select(subscriptionSelect)
    .eq("business_id", business.id)
    .maybeSingle();

  const billingCycle = parsed.data.billingCycle ?? currentSubscription?.billing_cycle ?? "monthly";
  const plan = getSubscriptionPlan(parsed.data.planId);
  const priceCents = billingCycle === "annual" ? plan.annualPriceCents : plan.priceCents;
  const nextDueDate = getNextDueDate(currentSubscription as BusinessSubscriptionRecord | null, billingCycle);

  const { data: preparedSubscription, error: prepareError } = await admin
    .from("business_subscriptions")
    .upsert(
      {
        business_id: business.id,
        plan_id: parsed.data.planId,
        billing_cycle: billingCycle,
        status: "pending",
        provider: "asaas",
        provider_payment_method: "checkout",
        started_at: currentSubscription?.started_at ?? new Date().toISOString(),
        renews_at: new Date(`${nextDueDate}T23:59:59.000Z`).toISOString(),
      },
      { onConflict: "business_id" },
    )
    .select(subscriptionSelect)
    .single();

  if (prepareError || !preparedSubscription) {
    return NextResponse.json({ error: "Não foi possível preparar a assinatura." }, { status: 500 });
  }

  try {
    const origin = new URL(request.url).origin;
    const checkout = await createAsaasCheckout({
      billingTypes: ["CREDIT_CARD", "PIX"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 1440,
      externalReference: preparedSubscription.id,
      callback: {
        successUrl: `${origin}/configuracoes?pagamento=sucesso`,
        cancelUrl: `${origin}/configuracoes?pagamento=cancelado`,
        expiredUrl: `${origin}/configuracoes?pagamento=expirado`,
      },
      items: [
        {
          name: `Mireva ${plan.name}`.slice(0, 30),
          description: `Plano ${plan.name} do Mireva Agenda`,
          quantity: 1,
          value: centsToReais(priceCents),
          imageBase64: CHECKOUT_IMAGE_BASE64,
          externalReference: `${preparedSubscription.id}:${plan.id}`,
        },
      ],
      customerData: {
        name: business.name,
        email: user.email ?? undefined,
        phone: onlyDigits(business.whatsapp),
      },
      subscription: {
        cycle: billingCycle === "annual" ? "YEARLY" : "MONTHLY",
        nextDueDate,
      },
    });

    const checkoutUrl = checkout.link || buildFallbackCheckoutUrl(checkout.id);
    const { data: subscription, error: updateError } = await admin
      .from("business_subscriptions")
      .update({
        provider: "asaas",
        provider_checkout_id: checkout.id,
        provider_payment_method: checkout.billingTypes?.join(",") || "checkout",
        provider_status: checkout.status ?? "ACTIVE",
        metadata: {
          ...(isRecord(preparedSubscription.metadata) ? preparedSubscription.metadata : {}),
          asaas_checkout: {
            id: checkout.id,
            link: checkoutUrl,
            plan_id: plan.id,
            billing_cycle: billingCycle,
            next_due_date: nextDueDate,
            requested_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", preparedSubscription.id)
      .select(subscriptionSelect)
      .single();

    if (updateError || !subscription) {
      return NextResponse.json({ error: "Checkout criado, mas não foi possível salvar a assinatura." }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl, subscription });
  } catch (error) {
    if (error instanceof AsaasApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    return NextResponse.json({ error: "Não foi possível criar o checkout do Asaas." }, { status: 500 });
  }
}

function getNextDueDate(subscription: BusinessSubscriptionRecord | null, billingCycle: "monthly" | "annual") {
  const trialDate = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;

  if (trialDate && trialDate.getTime() > Date.now()) {
    return toDateInput(trialDate);
  }

  const date = new Date();
  date.setDate(date.getDate() + (billingCycle === "annual" ? 30 : 7));
  return toDateInput(date);
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function centsToReais(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function onlyDigits(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "");
  return digits || undefined;
}

function buildFallbackCheckoutUrl(id: string) {
  const environment = process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox";
  const baseUrl = environment === "production" ? "https://asaas.com" : "https://sandbox.asaas.com";
  return `${baseUrl}/checkoutSession/show/${id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
