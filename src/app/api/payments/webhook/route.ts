import { NextResponse } from "next/server";
import { getPaymentPreparationConfig } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getPaymentPreparationConfig();

  return NextResponse.json({
    provider: config.provider,
    environment: config.environment,
    status: config.webhooksEnabled ? "prepared" : "disabled",
    message: config.webhooksEnabled
      ? "Webhook preparado, mas o processamento do gateway ainda não foi ativado."
      : "Webhook de pagamento preparado e desativado.",
  });
}

export async function POST(request: Request) {
  const config = getPaymentPreparationConfig();

  if (!config.webhooksEnabled) {
    return NextResponse.json(
      {
        ok: true,
        status: "disabled",
        message: "Webhook recebido, mas a integração de pagamento ainda está desativada.",
      },
      { status: 202 },
    );
  }

  await request.text().catch(() => "");

  return NextResponse.json(
    {
      ok: false,
      status: "not_implemented",
      message: "Webhook preparado. O processamento real será implementado na etapa de integração do gateway.",
    },
    { status: 501 },
  );
}
