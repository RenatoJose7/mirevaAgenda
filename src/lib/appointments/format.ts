import type { AppointmentStatus } from "@/lib/business/types";

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Cliente não apareceu",
  completed: "Concluído",
};

export function formatAppointmentDate(date: string, start: string, end?: string) {
  return `${date} das ${start.slice(0, 5)}${end ? ` às ${end.slice(0, 5)}` : ""}`;
}

export function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length >= 12) {
    return `+${digits}`;
  }

  return `+55${digits}`;
}

export function getWhatsappDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") ? digits.slice(2) : digits;
}

export function isValidBrazilianWhatsapp(value: string) {
  const digits = getWhatsappDigits(value);
  return digits.length === 10 || digits.length === 11;
}

export function formatWhatsappInput(value: string) {
  const digits = getWhatsappDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function getStatusUpdateMessage(customerName: string, status: AppointmentStatus) {
  const safeName = customerName.trim() || "O cliente";

  if (status === "completed") {
    return `O agendamento de ${safeName} foi marcado como concluído.`;
  }

  if (status === "no_show") {
    return `O cliente ${safeName} não compareceu.`;
  }

  if (status === "cancelled") {
    return `O agendamento de ${safeName} foi cancelado.`;
  }

  if (status === "confirmed") {
    return `O agendamento de ${safeName} foi confirmado.`;
  }

  return `O agendamento de ${safeName} está aguardando confirmação.`;
}

export function addMinutesToTime(time: string, minutes: number) {
  const [hour = "0", minute = "0"] = time.split(":");
  const total = Number(hour) * 60 + Number(minute) + minutes;
  const resultHour = Math.floor(total / 60);
  const resultMinute = total % 60;

  return `${String(resultHour).padStart(2, "0")}:${String(resultMinute).padStart(2, "0")}`;
}
