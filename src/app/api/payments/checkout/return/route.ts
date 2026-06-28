import { NextRequest, NextResponse } from "next/server";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CheckoutReturnStatus = "sucesso" | "cancelado" | "expirado";

const subscriptionSelect = "id,metadata,provider_checkout_id,provider_subscription_id";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const paymentStatus = normalizePaymentStatus(url.searchParams.get("pagamento"));
  const token = url.searchParams.get("token");

  if (paymentStatus) {
    await recordCheckoutReturn(paymentStatus, token).catch(() => undefined);
  }

  const redirectUrl = new URL("/assinatura", url.origin);

  if (paymentStatus) {
    redirectUrl.searchParams.set("pagamento", paymentStatus);
  }

  return NextResponse.redirect(redirectUrl);
}

async function recordCheckoutReturn(paymentStatus: CheckoutReturnStatus, token: string | null) {
  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  const business = await getCurrentBusiness(user.id);

  if (!business) {
    return;
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "owner") {
    return;
  }

  const { data: subscription } = await admin
    .from("business_subscriptions")
    .select(subscriptionSelect)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!subscription?.provider_checkout_id || subscription.provider_subscription_id) {
    return;
  }

  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  const checkout = isRecord(metadata.asaas_checkout) ? metadata.asaas_checkout : {};
  const expectedToken = typeof checkout.return_token === "string" ? checkout.return_token : null;

  if (!token || token !== expectedToken) {
    return;
  }

  await admin
    .from("business_subscriptions")
    .update({
      provider_status: getProviderStatus(paymentStatus),
      metadata: {
        ...metadata,
        asaas_checkout: {
          ...checkout,
          return_status: paymentStatus,
          returned_at: new Date().toISOString(),
        },
      },
    })
    .eq("id", subscription.id);
}

function normalizePaymentStatus(value: string | null): CheckoutReturnStatus | null {
  if (value === "sucesso" || value === "cancelado" || value === "expirado") {
    return value;
  }

  return null;
}

function getProviderStatus(status: CheckoutReturnStatus) {
  if (status === "sucesso") {
    return "CHECKOUT_SUCCESS";
  }

  if (status === "cancelado") {
    return "CHECKOUT_CANCELLED";
  }

  return "CHECKOUT_EXPIRED";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
