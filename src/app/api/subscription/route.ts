import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import type { BusinessSubscriptionRecord } from "@/lib/business/types";
import { planIds, type BillingCycle, type PlanId } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  planId: z.enum(planIds),
  billingCycle: z.enum(["monthly", "annual"]).optional(),
});

const subscriptionSelect =
  "id,business_id,plan_id,billing_cycle,status,max_professionals,max_services,current_period_started_at,current_period_ends_at,trial_ends_at,provider,provider_customer_id,provider_subscription_id,provider_plan_id,provider_checkout_id,provider_payment_method,provider_status,started_at,renews_at,cancel_requested_at,cancel_at_period_end,metadata,canceled_at,created_at,updated_at";

type PendingPlanChange = {
  type: "plan_change";
  status: "requested";
  requested_plan_id: PlanId;
  requested_billing_cycle: BillingCycle;
  current_plan_id: PlanId;
  current_billing_cycle: BillingCycle;
  requested_at: string;
  requested_by: string;
  apply_timing: "period_end";
};

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente para alterar o plano." }, { status: 401 });
  }

  const business = await getCurrentBusiness(user.id);

  if (!business) {
    return NextResponse.json({ error: "Configure o estabelecimento antes de alterar o plano." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Escolha um plano válido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Apenas o proprietário pode alterar o plano." }, { status: 403 });
  }

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("id")
    .eq("id", parsed.data.planId)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ error: "Este plano não está disponível." }, { status: 404 });
  }

  const { data: currentSubscription } = await admin
    .from("business_subscriptions")
    .select(subscriptionSelect)
    .eq("business_id", business.id)
    .maybeSingle();
  const typedCurrentSubscription = (currentSubscription as BusinessSubscriptionRecord | null) ?? null;
  const billingCycle = parsed.data.billingCycle ?? typedCurrentSubscription?.billing_cycle ?? "monthly";

  if (typedCurrentSubscription && isManagedActiveSubscription(typedCurrentSubscription)) {
    if (typedCurrentSubscription.plan_id === parsed.data.planId && typedCurrentSubscription.billing_cycle === billingCycle) {
      return NextResponse.json({ subscription: typedCurrentSubscription, status: "unchanged" });
    }

    const metadata = isRecord(typedCurrentSubscription.metadata) ? typedCurrentSubscription.metadata : {};
    const pendingPlanChange: PendingPlanChange = {
      type: "plan_change",
      status: "requested",
      requested_plan_id: parsed.data.planId,
      requested_billing_cycle: billingCycle,
      current_plan_id: typedCurrentSubscription.plan_id,
      current_billing_cycle: typedCurrentSubscription.billing_cycle,
      requested_at: new Date().toISOString(),
      requested_by: user.id,
      apply_timing: "period_end",
    };

    const { data: subscription, error } = await admin
      .from("business_subscriptions")
      .update({
        metadata: {
          ...metadata,
          pending_plan_change: pendingPlanChange,
        },
      })
      .eq("id", typedCurrentSubscription.id)
      .select(subscriptionSelect)
      .single();

    if (error || !subscription) {
      return NextResponse.json({ error: "Nao foi possivel registrar a solicitacao agora." }, { status: 500 });
    }

    return NextResponse.json({ subscription, changeRequest: pendingPlanChange });
  }

  const nextSubscription: Record<string, unknown> = {
    business_id: business.id,
    plan_id: parsed.data.planId,
    billing_cycle: billingCycle,
    status: typedCurrentSubscription?.status ?? "trialing",
  };

  if (!typedCurrentSubscription?.provider_subscription_id) {
    Object.assign(nextSubscription, {
      provider: null,
      provider_checkout_id: null,
      provider_payment_method: null,
      provider_status: null,
      metadata: {},
    });
  }

  const { data: subscription, error } = await admin
    .from("business_subscriptions")
    .upsert(nextSubscription, { onConflict: "business_id" })
    .select(subscriptionSelect)
    .single();

  if (error || !subscription) {
    return NextResponse.json({ error: "Não foi possível alterar o plano agora." }, { status: 500 });
  }

  return NextResponse.json({ subscription });
}

function isManagedActiveSubscription(subscription: BusinessSubscriptionRecord) {
  return (
    subscription?.status === "active" &&
    Boolean(subscription.provider === "asaas" || subscription.provider_subscription_id || subscription.provider_checkout_id)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
