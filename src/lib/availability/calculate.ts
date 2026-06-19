import type {
  AppointmentRecord,
  AvailabilitySlot,
  BookingSettingsRecord,
  ProfessionalBreakRecord,
  ScheduleBlockRecord,
  WorkingHourRecord,
} from "@/lib/business/types";

type CalculateAvailabilityInput = {
  date: string;
  durationMinutes: number;
  settings?: Pick<
    BookingSettingsRecord,
    "buffer_minutes" | "minimum_notice_minutes" | "booking_window_days" | "slot_step_minutes"
  > | null;
  workingHours: Pick<WorkingHourRecord, "weekday" | "start_time" | "end_time" | "is_active">[];
  breaks: Pick<ProfessionalBreakRecord, "weekday" | "start_time" | "end_time" | "is_active">[];
  blocks: Pick<ScheduleBlockRecord, "block_date" | "is_full_day" | "start_time" | "end_time" | "is_active">[];
  appointments: Pick<AppointmentRecord, "appointment_date" | "start_time" | "end_time" | "status">[];
  now?: Date;
};

const defaultSettings = {
  buffer_minutes: 0,
  minimum_notice_minutes: 0,
  booking_window_days: 60,
  slot_step_minutes: 15,
};

export function calculateAvailability({
  date,
  durationMinutes,
  settings,
  workingHours,
  breaks,
  blocks,
  appointments,
  now = new Date(),
}: CalculateAvailabilityInput): AvailabilitySlot[] {
  const targetDate = parseDate(date);

  if (!targetDate || durationMinutes <= 0) {
    return [];
  }

  const appliedSettings = { ...defaultSettings, ...(settings ?? {}) };
  const today = startOfDay(now);
  const maxDate = addDays(today, appliedSettings.booking_window_days);

  if (targetDate < today || targetDate > maxDate) {
    return [];
  }

  const minimumStart = new Date(now.getTime() + appliedSettings.minimum_notice_minutes * 60_000);
  const weekday = targetDate.getDay();
  const activeWorkingHours = workingHours.filter((item) => item.is_active && item.weekday === weekday);
  const activeBreaks = breaks.filter((item) => item.is_active && item.weekday === weekday);
  const dateBlocks = blocks.filter((item) => item.is_active && item.block_date === date);

  if (dateBlocks.some((block) => block.is_full_day)) {
    return [];
  }

  const activeAppointments = appointments.filter(
    (appointment) => appointment.appointment_date === date && appointment.status !== "cancelled",
  );
  const unavailable = [
    ...activeBreaks.map((item) => interval(item.start_time, item.end_time)),
    ...dateBlocks
      .filter((item) => !item.is_full_day && item.start_time && item.end_time)
      .map((item) => interval(item.start_time as string, item.end_time as string)),
    ...activeAppointments.map((item) => interval(item.start_time, item.end_time)),
  ];

  const slots: AvailabilitySlot[] = [];

  for (const workingHour of activeWorkingHours) {
    const start = timeToMinutes(workingHour.start_time);
    const end = timeToMinutes(workingHour.end_time);

    for (
      let slotStart = start;
      slotStart + durationMinutes <= end;
      slotStart += appliedSettings.slot_step_minutes
    ) {
      const slotEnd = slotStart + durationMinutes;
      const conflictEnd = slotEnd + appliedSettings.buffer_minutes;
      const slotDate = combineDateAndMinutes(targetDate, slotStart);

      if (slotDate < minimumStart) {
        continue;
      }

      if (unavailable.some((busy) => overlaps(slotStart, conflictEnd, busy.start, busy.end))) {
        continue;
      }

      slots.push({
        start_time: minutesToTime(slotStart),
        end_time: minutesToTime(slotEnd),
      });
    }
  }

  return slots;
}

export function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return startOfDay(date);
}

function interval(start: string, end: string) {
  return { start: timeToMinutes(start), end: timeToMinutes(end) };
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
