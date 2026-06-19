import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppointmentByToken, rescheduleAppointmentByToken } from "@/lib/appointments/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function GET(_request: Request, context: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await context.params;
  const appointment = await getAppointmentByToken(slug, token, "reschedule");

  if (!appointment) {
    return NextResponse.json({ error: "Reserva nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ appointment });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Data ou horario invalido." }, { status: 400 });
  }

  const result = await rescheduleAppointmentByToken({
    slug,
    token,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ appointment: result.appointment });
}
