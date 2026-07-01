import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { BusinessSubscriptionRecord } from "@/lib/business/types";
import { getPaymentPreparationConfig } from "@/lib/payments/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const subscriptionSelect =
  "id,business_id,plan_id,billing_cycle,status,max_professionals,max_services,current_period_started_at,current_period_ends_at,trial_ends_at,provider,provider_customer_id,provider_subscription_id,provider_plan_id,provider_checkout_id,provider_payment_method,provider_status,started_at,renews_at,cancel_requested_at,cancel_at_period_end,metadata,canceled_at,created_at,updated_at";

type AdminClient = ReturnType<typeof createAdminClient>;
type SubscriptionRow = BusinessSubscriptionRecord;
type ProcessingStatus = "received" | "ignored" | "processed" | "failed";

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: Record<string, unknown>;
  subscription?: Record<string, unknown>;
  checkout?: Record<string, unknown>;
};

export async function GET() {
  const config = getPaymentPreparationConfig();

  return NextResponse.json({
    provider: config.provider,
    environment: config.environment,
    status: getWebhookStatus(config.webhooksEnabled),
    message: getWebhookStatusMessage(config.webhooksEnabled),
  });
}

export async function POST(request: Request) {
  const config = getPaymentPreparationConfig();

  if (!config.webhooksEnabled) {
    return NextResponse.json(
      {
        ok: true,
        status: "disabled",
        message: "Webhook recebido, mas a integracao de pagamento esta desativada.",
      },
      { status: 202 },
    );
  }

  const webhookToken = normalizeSecret(process.env.ASAAS_WEBHOOK_TOKEN);

  if (!webhookToken) {
    return NextResponse.json(
      { ok: false, status: "missing_token", message: "Configure ASAAS_WEBHOOK_TOKEN para processar webhooks." },
      { status: 500 },
    );
  }

  if (!isValidWebhookToken(request.headers.get("asaas-access-token"), webhookToken)) {
    return NextResponse.json({ ok: false, status: "forbidden" }, { status: 403 });
  }

  const rawBody = await request.text();
  const payload = parseWebhookPayload(rawBody);

  if (!payload?.event) {
    return NextResponse.json({ ok: false, status: "invalid_payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const providerEventId = getString(payload.id);
  const existingEvent = providerEventId ? await findExistingWebhookEvent(admin, providerEventId) : null;

  if (existingEvent && existingEvent.processing_status !== "failed") {
    return NextResponse.json({ ok: true, status: "duplicate", eventId: existingEvent.id });
  }

  const subscription = await findMatchingSubscription(admin, payload);
  const webhookEventId =
    existingEvent?.id ??
    (await createWebhookEvent(admin, {
      payload,
      rawBody,
      headers: request.headers,
      subscription,
    }));

  try {
    if (!subscription) {
      await markWebhookEvent(admin, webhookEventId, "ignored", "Assinatura local nao encontrada para o evento.");
      return NextResponse.json({ ok: true, status: "ignored", reason: "subscription_not_found" });
    }

    const update = buildSubscriptionUpdate(subscription, payload);

    if (!update) {
      await markWebhookEvent(admin, webhookEventId, "ignored", "Evento sem efeito para assinatura.");
      return NextResponse.json({ ok: true, status: "ignored", reason: "event_has_no_subscription_effect" });
    }

    const { error } = await admin.from("business_subscriptions").update(update).eq("id", subscription.id);

    if (error) {
      throw new Error(error.message);
    }

    await markWebhookEvent(admin, webhookEventId, "processed");
    return NextResponse.json({ ok: true, status: "processed" });
  } catch (error) {
    await markWebhookEvent(
      admin,
      webhookEventId,
      "failed",
      error instanceof Error ? error.message : "Erro desconhecido ao processar webhook.",
    );

    return NextResponse.json({ ok: false, status: "failed" }, { status: 500 });
  }
}

function getWebhookStatus(enabled: boolean) {
  if (!enabled) {
    return "disabled";
  }

  return normalizeSecret(process.env.ASAAS_WEBHOOK_TOKEN) ? "ready" : "missing_token";
}

function getWebhookStatusMessage(enabled: boolean) {
  if (!enabled) {
    return "Webhook de pagamento preparado e desativado.";
  }

  if (!normalizeSecret(process.env.ASAAS_WEBHOOK_TOKEN)) {
    return "Webhook ativado, mas ASAAS_WEBHOOK_TOKEN nao esta configurado.";
  }

  return "Webhook de pagamento ativo e pronto para processar eventos do Asaas.";
}

function parseWebhookPayload(rawBody: string): AsaasWebhookPayload | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  return parsed as AsaasWebhookPayload;
}

async function findExistingWebhookEvent(admin: AdminClient, providerEventId: string) {
  const { data } = await admin
    .from("payment_webhook_events")
    .select("id,processing_status")
    .eq("provider", "asaas")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  return (data as { id: string; processing_status: ProcessingStatus } | null) ?? null;
}

async function createWebhookEvent(
  admin: AdminClient,
  input: {
    payload: AsaasWebhookPayload;
    rawBody: string;
    headers: Headers;
    subscription: SubscriptionRow | null;
  },
) {
  const { data, error } = await admin
    .from("payment_webhook_events")
    .insert({
      provider: "asaas",
      provider_event_id: getString(input.payload.id),
      event_type: input.payload.event ?? "UNKNOWN",
      business_id: input.subscription?.business_id ?? null,
      subscription_id: input.subscription?.id ?? null,
      payload: input.payload,
      headers: redactHeaders(input.headers),
      signature_hash: createHash("sha256").update(input.rawBody).digest("hex"),
      processing_status: "received",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Nao foi possivel registrar o webhook.");
  }

  return data.id as string;
}

async function markWebhookEvent(
  admin: AdminClient,
  webhookEventId: string,
  status: Exclude<ProcessingStatus, "received">,
  errorMessage?: string,
) {
  await admin
    .from("payment_webhook_events")
    .update({
      processing_status: status,
      processed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    })
    .eq("id", webhookEventId);
}

async function findMatchingSubscription(admin: AdminClient, payload: AsaasWebhookPayload) {
  const localSubscriptionId = getLocalSubscriptionId(payload);

  if (localSubscriptionId) {
    const subscription = await findSubscriptionBy(admin, "id", localSubscriptionId);

    if (subscription) {
      return subscription;
    }
  }

  const providerSubscriptionId = getProviderSubscriptionId(payload);

  if (providerSubscriptionId) {
    const subscription = await findSubscriptionBy(admin, "provider_subscription_id", providerSubscriptionId);

    if (subscription) {
      return subscription;
    }
  }

  const checkoutId = getCheckoutId(payload);

  if (checkoutId) {
    const subscription = await findSubscriptionBy(admin, "provider_checkout_id", checkoutId);

    if (subscription) {
      return subscription;
    }
  }

  const customerId = getCustomerId(payload);

  if (customerId) {
    const { data } = await admin
      .from("business_subscriptions")
      .select(subscriptionSelect)
      .eq("provider", "asaas")
      .eq("provider_customer_id", customerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (data as SubscriptionRow | null) ?? null;
  }

  return null;
}

async function findSubscriptionBy(admin: AdminClient, column: string, value: string) {
  const { data } = await admin
    .from("business_subscriptions")
    .select(subscriptionSelect)
    .eq("provider", "asaas")
    .eq(column, value)
    .maybeSingle();

  return (data as SubscriptionRow | null) ?? null;
}

function buildSubscriptionUpdate(subscription: SubscriptionRow, payload: AsaasWebhookPayload) {
  const event = payload.event;

  if (!event) {
    return null;
  }

  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  const providerSubscriptionId = getProviderSubscriptionId(payload);
  const checkoutId = getCheckoutId(payload);
  const customerId = getCustomerId(payload);
  const subscriptionCycle = getSubscriptionCycle(payload);
  const nextDueDate = getNextDueDate(payload);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    provider: "asaas",
    provider_status: event,
    metadata: {
      ...metadata,
      asaas_webhook: {
        last_event: event,
        last_event_id: getString(payload.id),
        last_received_at: now,
      },
    },
  };

  if (providerSubscriptionId) {
    update.provider_subscription_id = providerSubscriptionId;
  }

  if (checkoutId) {
    update.provider_checkout_id = checkoutId;
  }

  if (customerId) {
    update.provider_customer_id = customerId;
  }

  if (subscriptionCycle) {
    update.billing_cycle = subscriptionCycle;
  }

  if (nextDueDate) {
    update.renews_at = nextDueDate;
    update.current_period_ends_at = nextDueDate;
  }

  if (isActiveEvent(payload)) {
    update.status = "active";
    update.started_at = subscription.started_at ?? now;
    update.current_period_started_at = subscription.current_period_started_at ?? now;
    update.trial_ends_at = null;
    update.canceled_at = null;
    update.cancel_requested_at = null;
    update.cancel_at_period_end = false;
    return update;
  }

  if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED") {
    update.status = "past_due";
    return update;
  }

  if (event === "SUBSCRIPTION_INACTIVATED" || event === "SUBSCRIPTION_DELETED") {
    update.status = "canceled";
    update.canceled_at = now;
    update.cancel_requested_at = subscription.cancel_requested_at ?? now;
    update.cancel_at_period_end = false;
    return update;
  }

  if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED") {
    update.status = "past_due";
    return update;
  }

  return update;
}

function isActiveEvent(payload: AsaasWebhookPayload) {
  const event = payload.event;
  const subscriptionStatus = getString(payload.subscription?.status);

  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED" || event === "CHECKOUT_PAID") {
    return true;
  }

  return (event === "SUBSCRIPTION_CREATED" || event === "SUBSCRIPTION_UPDATED") && subscriptionStatus === "ACTIVE";
}

function getLocalSubscriptionId(payload: AsaasWebhookPayload) {
  const references = [
    payload.checkout?.externalReference,
    payload.payment?.externalReference,
    payload.subscription?.externalReference,
    ...getCheckoutItemReferences(payload.checkout),
  ];

  for (const value of references) {
    const id = getUuidFromReference(getString(value));

    if (id) {
      return id;
    }
  }

  return null;
}

function getProviderSubscriptionId(payload: AsaasWebhookPayload) {
  return (
    getString(payload.subscription?.id) ??
    getString(payload.payment?.subscription) ??
    getString(getRecord(payload.checkout?.subscription)?.id)
  );
}

function getCheckoutId(payload: AsaasWebhookPayload) {
  return getString(payload.checkout?.id) ?? getString(payload.payment?.checkoutSession);
}

function getCustomerId(payload: AsaasWebhookPayload) {
  return getString(payload.checkout?.customer) ?? getString(payload.payment?.customer) ?? getString(payload.subscription?.customer);
}

function getSubscriptionCycle(payload: AsaasWebhookPayload) {
  const cycle =
    getString(payload.subscription?.cycle) ??
    getString(getRecord(payload.checkout?.subscription)?.cycle) ??
    getString(payload.payment?.cycle);

  if (cycle === "YEARLY") {
    return "annual";
  }

  if (cycle === "MONTHLY") {
    return "monthly";
  }

  return null;
}

function getNextDueDate(payload: AsaasWebhookPayload) {
  return (
    normalizeAsaasDate(payload.subscription?.nextDueDate) ??
    normalizeAsaasDate(getRecord(payload.checkout?.subscription)?.nextDueDate) ??
    normalizeAsaasDate(payload.payment?.dueDate)
  );
}

function getCheckoutItemReferences(checkout: Record<string, unknown> | undefined) {
  const items = checkout?.items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => (isRecord(item) ? [item.externalReference] : []));
}

function getUuidFromReference(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match?.[0] ?? null;
}

function normalizeAsaasDate(value: unknown) {
  const raw = getString(value);

  if (!raw) {
    return null;
  }

  const brDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brDate) {
    const [, day, month, year] = brDate;
    return new Date(`${year}-${month}-${day}T23:59:59.000Z`).toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T23:59:59.000Z`).toISOString();
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function redactHeaders(headers: Headers) {
  const result: Record<string, string> = {};

  for (const [key, value] of headers.entries()) {
    result[key] = ["authorization", "cookie", "asaas-access-token"].includes(key.toLowerCase()) ? "[redacted]" : value;
  }

  return result;
}

function isValidWebhookToken(receivedToken: string | null, expectedToken: string) {
  const received = normalizeSecret(receivedToken);

  if (!received) {
    return false;
  }

  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expectedToken).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

function normalizeSecret(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
