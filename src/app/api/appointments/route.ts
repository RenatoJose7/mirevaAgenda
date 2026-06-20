import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import { isValidBrazilianWhatsapp } from "@/lib/appointments/format";
import { createInternalAppointment } from "@/lib/appointments/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().min(2).max(120),
  customerWhatsapp: z.string().min(8).max(40).refine(isValidBrazilianWhatsapp),
  customerEmail: z.string().email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão obrigatória." }, { status: 401 });
  }

  const business = await getCurrentBusiness(user.id);

  if (!business) {
    return NextResponse.json({ error: "Estabelecimento obrigatorio." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados do agendamento e informe um WhatsApp válido." }, { status: 400 });
  }

  const result = await createInternalAppointment({
    businessId: business.id,
    serviceId: parsed.data.serviceId,
    professionalId: parsed.data.professionalId,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    customerName: parsed.data.customerName,
    customerWhatsapp: parsed.data.customerWhatsapp,
    customerEmail: parsed.data.customerEmail || null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ appointment: result.appointment });
}
