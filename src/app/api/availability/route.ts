import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import { getAvailabilityForBusiness } from "@/lib/availability/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão obrigatória." }, { status: 401 });
  }

  const business = await getCurrentBusiness(user.id);

  if (!business) {
    return NextResponse.json({ error: "Estabelecimento não configurado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros inválidos." }, { status: 400 });
  }

  const result = await getAvailabilityForBusiness({
    businessId: business.id,
    professionalId: parsed.data.professionalId,
    serviceId: parsed.data.serviceId,
    date: parsed.data.date,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    slots: result.slots,
    durationMinutes: result.durationMinutes,
    emptyReason: result.emptyReason ?? null,
  });
}
