import { NextResponse } from "next/server";
import { cancelAppointmentByToken, getAppointmentByToken } from "@/lib/appointments/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await context.params;
  const appointment = await getAppointmentByToken(slug, token, "cancel");

  if (!appointment) {
    return NextResponse.json({ error: "Reserva nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ appointment });
}

export async function POST(_request: Request, context: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await context.params;
  const result = await cancelAppointmentByToken({ slug, token });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ appointment: result.appointment });
}
