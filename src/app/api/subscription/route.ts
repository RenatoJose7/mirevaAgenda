import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import { planIds } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  planId: z.enum(planIds),
});

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
    .select("status")
    .eq("business_id", business.id)
    .maybeSingle();

  const { data: subscription, error } = await admin
    .from("business_subscriptions")
    .upsert(
      {
        business_id: business.id,
        plan_id: parsed.data.planId,
        status: currentSubscription?.status ?? "trialing",
      },
      { onConflict: "business_id" },
    )
    .select(
      "id,business_id,plan_id,status,max_professionals,max_services,current_period_started_at,current_period_ends_at,trial_ends_at,provider,provider_customer_id,provider_subscription_id,provider_plan_id,provider_checkout_id,provider_payment_method,provider_status,started_at,renews_at,cancel_requested_at,cancel_at_period_end,metadata,canceled_at,created_at,updated_at",
    )
    .single();

  if (error || !subscription) {
    return NextResponse.json({ error: "Não foi possível alterar o plano agora." }, { status: 500 });
  }

  return NextResponse.json({ subscription });
}
