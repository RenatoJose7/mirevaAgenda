export const paymentProviders = ["asaas"] as const;

export type PaymentProvider = (typeof paymentProviders)[number];
export type PaymentEnvironment = "sandbox" | "production";

export function getPaymentPreparationConfig() {
  const provider = normalizeProvider(process.env.PAYMENT_PROVIDER);
  const environment = normalizeEnvironment(process.env.ASAAS_ENVIRONMENT);
  const apiUrl = normalizeAsaasApiUrl(process.env.ASAAS_API_URL, environment);

  return {
    provider,
    environment,
    asaasApiUrl: apiUrl,
    webhooksEnabled: process.env.PAYMENT_WEBHOOKS_ENABLED === "true",
    hasApiKey: Boolean(process.env.ASAAS_API_KEY),
    hasWebhookToken: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
  };
}

function normalizeProvider(value: string | undefined): PaymentProvider {
  return paymentProviders.includes(value as PaymentProvider) ? (value as PaymentProvider) : "asaas";
}

function normalizeEnvironment(value: string | undefined): PaymentEnvironment {
  return value === "production" ? "production" : "sandbox";
}

export function normalizeAsaasApiUrl(value: string | undefined, environment: PaymentEnvironment) {
  const fallback = environment === "production" ? "https://api.asaas.com" : "https://api-sandbox.asaas.com";
  return (value || fallback).replace(/\/+$/, "");
}
