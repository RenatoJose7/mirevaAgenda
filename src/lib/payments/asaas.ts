import { getPaymentPreparationConfig } from "@/lib/payments/config";

export type AsaasCheckoutResponse = {
  id: string;
  link?: string;
  status?: string;
  billingTypes?: string[];
  chargeTypes?: string[];
  externalReference?: string;
};

export type AsaasCheckoutPayload = {
  billingTypes: Array<"CREDIT_CARD" | "PIX">;
  chargeTypes: Array<"RECURRENT">;
  minutesToExpire: number;
  externalReference: string;
  callback: {
    successUrl: string;
    cancelUrl: string;
    expiredUrl: string;
  };
  items: Array<{
    name: string;
    description: string;
    quantity: number;
    value: number;
    imageBase64: string;
    externalReference: string;
  }>;
  customerData?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  subscription: {
    cycle: "MONTHLY" | "YEARLY";
    nextDueDate: string;
  };
};

type AsaasErrorResponse = {
  errors?: Array<{ code?: string; description?: string }>;
};

export class AsaasApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.code = code;
  }
}

export async function createAsaasCheckout(payload: AsaasCheckoutPayload) {
  return asaasRequest<AsaasCheckoutResponse>("/v3/checkouts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function asaasRequest<T>(path: string, init: RequestInit = {}) {
  const config = getPaymentPreparationConfig();
  const apiKey = normalizeAsaasApiKey(process.env.ASAAS_API_KEY);

  if (!apiKey) {
    throw new AsaasApiError("Configure ASAAS_API_KEY no .env.local para criar o checkout.", 500, "missing_api_key");
  }

  const response = await fetch(`${config.asaasApiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "MirevaAgenda/1.0.0",
      access_token: apiKey,
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as (AsaasErrorResponse & T) | null;

  if (!response.ok) {
    const firstError = payload?.errors?.[0];
    throw new AsaasApiError(
      firstError?.description || "Não foi possível comunicar com o Asaas.",
      response.status,
      firstError?.code,
    );
  }

  return payload as T;
}

function normalizeAsaasApiKey(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("\\$") ? trimmed.slice(1) : trimmed;
}
