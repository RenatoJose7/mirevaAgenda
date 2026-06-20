import { calculateAvailability, parseDate } from "@/lib/availability/calculate";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentRecord,
  AvailabilitySlot,
  BookingSettingsRecord,
  ProfessionalBreakRecord,
  ScheduleBlockRecord,
  WorkingHourRecord,
} from "@/lib/business/types";
import { createClient } from "@/lib/supabase/server";

export type AvailabilityResult =
  | { ok: true; slots: AvailabilitySlot[]; durationMinutes: number; emptyReason?: string }
  | { ok: false; message: string };

const defaultBookingSettings = {
  buffer_minutes: 0,
  minimum_notice_minutes: 0,
  booking_window_days: 60,
  slot_step_minutes: 15,
};

export async function getAvailabilityForBusiness({
  businessId,
  professionalId,
  serviceId,
  date,
  supabase: providedClient,
}: {
  businessId: string;
  professionalId: string;
  serviceId: string;
  date: string;
  supabase?: SupabaseClient;
}): Promise<AvailabilityResult> {
  if (!parseDate(date)) {
    return { ok: false, message: "Data inválida." };
  }

  const supabase = providedClient ?? await createClient();
  const [
    professionalResult,
    serviceResult,
    linkResult,
    settingsResult,
    workingHoursResult,
    breaksResult,
    blocksResult,
    appointmentsResult,
  ] = await Promise.all([
    supabase
      .from("professionals")
      .select("id,business_id,is_active,deleted_at")
      .eq("id", professionalId)
      .eq("business_id", businessId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id,business_id,is_active,deleted_at,base_duration_minutes")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("professional_services")
      .select("id,business_id,professional_id,service_id,is_active,custom_duration_minutes")
      .eq("business_id", businessId)
      .eq("professional_id", professionalId)
      .eq("service_id", serviceId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("professional_booking_settings")
      .select("*")
      .eq("business_id", businessId)
      .eq("professional_id", professionalId)
      .maybeSingle(),
    supabase
      .from("professional_working_hours")
      .select("*")
      .eq("business_id", businessId)
      .eq("professional_id", professionalId),
    supabase
      .from("professional_breaks")
      .select("*")
      .eq("business_id", businessId)
      .eq("professional_id", professionalId),
    supabase
      .from("schedule_blocks")
      .select("*")
      .eq("business_id", businessId)
      .eq("professional_id", professionalId)
      .eq("block_date", date),
    supabase
      .from("appointments")
      .select("*")
      .eq("business_id", businessId)
      .eq("professional_id", professionalId)
      .eq("appointment_date", date),
  ]);

  if (professionalResult.error || !professionalResult.data) {
    return { ok: false, message: "Profissional indisponível ou fora deste estabelecimento." };
  }

  if (serviceResult.error || !serviceResult.data) {
    return { ok: false, message: "Serviço indisponível ou fora deste estabelecimento." };
  }

  if (linkResult.error || !linkResult.data) {
    return { ok: false, message: "Serviço não está vinculado a este profissional." };
  }

  const durationMinutes =
    linkResult.data.custom_duration_minutes ?? serviceResult.data.base_duration_minutes;

  const slots = calculateAvailability({
    date,
    durationMinutes,
    settings: settingsResult.data as BookingSettingsRecord | null,
    workingHours: (workingHoursResult.data ?? []) as WorkingHourRecord[],
    breaks: (breaksResult.data ?? []) as ProfessionalBreakRecord[],
    blocks: (blocksResult.data ?? []) as ScheduleBlockRecord[],
    appointments: (appointmentsResult.data ?? []) as AppointmentRecord[],
  });

  return {
    ok: true,
    slots,
    durationMinutes,
    emptyReason: slots.length === 0
      ? explainEmptyAvailability({
          date,
          durationMinutes,
          settings: settingsResult.data as BookingSettingsRecord | null,
          workingHours: (workingHoursResult.data ?? []) as WorkingHourRecord[],
          breaks: (breaksResult.data ?? []) as ProfessionalBreakRecord[],
          blocks: (blocksResult.data ?? []) as ScheduleBlockRecord[],
          appointments: (appointmentsResult.data ?? []) as AppointmentRecord[],
        })
      : undefined,
  };
}

function explainEmptyAvailability({
  date,
  durationMinutes,
  settings,
  workingHours,
  breaks,
  blocks,
  appointments,
  now = new Date(),
}: {
  date: string;
  durationMinutes: number;
  settings: BookingSettingsRecord | null;
  workingHours: WorkingHourRecord[];
  breaks: ProfessionalBreakRecord[];
  blocks: ScheduleBlockRecord[];
  appointments: AppointmentRecord[];
  now?: Date;
}) {
  const targetDate = parseDate(date);

  if (!targetDate || durationMinutes <= 0) {
    return "Data ou duração do serviço inválida.";
  }

  const appliedSettings = { ...defaultBookingSettings, ...(settings ?? {}) };
  const today = startOfDay(now);
  const maxDate = addDays(today, appliedSettings.booking_window_days);

  if (targetDate < today) {
    return "Esta data ja passou. Escolha uma data futura.";
  }

  if (targetDate > maxDate) {
    return `Este profissional aceita reservas com até ${appliedSettings.booking_window_days} dias de antecedencia.`;
  }

  const weekday = targetDate.getDay();
  const activeWorkingHours = workingHours.filter((item) => item.is_active && item.weekday === weekday);

  if (activeWorkingHours.length === 0) {
    return "Este profissional não possui horário de atendimento ativo neste dia.";
  }

  const dateBlocks = blocks.filter((item) => item.is_active && item.block_date === date);

  if (dateBlocks.some((block) => block.is_full_day)) {
    return "Este dia esta bloqueado para este profissional.";
  }

  const longestWorkingWindow = Math.max(
    ...activeWorkingHours.map((item) => timeToMinutes(item.end_time) - timeToMinutes(item.start_time)),
  );

  if (durationMinutes > longestWorkingWindow) {
    return "A duração deste serviço não cabe nos horários de atendimento deste dia.";
  }

  const minimumStart = new Date(now.getTime() + appliedSettings.minimum_notice_minutes * 60_000);
  const hasSlotAfterNotice = activeWorkingHours.some((workingHour) => {
    const start = timeToMinutes(workingHour.start_time);
    const end = timeToMinutes(workingHour.end_time);

    for (let slotStart = start; slotStart + durationMinutes <= end; slotStart += appliedSettings.slot_step_minutes) {
      const slotDate = combineDateAndMinutes(targetDate, slotStart);

      if (slotDate >= minimumStart) {
        return true;
      }
    }

    return false;
  });

  if (!hasSlotAfterNotice) {
    return "Não há horários que respeitem a antecedência mínima configurada.";
  }

  const activeBreaks = breaks.filter((item) => item.is_active && item.weekday === weekday);
  const partialBlocks = dateBlocks.filter((item) => !item.is_full_day && item.start_time && item.end_time);
  const activeAppointments = appointments.filter(
    (appointment) => appointment.appointment_date === date && appointment.status !== "cancelled",
  );

  if (activeAppointments.length > 0) {
    return "Não há horários livres neste dia porque a agenda do profissional já está ocupada.";
  }

  if (partialBlocks.length > 0) {
    return "Não há horários livres neste dia por causa dos bloqueios configurados.";
  }

  if (activeBreaks.length > 0) {
    return "Não há horários livres neste dia por causa das pausas configuradas.";
  }

  return "Não há horários livres para este serviço nesta data.";
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function combineDateAndMinutes(date: Date, minutes: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60);
}
