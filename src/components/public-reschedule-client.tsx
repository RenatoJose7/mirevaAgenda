"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AuthNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AvailabilitySlot } from "@/lib/business/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PublicRescheduleClient({ slug, token }: { slug: string; token: string }) {
  const [appointment, setAppointment] = useState<{ service_id: string; professional_id: string; appointment_date: string; start_time: string } | null>(null);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [emptySlotsReason, setEmptySlotsReason] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/public/${slug}/reschedule/${token}`)
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ok) {
          setMessage({ type: "error", text: payload.error ?? "Reserva não encontrada." });
          return;
        }
        setAppointment(payload.appointment);
        setDate(payload.appointment.appointment_date);
      });
  }, [slug, token]);

  useEffect(() => {
    if (!appointment) return;
    fetch(`/api/public/${slug}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: appointment.service_id,
        professionalId: appointment.professional_id,
        date,
      }),
    })
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        setSlots(ok ? payload.slots : []);
        setEmptySlotsReason(ok ? payload.emptyReason ?? "" : payload.error ?? "Não foi possível calcular horários.");
      });
  }, [appointment, date, slug]);

  async function reschedule() {
    const response = await fetch(`/api/public/${slug}/reschedule/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startTime: time }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "Não foi possível remarcar." });
      return;
    }

    setMessage({ type: "success", text: "Reserva remarcada com sucesso." });
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <CalendarDays className="mb-3 size-8 text-primary" />
            <h1 className="text-3xl font-semibold text-slate-950">Remarcar reserva</h1>
            {appointment && (
              <p className="mt-2 text-sm text-muted-foreground">
                Reserva atual: {appointment.appointment_date} às {appointment.start_time.slice(0, 5)}
              </p>
            )}
          </div>
          {message && <AuthNotice type={message.type} message={message.text} />}
          <Input type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {slots.length === 0 ? (
              <p className="col-span-3 text-sm text-muted-foreground sm:col-span-6">
                {emptySlotsReason || "Nenhum horário disponível para remarcação."}
              </p>
            ) : (
              slots.map((slot) => (
                <Button key={slot.start_time} type="button" variant={time === slot.start_time ? "default" : "outline"} onClick={() => setTime(slot.start_time)}>
                  {slot.start_time}
                </Button>
              ))
            )}
          </div>
          <Button className="w-full" onClick={reschedule} disabled={!time}>
            Confirmar remarcação
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/agendar/${slug}`}>Voltar</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
