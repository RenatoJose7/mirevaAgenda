import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicAppointment } from "@/lib/appointments/server";
import { isValidBrazilianWhatsapp } from "@/lib/appointments/format";

export const dynamic = "force-dynamic";

const schema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().min(2).max(120),
  customerWhatsapp: z.string().min(8).max(40).refine(isValidBrazilianWhatsapp),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerNote: z.string().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe um WhatsApp válido para receber informações sobre sua reserva." }, { status: 400 });
  }

  try {
    const result = await createPublicAppointment({
      slug,
      serviceId: parsed.data.serviceId,
      professionalId: parsed.data.professionalId,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      customerName: parsed.data.customerName,
      customerWhatsapp: parsed.data.customerWhatsapp,
      customerEmail: parsed.data.customerEmail || null,
      customerNote: parsed.data.customerNote || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      appointment: {
        id: result.appointment.id,
        date: result.appointment.appointment_date,
        start_time: result.appointment.start_time,
        end_time: result.appointment.end_time,
        status: result.appointment.status,
        customer_name: result.appointment.customer_name,
        cancel_token: result.appointment.cancel_token,
        reschedule_token: result.appointment.reschedule_token,
      },
      business: result.business,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a reserva." },
      { status: 500 },
    );
  }
}
