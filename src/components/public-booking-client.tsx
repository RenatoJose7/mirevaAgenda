"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, UserRound } from "lucide-react";
import { AuthNotice } from "@/components/auth-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AvailabilitySlot,
  BookingSettingsRecord,
  ProfessionalRecord,
  ProfessionalServiceRecord,
  ServiceRecord,
} from "@/lib/business/types";
import { formatCents } from "@/lib/business/types";
import { formatWhatsappInput, isValidBrazilianWhatsapp } from "@/lib/appointments/format";
import { useThemeStyle } from "@/lib/use-theme-style";
import { cn } from "@/lib/utils";

type PublicData = {
  business: {
    name: string;
    slug: string;
    segment: string | null;
    whatsapp: string | null;
    address: string | null;
    logo_url: string | null;
    theme_key: string;
    booking_confirmation_mode: "automatic" | "manual";
  };
  services: ServiceRecord[];
  professionals: ProfessionalRecord[];
  links: ProfessionalServiceRecord[];
  settings: BookingSettingsRecord[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PublicBookingClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [data, setData] = useState<PublicData | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emptySlotsReason, setEmptySlotsReason] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [client, setClient] = useState({
    name: "",
    whatsapp: "",
    email: "",
    note: "",
  });
  const themeStyle = useThemeStyle(data?.business.theme_key);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const response = await fetch(`/api/public/${slug}/booking-data`);
      const payload = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: payload.error ?? "Estabelecimento nao encontrado." });
        setIsLoading(false);
        return;
      }

      setData(payload);
      const firstService = payload.services.find((service: ServiceRecord) =>
        payload.links.some((link: ProfessionalServiceRecord) => link.service_id === service.id),
      );
      setServiceId(firstService?.id ?? "");
      setIsLoading(false);
    }

    load();
  }, [slug]);

  const professionalsForService = useMemo(() => {
    if (!data) return [];
    const ids = new Set(
      data.links.filter((link) => link.service_id === serviceId && link.is_active).map((link) => link.professional_id),
    );
    return data.professionals.filter((professional) => ids.has(professional.id));
  }, [data, serviceId]);
  const effectiveProfessionalId = professionalsForService.some((professional) => professional.id === professionalId)
    ? professionalId
    : professionalsForService[0]?.id ?? "";

  useEffect(() => {
    async function loadSlots() {
      if (!serviceId || !effectiveProfessionalId || !date) return;
      setIsChecking(true);
      setTime("");
      const response = await fetch(`/api/public/${slug}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, professionalId: effectiveProfessionalId, date }),
      });
      const payload = await response.json();
      setSlots(response.ok ? payload.slots : []);
      setEmptySlotsReason(response.ok ? payload.emptyReason ?? "" : payload.error ?? "Nao foi possivel calcular horarios.");
      setIsChecking(false);
    }

    loadSlots();
  }, [date, effectiveProfessionalId, serviceId, slug]);

  async function submit() {
    setMessage(null);

    if (!data) {
      setMessage({ type: "error", text: "Carregue os dados do estabelecimento antes de confirmar." });
      return;
    }

    if (!serviceId || !effectiveProfessionalId || !date || !time || client.name.trim().length < 2) {
      setMessage({ type: "error", text: "Preencha servico, profissional, data, horario, nome e WhatsApp." });
      return;
    }

    if (!isValidBrazilianWhatsapp(client.whatsapp)) {
      setMessage({ type: "error", text: "Informe um WhatsApp valido para receber informacoes sobre sua reserva." });
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/public/${slug}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        professionalId: effectiveProfessionalId,
        date,
        startTime: time,
        customerName: client.name,
        customerWhatsapp: client.whatsapp,
        customerEmail: client.email,
        customerNote: client.note,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "Nao foi possivel criar a reserva." });
      setIsSubmitting(false);
      return;
    }

    const params = new URLSearchParams({
      status: payload.appointment.status,
      data: payload.appointment.date,
      horario: payload.appointment.start_time,
      cancelar: payload.appointment.cancel_token,
      remarcar: payload.appointment.reschedule_token,
      tema: data.business.theme_key,
    });
    router.push(`/agendar/${slug}/confirmacao?${params.toString()}`);
  }

  if (isLoading) {
    return (
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-lg bg-secondary" />
          <div className="h-48 animate-pulse rounded-lg bg-secondary" />
          <div className="h-40 animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {message && <AuthNotice type={message.type} message={message.text} />}
        <Button asChild>
          <Link href="/">Voltar para busca</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8" style={themeStyle}>
      <div className="mb-8 max-w-3xl">
        <div className="flex items-center gap-4">
          {data.business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.business.logo_url} alt={data.business.name} className="size-16 rounded-xl border object-cover" />
          ) : (
            <div className="grid size-16 place-items-center rounded-xl bg-primary text-xl font-semibold text-primary-foreground">
              {data.business.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Agendamento publico</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 md:text-5xl">{data.business.name}</h1>
          </div>
        </div>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Escolha servico, profissional, data e horario. O cliente final nao precisa criar conta.
        </p>
      </div>

      {message && <div className="mb-5"><AuthNotice type={message.type} message={message.text} /></div>}

      {data.services.length === 0 || data.professionals.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Este estabelecimento ainda nao possui horarios disponiveis.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-5">
                <h2 className="text-xl font-semibold text-slate-950">Servico</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setServiceId(service.id);
                        setProfessionalId("");
                        setTime("");
                        setSlots([]);
                        setEmptySlotsReason("");
                      }}
                      className={cn("rounded-lg border bg-white p-4 text-left transition", serviceId === service.id && "border-primary bg-secondary ring-2 ring-primary/10")}
                    >
                      <span className="font-semibold text-slate-950">{service.name}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{service.short_description || "Servico por horario marcado."}</span>
                      <span className="mt-3 block text-sm font-medium text-primary">
                        {formatCents(service.base_price_cents)} - {service.base_duration_minutes} min
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                  <UserRound className="size-5 text-primary" />
                  Profissional
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {professionalsForService.map((professional) => (
                    <button
                      key={professional.id}
                      type="button"
                      onClick={() => setProfessionalId(professional.id)}
                      className={cn("rounded-lg border bg-white p-4 text-left transition", effectiveProfessionalId === professional.id && "border-primary bg-secondary ring-2 ring-primary/10")}
                    >
                      <span className="block font-semibold text-slate-950">{professional.name}</span>
                      <span className="text-sm text-muted-foreground">{professional.role_title || "Profissional"}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="p-5">
                  <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                    <CalendarDays className="size-5 text-primary" />
                    Data
                  </h2>
                  <Input className="mt-4" type="date" value={date} min={today()} onChange={(event) => setDate(event.target.value)} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                    <Clock className="size-5 text-primary" />
                    Horario
                  </h2>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {isChecking ? (
                      <p className="col-span-3 text-sm text-muted-foreground">Calculando...</p>
                    ) : slots.length === 0 ? (
                      <p className="col-span-3 text-sm text-muted-foreground">
                        {emptySlotsReason || "Nenhum horario disponivel."}
                      </p>
                    ) : (
                      slots.map((slot) => (
                        <Button key={slot.start_time} type="button" variant={time === slot.start_time ? "default" : "outline"} onClick={() => setTime(slot.start_time)}>
                          {slot.start_time}
                        </Button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-5">
                <h2 className="text-xl font-semibold text-slate-950">Seus dados</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={client.name} onChange={(event) => setClient((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      inputMode="tel"
                      placeholder="(11) 99999-9999"
                      value={client.whatsapp}
                      onChange={(event) =>
                        setClient((current) => ({ ...current, whatsapp: formatWhatsappInput(event.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>E-mail opcional</Label>
                    <Input value={client.email} onChange={(event) => setClient((current) => ({ ...current, email: event.target.value }))} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Observacao opcional</Label>
                    <Textarea value={client.note} onChange={(event) => setClient((current) => ({ ...current, note: event.target.value }))} />
                  </div>
                  <Button className="sm:col-span-2" onClick={submit} disabled={isSubmitting}>
                    {isSubmitting ? "Reservando..." : "Confirmar agendamento"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card className="border-primary/20 shadow-xl shadow-primary/10">
              <CardContent className="space-y-5 p-5">
                <Badge variant="secondary">Resumo</Badge>
                <div className="flex items-center gap-3">
                  {data.business.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.business.logo_url} alt={data.business.name} className="size-12 rounded-lg border object-cover" />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                      {data.business.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <h2 className="text-2xl font-semibold text-slate-950">{data.business.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{data.business.address || "Endereco nao informado"}</p>
                <div className="rounded-lg bg-secondary p-4 text-sm">
                  <p><strong>Servico:</strong> {data.services.find((item) => item.id === serviceId)?.name || "-"}</p>
                  <p><strong>Profissional:</strong> {data.professionals.find((item) => item.id === effectiveProfessionalId)?.name || "-"}</p>
                  <p><strong>Data e horario:</strong> {date} {time && `as ${time}`}</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </section>
  );
}
