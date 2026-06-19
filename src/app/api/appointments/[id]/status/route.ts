import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import { updateAppointmentStatus } from "@/lib/appointments/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "no_show", "completed"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessao obrigatoria." }, { status: 401 });
  }

  const business = await getCurrentBusiness(user.id);

  if (!business) {
    return NextResponse.json({ error: "Estabelecimento obrigatorio." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  const result = await updateAppointmentStatus({
    businessId: business.id,
    appointmentId: id,
    status: parsed.data.status,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ appointment: result.appointment });
}
