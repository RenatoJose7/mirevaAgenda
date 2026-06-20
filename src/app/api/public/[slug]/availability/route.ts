import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicAvailability } from "@/lib/appointments/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros inválidos." }, { status: 400 });
  }

  try {
    const result = await getPublicAvailability({
      slug,
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível calcular disponibilidade." },
      { status: 500 },
    );
  }
}
