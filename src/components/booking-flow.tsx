"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Clock, Scissors, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  appointments,
  business,
  dateOptions,
  getProfessional,
  getService,
  money,
  professionalServices,
  professionals,
  services,
  timeSlots,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const clientSchema = z.object({
  name: z.string().min(3, "Informe seu nome."),
  whatsapp: z.string().min(10, "Informe um WhatsApp válido."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  note: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;

const steps = ["Serviço", "Profissional", "Data", "Horário", "Dados"];

export function BookingFlow() {
  const router = useRouter();
  const [serviceId, setServiceId] = useState("consulta-inicial");
  const [professionalId, setProfessionalId] = useState("camila");
  const [date, setDate] = useState("Amanhã");
  const [time, setTime] = useState("09:30");
  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", whatsapp: "", email: "", note: "" },
  });

  const availableProfessionals = useMemo(() => {
    const links = professionalServices.filter((item) => item.serviceId === serviceId);
    return links.map((link) => professionals.find((professional) => professional.id === link.professionalId)).filter(Boolean);
  }, [serviceId]);

  const variation = professionalServices.find(
    (item) => item.serviceId === serviceId && item.professionalId === professionalId,
  );

  function chooseService(id: string) {
    setServiceId(id);
    const firstProfessional = professionalServices.find((item) => item.serviceId === id)?.professionalId;
    if (firstProfessional) setProfessionalId(firstProfessional);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-white">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
              <Scissors className="size-5 text-primary" />
              Escolha o serviço
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => chooseService(service.id)}
                  className={cn("rounded-lg border bg-white p-4 text-left transition", serviceId === service.id && "border-primary bg-secondary ring-2 ring-primary/10")}
                >
                  <span className="font-semibold text-slate-950">{service.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{service.description}</span>
                  <span className="mt-3 block text-sm font-medium text-primary">
                    A partir de {money(service.basePrice)} - {service.baseDuration} min
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
              Escolha o profissional
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {availableProfessionals.map((professional) => {
                if (!professional) return null;
                const custom = professionalServices.find(
                  (item) => item.serviceId === serviceId && item.professionalId === professional.id,
                );
                return (
                  <button
                    key={professional.id}
                    type="button"
                    onClick={() => setProfessionalId(professional.id)}
                    className={cn("rounded-lg border bg-white p-4 text-left transition", professionalId === professional.id && "border-primary bg-secondary ring-2 ring-primary/10")}
                  >
                    <span className="grid size-12 place-items-center rounded-lg bg-primary/10 font-semibold text-primary">
                      {professional.initials}
                    </span>
                    <span className="mt-3 block font-semibold text-slate-950">{professional.name}</span>
                    <span className="block text-sm text-muted-foreground">{professional.specialty}</span>
                    {custom && (
                      <span className="mt-3 block text-sm font-medium text-primary">
                        {money(custom.price)} - {custom.duration} min
                      </span>
                    )}
                  </button>
                );
              })}
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
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {dateOptions.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={date === option ? "default" : "outline"}
                    onClick={() => setDate(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                <Clock className="size-5 text-primary" />
                Horário
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {timeSlots.slice(0, 6).map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    variant={time === slot ? "default" : "outline"}
                    onClick={() => setTime(slot)}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-xl font-semibold text-slate-950">Seus dados</h2>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={form.handleSubmit(() => router.push("/agendar/studio-aurora/confirmacao"))}
            >
              <div className="space-y-2">
                <Label>Nome obrigatorio</Label>
                <Input {...form.register("name")} placeholder="Seu nome" />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>WhatsApp obrigatorio</Label>
                <Input {...form.register("whatsapp")} placeholder="(11) 90000-0000" />
                {form.formState.errors.whatsapp && (
                  <p className="text-sm text-destructive">{form.formState.errors.whatsapp.message}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>E-mail opcional</Label>
                <Input {...form.register("email")} placeholder="você@email.com" />
                {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observação opcional</Label>
                <Textarea {...form.register("note")} placeholder="Algo que o profissional deva saber?" />
              </div>
              <Button type="submit" className="sm:col-span-2">
                Continuar para confirmação
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="border-primary/20 shadow-xl shadow-primary/10">
          <CardContent className="space-y-5 p-5">
            <div>
              <Badge variant="secondary">Resumo</Badge>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">{business.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{business.address}</p>
            </div>
            <div className="space-y-3 rounded-lg bg-secondary p-4 text-sm">
              <p>
                <strong>Serviço:</strong> {getService(serviceId)?.name}
              </p>
              <p>
                <strong>Profissional:</strong> {getProfessional(professionalId)?.name}
              </p>
              <p>
                <strong>Data e horário:</strong> {date}, {time}
              </p>
              {variation && (
                <p>
                  <strong>Valor:</strong> {money(variation.price)} / {variation.duration} min
                </p>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-slate-950">Reservas recentes</p>
              <div className="mt-3 space-y-2">
                {appointments.slice(0, 2).map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between gap-2 text-xs">
                    <span>{appointment.time}</span>
                    <StatusBadge status={appointment.status} />
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Revise os dados antes de confirmar o agendamento.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
