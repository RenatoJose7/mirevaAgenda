"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarX, Clock, Save, Search, Settings2, TimerReset } from "lucide-react";
import { AuthNotice } from "@/components/auth-notice";
import { AdminShell } from "@/components/admin-shell";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AvailabilitySlot,
  AppointmentRecord,
  BookingSettingsRecord,
  ProfessionalBreakRecord,
  ProfessionalRecord,
  ProfessionalServiceRecord,
  ScheduleBlockRecord,
  ServiceRecord,
  WorkingHourRecord,
} from "@/lib/business/types";
import { formatWhatsappInput } from "@/lib/appointments/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const weekdays = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

type WorkdayDraft = {
  id?: string;
  weekday: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
};

type SettingsDraft = {
  buffer_minutes: number;
  minimum_notice_minutes: number;
  booking_window_days: number;
  slot_step_minutes: number;
  cancellation_notice_minutes: number;
  reschedule_notice_minutes: number;
};

const defaultSettings: SettingsDraft = {
  buffer_minutes: 0,
  minimum_notice_minutes: 0,
  booking_window_days: 60,
  slot_step_minutes: 15,
  cancellation_notice_minutes: 1440,
  reschedule_notice_minutes: 1440,
};

type FriendlyTimeUnit = "minutes" | "hours";
type AgendaDisplayMode = "list" | "time-grid";
const agendaDisplayStorageKey = "mireva-agenda-display-mode";
const agendaGridHourHeight = 72;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function toTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function trimTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function getAppointmentTone(status: AppointmentRecord["status"]) {
  const tones = {
    pending: "border-amber-200 bg-amber-50 text-amber-950 shadow-amber-100/60",
    confirmed: "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-emerald-100/60",
    completed: "border-slate-200 bg-slate-100 text-slate-900 shadow-slate-100/60",
    no_show: "border-rose-200 bg-rose-50 text-rose-950 shadow-rose-100/60",
    cancelled: "border-zinc-200 bg-zinc-50 text-zinc-500 shadow-zinc-100/60",
  } satisfies Record<AppointmentRecord["status"], string>;

  return tones[status];
}

function getFriendlyTimeInput(totalMinutes: number) {
  if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
    return { value: totalMinutes / 60, unit: "hours" as const };
  }

  return { value: totalMinutes, unit: "minutes" as const };
}

function fromFriendlyTimeInput(value: number, unit: FriendlyTimeUnit) {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  return unit === "hours" ? safeValue * 60 : safeValue;
}

function FieldHelp({ children }: { children: string }) {
  return <p className="text-xs leading-5 text-muted-foreground">{children}</p>;
}

function MinutesField({
  id,
  label,
  help,
  value,
  onChange,
  min = 0,
  max,
}: {
  id: string;
  label: string;
  help: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <FieldHelp>{help}</FieldHelp>
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          className="pr-20"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
          minutos
        </span>
      </div>
    </div>
  );
}

function HumanTimeField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const friendly = getFriendlyTimeInput(value);

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <FieldHelp>{help}</FieldHelp>
      </div>
      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          value={friendly.value}
          onChange={(event) => onChange(fromFriendlyTimeInput(Number(event.target.value), friendly.unit))}
        />
        <select
          className="h-9 rounded-lg border bg-white px-3 text-sm"
          value={friendly.unit}
          onChange={(event) =>
            onChange(fromFriendlyTimeInput(friendly.value, event.target.value as FriendlyTimeUnit))
          }
        >
          <option value="minutes">minutos</option>
          <option value="hours">horas</option>
        </select>
      </div>
    </div>
  );
}

function buildWorkdayDraft(professionalId: string, workingHours: WorkingHourRecord[]): WorkdayDraft[] {
  return weekdays.map((_, weekday) => {
    const record = workingHours.find((item) => item.professional_id === professionalId && item.weekday === weekday);

    return {
      id: record?.id,
      weekday,
      is_active: record?.is_active ?? (weekday >= 1 && weekday <= 5),
      start_time: trimTime(record?.start_time) || "09:00",
      end_time: trimTime(record?.end_time) || "18:00",
    };
  });
}

function buildSettingsDraft(professionalId: string, settings: BookingSettingsRecord[]): SettingsDraft {
  const record = settings.find((item) => item.professional_id === professionalId);

  if (!record) {
    return defaultSettings;
  }

  return {
    buffer_minutes: record.buffer_minutes,
    minimum_notice_minutes: record.minimum_notice_minutes,
    booking_window_days: record.booking_window_days,
    slot_step_minutes: record.slot_step_minutes,
    cancellation_notice_minutes: record.cancellation_notice_minutes ?? 1440,
    reschedule_notice_minutes: record.reschedule_notice_minutes ?? 1440,
  };
}

export function AgendaView({
  businessId,
  businessName,
  themeKey,
  initialProfessionals,
  initialServices,
  initialLinks,
  initialWorkingHours,
  initialBreaks,
  initialSettings,
  initialBlocks,
  initialAppointments,
  unreadCount,
}: {
  businessId: string;
  businessName: string;
  themeKey?: string | null;
  initialProfessionals: ProfessionalRecord[];
  initialServices: ServiceRecord[];
  initialLinks: ProfessionalServiceRecord[];
  initialWorkingHours: WorkingHourRecord[];
  initialBreaks: ProfessionalBreakRecord[];
  initialSettings: BookingSettingsRecord[];
  initialBlocks: ScheduleBlockRecord[];
  initialAppointments: AppointmentRecord[];
  unreadCount: number;
}) {
  const [workingHours, setWorkingHours] = useState(initialWorkingHours);
  const [breaks, setBreaks] = useState(initialBreaks);
  const [settings, setSettings] = useState(initialSettings);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(initialProfessionals[0]?.id ?? "");
  const [selectedServiceId, setSelectedServiceId] = useState(initialServices[0]?.id ?? "");
  const [workdayDraft, setWorkdayDraft] = useState<WorkdayDraft[]>(
    buildWorkdayDraft(initialProfessionals[0]?.id ?? "", initialWorkingHours),
  );
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(
    buildSettingsDraft(initialProfessionals[0]?.id ?? "", initialSettings),
  );
  const [breakDraft, setBreakDraft] = useState({ weekday: 1, start_time: "12:00", end_time: "13:00" });
  const [blockDraft, setBlockDraft] = useState({
    block_date: todayInputValue(),
    is_full_day: false,
    start_time: "14:00",
    end_time: "15:00",
    reason: "",
  });
  const [viewMode, setViewMode] = useState<"agenda" | "settings">("agenda");
  const [agendaDisplayMode, setAgendaDisplayMode] = useState<AgendaDisplayMode>("list");
  const [unavailabilityMode, setUnavailabilityMode] = useState<"breaks" | "blocks">("breaks");
  const [agendaDate, setAgendaDate] = useState(todayInputValue());
  const [availabilityDate, setAvailabilityDate] = useState(todayInputValue());
  const [manualDraft, setManualDraft] = useState({
    date: todayInputValue(),
    time: "",
    customerName: "",
    customerWhatsapp: "",
    customerEmail: "",
  });
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[] | null>(null);
  const [availabilityEmptyReason, setAvailabilityEmptyReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const activeProfessionals = useMemo(
    () => initialProfessionals.filter((professional) => professional.is_active),
    [initialProfessionals],
  );
  const linkedServices = useMemo(() => {
    const serviceIds = new Set(
      initialLinks
        .filter((link) => link.professional_id === selectedProfessionalId && link.is_active)
        .map((link) => link.service_id),
    );

    return initialServices.filter((service) => service.is_active && serviceIds.has(service.id));
  }, [initialLinks, initialServices, selectedProfessionalId]);
  const effectiveSelectedServiceId = linkedServices.some((service) => service.id === selectedServiceId)
    ? selectedServiceId
    : linkedServices[0]?.id ?? "";
  const professionalBreaks = breaks.filter((item) => item.professional_id === selectedProfessionalId && item.is_active);
  const professionalBlocks = blocks.filter((item) => item.professional_id === selectedProfessionalId && item.is_active);
  const selectedWeekday = useMemo(() => new Date(`${agendaDate}T00:00:00`).getDay(), [agendaDate]);
  const selectedDayHours = useMemo(
    () =>
      workingHours
        .filter((item) => item.professional_id === selectedProfessionalId && item.weekday === selectedWeekday && item.is_active)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [selectedProfessionalId, selectedWeekday, workingHours],
  );
  const selectedDayAppointments = useMemo(
    () =>
      appointments
        .filter((item) => item.professional_id === selectedProfessionalId && item.appointment_date === agendaDate)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [agendaDate, appointments, selectedProfessionalId],
  );
  const agendaRows = useMemo(() => {
    const rows = new Map<string, AppointmentRecord | null>();

    selectedDayHours.forEach((hour) => {
      const start = toMinutes(hour.start_time);
      const end = toMinutes(hour.end_time);

      for (let current = start; current < end; current += 30) {
        rows.set(toTime(current), null);
      }
    });

    selectedDayAppointments.forEach((appointment) => {
      rows.set(trimTime(appointment.start_time), appointment);
    });

    return Array.from(rows.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [selectedDayAppointments, selectedDayHours]);
  const agendaGrid = useMemo(() => {
    const workStarts = selectedDayHours.map((hour) => toMinutes(hour.start_time));
    const workEnds = selectedDayHours.map((hour) => toMinutes(hour.end_time));
    const appointmentStarts = selectedDayAppointments.map((appointment) => toMinutes(appointment.start_time));
    const appointmentEnds = selectedDayAppointments.map((appointment) => toMinutes(appointment.end_time));
    if (workStarts.length === 0 && appointmentStarts.length === 0) {
      return {
        start: 9 * 60,
        end: 18 * 60,
        hours: Array.from({ length: 10 }, (_, index) => (9 + index) * 60),
        height: 9 * agendaGridHourHeight,
      };
    }

    const rawStart = Math.min(...workStarts, ...appointmentStarts);
    const rawEnd = Math.max(...workEnds, ...appointmentEnds);
    const start = Math.floor(rawStart / 60) * 60;
    const end = Math.max(start + 60, Math.ceil(rawEnd / 60) * 60);
    const hours = [];

    for (let current = start; current <= end; current += 60) {
      hours.push(current);
    }

    return {
      start,
      end,
      hours,
      height: ((end - start) / 60) * agendaGridHourHeight,
    };
  }, [selectedDayAppointments, selectedDayHours]);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(agendaDisplayStorageKey);

    if (savedMode === "list" || savedMode === "time-grid") {
      const frame = window.requestAnimationFrame(() => setAgendaDisplayMode(savedMode));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  function updateAgendaDisplayMode(mode: AgendaDisplayMode) {
    setAgendaDisplayMode(mode);
    window.localStorage.setItem(agendaDisplayStorageKey, mode);
  }

  async function reloadSchedule() {
    const supabase = createClient();
    const [hoursResult, breaksResult, settingsResult, blocksResult] = await Promise.all([
      supabase
        .from("professional_working_hours")
        .select("id,business_id,professional_id,weekday,start_time,end_time,is_active,created_at,updated_at")
        .eq("business_id", businessId)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("professional_breaks")
        .select("id,business_id,professional_id,weekday,start_time,end_time,is_active,created_at,updated_at")
        .eq("business_id", businessId)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("professional_booking_settings")
        .select("id,business_id,professional_id,buffer_minutes,minimum_notice_minutes,booking_window_days,slot_step_minutes,cancellation_notice_minutes,reschedule_notice_minutes,created_at,updated_at")
        .eq("business_id", businessId),
      supabase
        .from("schedule_blocks")
        .select("id,business_id,professional_id,block_date,is_full_day,start_time,end_time,reason,is_active,created_at,updated_at")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .gte("block_date", todayInputValue())
        .order("block_date", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);

    if (!hoursResult.error) {
      const nextWorkingHours = (hoursResult.data ?? []) as WorkingHourRecord[];
      setWorkingHours(nextWorkingHours);
      setWorkdayDraft(buildWorkdayDraft(selectedProfessionalId, nextWorkingHours));
    }

    if (!breaksResult.error) {
      setBreaks((breaksResult.data ?? []) as ProfessionalBreakRecord[]);
    }

    if (!settingsResult.error) {
      const nextSettings = (settingsResult.data ?? []) as BookingSettingsRecord[];
      setSettings(nextSettings);
      setSettingsDraft(buildSettingsDraft(selectedProfessionalId, nextSettings));
    }

    if (!blocksResult.error) {
      setBlocks((blocksResult.data ?? []) as ScheduleBlockRecord[]);
    }
  }

  async function saveWorkingHours() {
    if (!selectedProfessionalId) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();

    for (const draft of workdayDraft) {
      const payload = {
        business_id: businessId,
        professional_id: selectedProfessionalId,
        weekday: draft.weekday,
        start_time: draft.start_time,
        end_time: draft.end_time,
        is_active: draft.is_active,
      };
      const result = draft.id
        ? await supabase.from("professional_working_hours").update(payload).eq("id", draft.id).eq("business_id", businessId)
        : draft.is_active
          ? await supabase.from("professional_working_hours").insert(payload)
          : { error: null };

      if (result.error) {
        setMessage({
          type: "error",
          text: "Nao foi possivel salvar os horarios. Confira se o inicio vem antes do fim e se os intervalos do mesmo dia nao se sobrepoem.",
        });
        setIsSaving(false);
        return;
      }
    }

    await reloadSchedule();
    setMessage({ type: "success", text: "Horarios de atendimento salvos." });
    setIsSaving(false);
  }

  async function saveSettings() {
    if (!selectedProfessionalId) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.from("professional_booking_settings").upsert(
      {
        business_id: businessId,
        professional_id: selectedProfessionalId,
        ...settingsDraft,
      },
      { onConflict: "professional_id" },
    );

    if (error) {
      setMessage({ type: "error", text: "Nao foi possivel salvar as regras de disponibilidade." });
      setIsSaving(false);
      return;
    }

    await reloadSchedule();
    setMessage({ type: "success", text: "Regras de disponibilidade salvas." });
    setIsSaving(false);
  }

  async function addBreak() {
    if (!selectedProfessionalId) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.from("professional_breaks").insert({
      business_id: businessId,
      professional_id: selectedProfessionalId,
      weekday: breakDraft.weekday,
      start_time: breakDraft.start_time,
      end_time: breakDraft.end_time,
      is_active: true,
    });

    if (error) {
      setMessage({
        type: "error",
        text: "Nao foi possivel criar a pausa. A pausa precisa ter inicio antes do fim e nao pode sobrepor outra pausa do mesmo dia.",
      });
      setIsSaving(false);
      return;
    }

    await reloadSchedule();
    setMessage({ type: "success", text: "Pausa criada." });
    setIsSaving(false);
  }

  async function deactivateBreak(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("professional_breaks").update({ is_active: false }).eq("id", id).eq("business_id", businessId);

    if (error) {
      setMessage({ type: "error", text: "Nao foi possivel remover a pausa." });
      return;
    }

    await reloadSchedule();
    setMessage({ type: "success", text: "Pausa removida." });
  }

  async function addBlock() {
    if (!selectedProfessionalId) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.from("schedule_blocks").insert({
      business_id: businessId,
      professional_id: selectedProfessionalId,
      block_date: blockDraft.block_date,
      is_full_day: blockDraft.is_full_day,
      start_time: blockDraft.is_full_day ? null : blockDraft.start_time,
      end_time: blockDraft.is_full_day ? null : blockDraft.end_time,
      reason: blockDraft.reason.trim() || null,
      is_active: true,
    });

    if (error) {
      setMessage({
        type: "error",
        text: "Nao foi possivel criar o bloqueio. Bloqueios parciais precisam ter inicio antes do fim; bloqueio de dia inteiro nao usa horario.",
      });
      setIsSaving(false);
      return;
    }

    await reloadSchedule();
    setMessage({ type: "success", text: "Bloqueio criado." });
    setIsSaving(false);
  }

  async function deactivateBlock(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("schedule_blocks").update({ is_active: false }).eq("id", id).eq("business_id", businessId);

    if (error) {
      setMessage({ type: "error", text: "Nao foi possivel remover o bloqueio." });
      return;
    }

    await reloadSchedule();
    setMessage({ type: "success", text: "Bloqueio removido." });
  }

  async function testAvailability() {
    if (!selectedProfessionalId || !effectiveSelectedServiceId) {
      setMessage({ type: "error", text: "Selecione profissional e servico vinculados." });
      return;
    }

    setIsTesting(true);
    setMessage(null);
    setAvailabilitySlots(null);
    setAvailabilityEmptyReason("");
    const response = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        professionalId: selectedProfessionalId,
        serviceId: effectiveSelectedServiceId,
        date: availabilityDate,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "Nao foi possivel calcular disponibilidade." });
      setIsTesting(false);
      return;
    }

    setAvailabilitySlots(payload.slots);
    setAvailabilityEmptyReason(payload.emptyReason ?? "");
    setDurationMinutes(payload.durationMinutes);
    setIsTesting(false);
  }

  async function createManualAppointment() {
    if (!selectedServiceId || !selectedProfessionalId || !manualDraft.date || !manualDraft.time) {
      setMessage({ type: "error", text: "Preencha servico, profissional, data e horario." });
      return;
    }

    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: selectedServiceId,
        professionalId: selectedProfessionalId,
        date: manualDraft.date,
        startTime: manualDraft.time,
        customerName: manualDraft.customerName,
        customerWhatsapp: manualDraft.customerWhatsapp,
        customerEmail: manualDraft.customerEmail,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "Nao foi possivel criar agendamento." });
      return;
    }

    setAppointments((current) => [payload.appointment, ...current]);
    setAgendaDate(payload.appointment.appointment_date);
    setManualDraft({ date: todayInputValue(), time: "", customerName: "", customerWhatsapp: "", customerEmail: "" });
    setMessage({ type: "success", text: "Agendamento manual criado." });
  }

  async function updateStatus(appointmentId: string, status: "confirmed" | "cancelled" | "no_show" | "completed") {
    const response = await fetch(`/api/appointments/${appointmentId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "Nao foi possivel atualizar status." });
      return;
    }

    setAppointments((current) => current.map((item) => (item.id === appointmentId ? payload.appointment : item)));
    setMessage({ type: "success", text: "Status atualizado." });
  }

  return (
    <AdminShell
      title="Agenda"
      description="Atendimentos do dia, horarios livres e configuracao de disponibilidade."
      businessName={businessName}
      themeKey={themeKey}
      unreadCount={unreadCount}
    >
      <div className="space-y-6">
        {message && <AuthNotice type={message.type} message={message.text} />}

        <Card>
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="professional-select">Profissional</Label>
              <select
                id="professional-select"
                className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                value={selectedProfessionalId}
                onChange={(event) => {
                  const professionalId = event.target.value;
                  setSelectedProfessionalId(professionalId);
                  setWorkdayDraft(buildWorkdayDraft(professionalId, workingHours));
                  setSettingsDraft(buildSettingsDraft(professionalId, settings));
                  setSelectedServiceId("");
                  setAvailabilitySlots(null);
                  setAvailabilityEmptyReason("");
                  setViewMode("agenda");
                }}
              >
                {activeProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant={viewMode === "agenda" ? "default" : "outline"} onClick={() => setViewMode("agenda")}>
                <Clock className="size-4" />
                Agenda do dia
              </Button>
              <Button type="button" variant={viewMode === "settings" ? "default" : "outline"} onClick={() => setViewMode("settings")}>
                <Settings2 className="size-4" />
                Editar disponibilidade
              </Button>
            </div>
          </CardContent>
        </Card>

        {activeProfessionals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="mx-auto mb-3 size-10 text-primary" />
              <h2 className="text-lg font-semibold text-slate-950">Cadastre um profissional ativo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Horarios, pausas e bloqueios dependem de um profissional real.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === "agenda" && (
              <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <CardTitle>Agenda visual</CardTitle>
                      <div className="flex flex-col gap-2 lg:flex-row">
                        <div className="inline-flex rounded-lg border bg-secondary p-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={agendaDisplayMode === "list" ? "default" : "ghost"}
                            onClick={() => updateAgendaDisplayMode("list")}
                          >
                            Lista
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={agendaDisplayMode === "time-grid" ? "default" : "ghost"}
                            onClick={() => updateAgendaDisplayMode("time-grid")}
                          >
                            Grade de horarios
                          </Button>
                        </div>
                        <Input type="date" value={agendaDate} onChange={(event) => setAgendaDate(event.target.value)} />
                        <Button type="button" variant="outline" onClick={() => setViewMode("settings")}>
                          <Settings2 className="size-4" />
                          Editar disponibilidade
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedDayHours.length === 0 ? (
                      <div className="rounded-lg border border-dashed bg-secondary p-5">
                        <h2 className="font-semibold text-slate-950">Configure sua disponibilidade para comecar a receber agendamentos.</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Este profissional ainda nao possui horarios ativos para {weekdays[selectedWeekday].toLowerCase()}.
                        </p>
                        <Button className="mt-4" type="button" onClick={() => setViewMode("settings")}>
                          Configurar disponibilidade
                        </Button>
                      </div>
                    ) : agendaDisplayMode === "list" ? (
                      <div className="space-y-2">
                        {agendaRows.map(([time, appointment]) => {
                          const service = appointment ? initialServices.find((item) => item.id === appointment.service_id) : null;
                          return (
                            <div key={`${time}-${appointment?.id ?? "free"}`} className="grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-[5rem_1fr] sm:items-center">
                              <span className="text-sm font-semibold text-primary">{time}</span>
                              {appointment ? (
                                <div
                                  className={cn(
                                    "flex flex-col gap-3 rounded-lg border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between",
                                    getAppointmentTone(appointment.status),
                                  )}
                                >
                                  <div>
                                    <p className="font-medium">{service?.name ?? "Servico"}</p>
                                    <p className="text-sm opacity-75">
                                      {appointment.customer_name} ate {trimTime(appointment.end_time)}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <StatusBadge status={appointment.status} />
                                    {(["confirmed", "completed", "no_show", "cancelled"] as const).map((status) => (
                                      <Button key={status} variant="outline" onClick={() => updateStatus(appointment.id, status)}>
                                        {status === "confirmed" ? "Confirmar" : status === "completed" ? "Concluir" : status === "no_show" ? "Nao apareceu" : "Cancelar"}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">Horario livre</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="overflow-x-auto pb-2">
                        <div className="min-w-[34rem]">
                          <div className="grid grid-cols-[4.5rem_1fr] items-center border-b pb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            <span>Hora</span>
                            <span>{agendaDate}</span>
                          </div>
                          <div
                            className="relative mt-3 grid grid-cols-[4.5rem_1fr]"
                            style={{ height: agendaGrid.height }}
                          >
                            <div className="relative">
                              {agendaGrid.hours.map((hour) => (
                                <span
                                  key={hour}
                                  className="absolute -translate-y-2 text-xs font-medium text-muted-foreground"
                                  style={{
                                    top: `${((hour - agendaGrid.start) / 60) * agendaGridHourHeight}px`,
                                  }}
                                >
                                  {toTime(hour)}
                                </span>
                              ))}
                            </div>
                            <div className="relative overflow-hidden rounded-lg border bg-white">
                              {agendaGrid.hours.map((hour) => (
                                <div
                                  key={hour}
                                  className="absolute left-0 right-0 border-t border-border/70"
                                  style={{
                                    top: `${((hour - agendaGrid.start) / 60) * agendaGridHourHeight}px`,
                                  }}
                                />
                              ))}
                              {selectedDayAppointments.length === 0 && (
                                <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                                  Nenhum atendimento nesta data.
                                </div>
                              )}
                              {selectedDayAppointments.map((appointment) => {
                                const service = initialServices.find((item) => item.id === appointment.service_id);
                                const start = toMinutes(appointment.start_time);
                                const end = toMinutes(appointment.end_time);
                                const top = ((start - agendaGrid.start) / 60) * agendaGridHourHeight;
                                const height = Math.max(((end - start) / 60) * agendaGridHourHeight - 8, 44);

                                return (
                                  <div
                                    key={appointment.id}
                                    className={cn(
                                      "absolute left-3 right-3 overflow-hidden rounded-lg border p-3 shadow-sm",
                                      getAppointmentTone(appointment.status),
                                    )}
                                    style={{ top, height }}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{service?.name ?? "Servico"}</p>
                                        <p className="truncate text-xs opacity-75">{appointment.customer_name}</p>
                                      </div>
                                      <span className="shrink-0 text-xs font-semibold">
                                        {trimTime(appointment.start_time)}
                                      </span>
                                    </div>
                                    {height >= 68 && (
                                      <p className="mt-1 text-xs opacity-75">
                                        Ate {trimTime(appointment.end_time)}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Novo agendamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <select
                      className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                      value={selectedServiceId}
                      onChange={(event) => setSelectedServiceId(event.target.value)}
                    >
                      {linkedServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="date"
                      value={manualDraft.date}
                      onChange={(event) => setManualDraft((current) => ({ ...current, date: event.target.value }))}
                    />
                    <Input
                      type="time"
                      value={manualDraft.time}
                      onChange={(event) => setManualDraft((current) => ({ ...current, time: event.target.value }))}
                    />
                    <Input
                      placeholder="Cliente"
                      value={manualDraft.customerName}
                      onChange={(event) => setManualDraft((current) => ({ ...current, customerName: event.target.value }))}
                    />
                    <Input
                      placeholder="WhatsApp"
                      inputMode="tel"
                      value={manualDraft.customerWhatsapp}
                      onChange={(event) =>
                        setManualDraft((current) => ({ ...current, customerWhatsapp: formatWhatsappInput(event.target.value) }))
                      }
                    />
                    <Input
                      placeholder="E-mail opcional"
                      value={manualDraft.customerEmail}
                      onChange={(event) => setManualDraft((current) => ({ ...current, customerEmail: event.target.value }))}
                    />
                    <Button className="w-full" onClick={createManualAppointment} disabled={!selectedServiceId || !manualDraft.time}>
                      Criar agendamento
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {viewMode === "settings" && (
              <div className="space-y-6">
                <div className="max-w-3xl space-y-1">
                  <h2 className="text-2xl font-semibold text-slate-950">Configuracoes de disponibilidade</h2>
                  <p className="text-sm text-muted-foreground">
                    Defina como sua agenda deve funcionar para os clientes.
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TimerReset className="size-5 text-primary" />
                      Regras gerais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-slate-950">Horarios de atendimento</h3>
                        <p className="text-sm text-muted-foreground">
                          Marque os dias em que este profissional atende e informe o primeiro e o ultimo horario.
                        </p>
                      </div>
                      <div className="grid gap-3">
                        {workdayDraft.map((day, index) => (
                          <div
                            key={day.weekday}
                            className="grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center"
                          >
                            <label className="flex items-center gap-3 text-sm font-medium text-slate-950">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={day.is_active}
                                onChange={(event) =>
                                  setWorkdayDraft((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, is_active: event.target.checked } : item,
                                    ),
                                  )
                                }
                              />
                              {weekdays[day.weekday]}
                            </label>
                            <Input
                              aria-label={`Hora inicial de ${weekdays[day.weekday]}`}
                              type="time"
                              value={day.start_time}
                              disabled={!day.is_active}
                              onChange={(event) =>
                                setWorkdayDraft((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, start_time: event.target.value } : item,
                                  ),
                                )
                              }
                            />
                            <Input
                              aria-label={`Hora final de ${weekdays[day.weekday]}`}
                              type="time"
                              value={day.end_time}
                              disabled={!day.is_active}
                              onChange={(event) =>
                                setWorkdayDraft((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, end_time: event.target.value } : item,
                                  ),
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <Button onClick={saveWorkingHours} disabled={isSaving}>
                        <Save className="size-4" />
                        Salvar horarios
                      </Button>
                    </div>

                    <div className="border-t pt-6">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <MinutesField
                          id="buffer-minutes"
                          label="Tempo de descanso entre atendimentos"
                          help="Ex: 10 minutos entre uma consulta e outra."
                          value={settingsDraft.buffer_minutes}
                          onChange={(value) =>
                            setSettingsDraft((current) => ({ ...current, buffer_minutes: value }))
                          }
                        />
                        <HumanTimeField
                          id="minimum-notice"
                          label="Cliente pode agendar com no minimo"
                          help="Evita agendamentos muito em cima da hora."
                          value={settingsDraft.minimum_notice_minutes}
                          onChange={(value) =>
                            setSettingsDraft((current) => ({ ...current, minimum_notice_minutes: value }))
                          }
                        />
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="booking-window">Permitir agendamentos ate</Label>
                            <FieldHelp>
                              Define ate quantos dias no futuro o cliente pode escolher um horario.
                            </FieldHelp>
                          </div>
                          <div className="relative">
                            <Input
                              id="booking-window"
                              type="number"
                              min={1}
                              max={365}
                              className="pr-14"
                              value={settingsDraft.booking_window_days}
                              onChange={(event) =>
                                setSettingsDraft((current) => ({
                                  ...current,
                                  booking_window_days: Number(event.target.value),
                                }))
                              }
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                              dias
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="slot-step">Mostrar horarios de</Label>
                            <FieldHelp>Ex: 15 em 15 minutos.</FieldHelp>
                          </div>
                          <select
                            id="slot-step"
                            className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                            value={settingsDraft.slot_step_minutes}
                            onChange={(event) =>
                              setSettingsDraft((current) => ({
                                ...current,
                                slot_step_minutes: Number(event.target.value),
                              }))
                            }
                          >
                            {[5, 10, 15, 20, 30, 60].map((step) => (
                              <option key={step} value={step}>
                                {step} min
                              </option>
                            ))}
                          </select>
                        </div>
                        <HumanTimeField
                          id="cancellation-notice"
                          label="Cancelar ate"
                          help="Tempo minimo antes do atendimento para permitir cancelamento."
                          value={settingsDraft.cancellation_notice_minutes}
                          onChange={(value) =>
                            setSettingsDraft((current) => ({ ...current, cancellation_notice_minutes: value }))
                          }
                        />
                        <HumanTimeField
                          id="reschedule-notice"
                          label="Remarcar ate"
                          help="Tempo minimo antes do atendimento para permitir remarcacao."
                          value={settingsDraft.reschedule_notice_minutes}
                          onChange={(value) =>
                            setSettingsDraft((current) => ({ ...current, reschedule_notice_minutes: value }))
                          }
                        />
                      </div>
                      <Button className="mt-5" onClick={saveSettings} disabled={isSaving}>
                        <Save className="size-4" />
                        Salvar configuracoes
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarX className="size-5 text-primary" />
                      Indisponibilidades
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cadastre pausas recorrentes ou bloqueie horarios especificos em que voce nao vai atender.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="inline-flex rounded-lg border bg-secondary p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={unavailabilityMode === "breaks" ? "default" : "ghost"}
                        onClick={() => setUnavailabilityMode("breaks")}
                      >
                        Pausa semanal
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={unavailabilityMode === "blocks" ? "default" : "ghost"}
                        onClick={() => setUnavailabilityMode("blocks")}
                      >
                        Bloquear uma data
                      </Button>
                    </div>

                    {unavailabilityMode === "breaks" ? (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-slate-950">Pausa semanal</h3>
                          <p className="text-sm text-muted-foreground">
                            Use para horarios fixos, como almoco ou intervalo.
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
                          <div className="space-y-2">
                            <Label>Dia da semana</Label>
                            <select
                              className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                              value={breakDraft.weekday}
                              onChange={(event) =>
                                setBreakDraft((current) => ({ ...current, weekday: Number(event.target.value) }))
                              }
                            >
                              {weekdays.map((day, index) => (
                                <option key={day} value={index}>
                                  {day}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Hora inicial</Label>
                            <Input
                              type="time"
                              value={breakDraft.start_time}
                              onChange={(event) =>
                                setBreakDraft((current) => ({ ...current, start_time: event.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Hora final</Label>
                            <Input
                              type="time"
                              value={breakDraft.end_time}
                              onChange={(event) =>
                                setBreakDraft((current) => ({ ...current, end_time: event.target.value }))
                              }
                            />
                          </div>
                          <Button onClick={addBreak} disabled={isSaving}>
                            Adicionar pausa
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {professionalBreaks.length === 0 ? (
                            <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                              Nenhuma pausa semanal cadastrada.
                            </p>
                          ) : (
                            professionalBreaks.map((item) => (
                              <div
                                key={item.id}
                                className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <span className="text-sm">
                                  {weekdays[item.weekday]}: {trimTime(item.start_time)} - {trimTime(item.end_time)}
                                </span>
                                <Button variant="ghost" onClick={() => deactivateBreak(item.id)}>
                                  Remover
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-slate-950">Bloquear uma data</h3>
                          <p className="text-sm text-muted-foreground">
                            Use para folgas, compromissos ou horarios especificos indisponiveis.
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Data</Label>
                            <Input
                              type="date"
                              value={blockDraft.block_date}
                              onChange={(event) =>
                                setBlockDraft((current) => ({ ...current, block_date: event.target.value }))
                              }
                            />
                          </div>
                          <label className="flex items-center gap-3 rounded-lg border bg-white p-3 text-sm sm:self-end">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={blockDraft.is_full_day}
                              onChange={(event) =>
                                setBlockDraft((current) => ({ ...current, is_full_day: event.target.checked }))
                              }
                            />
                            Dia inteiro
                          </label>
                          {!blockDraft.is_full_day && (
                            <>
                              <div className="space-y-2">
                                <Label>Hora inicial</Label>
                                <Input
                                  type="time"
                                  value={blockDraft.start_time}
                                  onChange={(event) =>
                                    setBlockDraft((current) => ({ ...current, start_time: event.target.value }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Hora final</Label>
                                <Input
                                  type="time"
                                  value={blockDraft.end_time}
                                  onChange={(event) =>
                                    setBlockDraft((current) => ({ ...current, end_time: event.target.value }))
                                  }
                                />
                              </div>
                            </>
                          )}
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Motivo opcional</Label>
                            <Textarea
                              placeholder="Ex: folga, evento externo ou compromisso."
                              value={blockDraft.reason}
                              onChange={(event) =>
                                setBlockDraft((current) => ({ ...current, reason: event.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <Button onClick={addBlock} disabled={isSaving}>
                          Adicionar bloqueio
                        </Button>
                        <div className="space-y-2">
                          {professionalBlocks.length === 0 ? (
                            <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                              Nenhum bloqueio futuro cadastrado.
                            </p>
                          ) : (
                            professionalBlocks.map((item) => (
                              <div key={item.id} className="rounded-lg border bg-white p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-sm">
                                    {item.block_date}{" "}
                                    {item.is_full_day
                                      ? "dia inteiro"
                                      : `${trimTime(item.start_time)} - ${trimTime(item.end_time)}`}
                                  </span>
                                  <Button variant="ghost" onClick={() => deactivateBlock(item.id)}>
                                    Remover
                                  </Button>
                                </div>
                                {item.reason && <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarCheck className="size-5 text-primary" />
                      Testar disponibilidade
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Confira quais horarios aparecerao para o cliente em uma data especifica.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Servico</Label>
                        <select
                          className="h-9 w-full rounded-lg border bg-white px-3 text-sm"
                          value={effectiveSelectedServiceId}
                          onChange={(event) => setSelectedServiceId(event.target.value)}
                        >
                          {linkedServices.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={availabilityDate}
                          onChange={(event) => setAvailabilityDate(event.target.value)}
                        />
                      </div>
                    </div>
                    <Button onClick={testAvailability} disabled={isTesting || linkedServices.length === 0}>
                      <Search className="size-4" />
                      {isTesting ? "Calculando..." : "Ver horarios disponiveis"}
                    </Button>
                    {linkedServices.length === 0 && (
                      <p className="text-sm text-muted-foreground">Vincule servicos a este profissional em Servicos.</p>
                    )}
                    {availabilitySlots && (
                      <div className="space-y-3 rounded-lg bg-secondary p-4">
                        <p className="text-sm text-muted-foreground">
                          Duracao considerada: {durationMinutes} min. Total encontrado: {availabilitySlots.length}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {availabilitySlots.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {availabilityEmptyReason || "Nenhum horario disponivel."}
                            </p>
                          ) : (
                            availabilitySlots.map((slot) => (
                              <Badge key={`${slot.start_time}-${slot.end_time}`} variant="secondary">
                                {slot.start_time} - {slot.end_time}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
