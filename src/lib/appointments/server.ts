import { randomBytes } from "crypto";
import { getAvailabilityForBusiness } from "@/lib/availability/server";
import { formatAppointmentDate, getStatusUpdateMessage, isValidBrazilianWhatsapp, normalizeWhatsapp } from "@/lib/appointments/format";
import type {
  AppointmentRecord,
  AppointmentStatus,
  BookingSettingsRecord,
  InternalNotificationRecord,
  ProfessionalRecord,
  ProfessionalServiceRecord,
  ServiceRecord,
} from "@/lib/business/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PublicBookingData = {
  business: {
    id: string;
    name: string;
    slug: string;
    segment: string | null;
    whatsapp: string | null;
    address: string | null;
    theme_key: string;
    booking_confirmation_mode: "automatic" | "manual";
  };
  services: ServiceRecord[];
  professionals: ProfessionalRecord[];
  links: ProfessionalServiceRecord[];
  settings: BookingSettingsRecord[];
};

export async function getPublicBookingData(slug: string): Promise<PublicBookingData | null> {
  const supabase = createAdminClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,slug,segment,whatsapp,address,theme_key,booking_confirmation_mode")
    .eq("slug", slug)
    .maybeSingle();

  if (businessError || !business) {
    return null;
  }

  const [servicesResult, professionalsResult, linksResult, settingsResult] = await Promise.all([
    supabase
      .from("services")
      .select("id,business_id,name,short_description,base_price_cents,base_duration_minutes,is_active,sort_order,created_at,updated_at,deleted_at")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("professionals")
      .select("id,business_id,name,role_title,bio,avatar_url,is_active,sort_order,created_at,updated_at,deleted_at")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("professional_services")
      .select("id,business_id,professional_id,service_id,custom_price_cents,custom_duration_minutes,is_active,created_at,updated_at")
      .eq("business_id", business.id)
      .eq("is_active", true),
    supabase
      .from("professional_booking_settings")
      .select("id,business_id,professional_id,buffer_minutes,minimum_notice_minutes,booking_window_days,slot_step_minutes,cancellation_notice_minutes,reschedule_notice_minutes,created_at,updated_at")
      .eq("business_id", business.id),
  ]);

  const activeServiceIds = new Set((servicesResult.data ?? []).map((service) => service.id));
  const activeProfessionalIds = new Set((professionalsResult.data ?? []).map((professional) => professional.id));
  const activeLinks = (linksResult.data ?? []).filter(
    (link) => activeServiceIds.has(link.service_id) && activeProfessionalIds.has(link.professional_id),
  );

  return {
    business: business as PublicBookingData["business"],
    services: (servicesResult.data ?? []) as ServiceRecord[],
    professionals: (professionalsResult.data ?? []) as ProfessionalRecord[],
    links: activeLinks as ProfessionalServiceRecord[],
    settings: (settingsResult.data ?? []).filter((setting) =>
      activeProfessionalIds.has(setting.professional_id),
    ) as BookingSettingsRecord[],
  };
}

export async function getPublicAvailability({
  slug,
  professionalId,
  serviceId,
  date,
  preloadedData,
}: {
  slug: string;
  professionalId: string;
  serviceId: string;
  date: string;
  preloadedData?: PublicBookingData;
}) {
  const data = preloadedData ?? await getPublicBookingData(slug);

  if (!data) {
    return { ok: false as const, message: "Estabelecimento nao encontrado." };
  }

  const supabase = createAdminClient();
  return getAvailabilityForBusiness({
    businessId: data.business.id,
    professionalId,
    serviceId,
    date,
    supabase,
  });
}

export async function createPublicAppointment(input: {
  slug: string;
  serviceId: string;
  professionalId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail?: string | null;
  customerNote?: string | null;
}) {
  const data = await getPublicBookingData(input.slug);

  if (!data) {
    return { ok: false as const, message: "Estabelecimento nao encontrado." };
  }

  const availability = await getPublicAvailability({
    slug: input.slug,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    date: input.date,
    preloadedData: data,
  });

  if (!availability.ok) {
    return availability;
  }

  const selectedSlot = availability.slots.find((slot) => slot.start_time === input.startTime.slice(0, 5));

  if (!selectedSlot) {
    return {
      ok: false as const,
      message: availability.emptyReason ?? "Este horario acabou de ficar indisponivel. Escolha outro horario.",
    };
  }

  const supabase = createAdminClient();
  const link = data.links.find(
    (item) => item.professional_id === input.professionalId && item.service_id === input.serviceId && item.is_active,
  );

  if (!isValidBrazilianWhatsapp(input.customerWhatsapp)) {
    return { ok: false as const, message: "Informe um WhatsApp valido para receber informacoes sobre sua reserva." };
  }

  const customerWhatsapp = normalizeWhatsapp(input.customerWhatsapp);
  const status = data.business.booking_confirmation_mode === "automatic" ? "confirmed" : "pending";
  const cancelToken = secureToken();
  const rescheduleToken = secureToken();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        business_id: data.business.id,
        name: input.customerName.trim(),
        whatsapp: customerWhatsapp,
        email: input.customerEmail?.trim() || null,
      },
      { onConflict: "business_id,whatsapp" },
    )
    .select("*")
    .single();

  if (customerError || !customer) {
    return { ok: false as const, message: "Nao foi possivel salvar os dados do cliente." };
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      business_id: data.business.id,
      customer_id: customer.id,
      professional_id: input.professionalId,
      service_id: input.serviceId,
      professional_service_id: link?.id ?? null,
      customer_name: input.customerName.trim(),
      customer_whatsapp: customerWhatsapp,
      customer_email: input.customerEmail?.trim() || null,
      customer_note: input.customerNote?.trim() || null,
      appointment_date: input.date,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      status,
      source: "public",
      cancel_token: cancelToken,
      reschedule_token: rescheduleToken,
    })
    .select("*")
    .single();

  if (appointmentError || !appointment) {
    return { ok: false as const, message: getAppointmentWriteMessage(appointmentError, "public") };
  }

  await createNotification({
    businessId: data.business.id,
    appointmentId: appointment.id,
    type: "appointment_created",
    title: status === "pending" ? "Reserva aguardando confirmacao" : "Nova reserva criada",
    message: `${input.customerName.trim()} solicitou ${formatAppointmentDate(input.date, selectedSlot.start_time, selectedSlot.end_time)}.`,
    supabase,
  });

  return {
    ok: true as const,
    appointment: appointment as AppointmentRecord,
    business: data.business,
  };
}

export async function cancelAppointmentByToken({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const supabase = createAdminClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, businesses!inner(slug,name)")
    .eq("cancel_token", token)
    .eq("businesses.slug", slug)
    .maybeSingle();

  if (!appointment) {
    return { ok: false as const, message: "Link de cancelamento invalido." };
  }

  if (appointment.status === "cancelled") {
    return { ok: true as const, appointment: appointment as AppointmentRecord, alreadyCancelled: true };
  }

  const canChange = await canChangeAppointment(appointment as AppointmentRecord, "cancel");

  if (!canChange.ok) {
    return canChange;
  }

  const { data: updated, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", appointment.id)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false as const, message: "Nao foi possivel cancelar a reserva." };
  }

  await createNotification({
    businessId: updated.business_id,
    appointmentId: updated.id,
    type: "appointment_cancelled",
    title: "Reserva cancelada pelo cliente",
    message: `${updated.customer_name} cancelou ${formatAppointmentDate(updated.appointment_date, updated.start_time, updated.end_time)}.`,
    supabase,
  });

  return { ok: true as const, appointment: updated as AppointmentRecord };
}

export async function rescheduleAppointmentByToken(input: {
  slug: string;
  token: string;
  date: string;
  startTime: string;
}) {
  const supabase = createAdminClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, businesses!inner(slug,name)")
    .eq("reschedule_token", input.token)
    .eq("businesses.slug", input.slug)
    .maybeSingle();

  if (!appointment) {
    return { ok: false as const, message: "Link de remarcacao invalido." };
  }

  const typedAppointment = appointment as AppointmentRecord;
  const canChange = await canChangeAppointment(typedAppointment, "reschedule");

  if (!canChange.ok) {
    return canChange;
  }

  const availability = await getPublicAvailability({
    slug: input.slug,
    professionalId: typedAppointment.professional_id,
    serviceId: typedAppointment.service_id,
    date: input.date,
  });

  if (!availability.ok) {
    return availability;
  }

  const selectedSlot = availability.slots.find((slot) => slot.start_time === input.startTime.slice(0, 5));

  if (!selectedSlot) {
    return {
      ok: false as const,
      message: availability.emptyReason ?? "Este horario nao esta disponivel para remarcacao. Escolha outro horario.",
    };
  }

  const { data: updated, error } = await supabase
    .from("appointments")
    .update({
      appointment_date: input.date,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      status: typedAppointment.status === "cancelled" ? "confirmed" : typedAppointment.status,
      reschedule_token: secureToken(),
      cancel_token: secureToken(),
      cancelled_at: null,
    })
    .eq("id", typedAppointment.id)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false as const, message: getAppointmentWriteMessage(error, "public", "reschedule") };
  }

  await createNotification({
    businessId: updated.business_id,
    appointmentId: updated.id,
    type: "appointment_rescheduled",
    title: "Reserva remarcada",
    message: `${updated.customer_name} remarcou para ${formatAppointmentDate(updated.appointment_date, updated.start_time, updated.end_time)}.`,
    supabase,
  });

  return { ok: true as const, appointment: updated as AppointmentRecord };
}

export async function getAppointmentByToken(slug: string, token: string, type: "cancel" | "reschedule") {
  const supabase = createAdminClient();
  const tokenColumn = type === "cancel" ? "cancel_token" : "reschedule_token";
  const { data } = await supabase
    .from("appointments")
    .select("*, businesses!inner(slug,name), services(name), professionals(name)")
    .eq(tokenColumn, token)
    .eq("businesses.slug", slug)
    .maybeSingle();

  return data as (AppointmentRecord & {
    businesses?: { name: string; slug: string };
    services?: { name: string };
    professionals?: { name: string };
  }) | null;
}

export async function createInternalAppointment(input: {
  businessId: string;
  serviceId: string;
  professionalId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail?: string | null;
}) {
  const supabase = await createClient();
  const availability = await getAvailabilityForBusiness({
    businessId: input.businessId,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    date: input.date,
  });

  if (!availability.ok) {
    return availability;
  }

  const selectedSlot = availability.slots.find((slot) => slot.start_time === input.startTime.slice(0, 5));

  if (!selectedSlot) {
    return {
      ok: false as const,
      message: availability.emptyReason ?? "Este horario nao esta disponivel. Recalcule os horarios e tente novamente.",
    };
  }

  if (!isValidBrazilianWhatsapp(input.customerWhatsapp)) {
    return { ok: false as const, message: "Informe um WhatsApp valido." };
  }

  const customerWhatsapp = normalizeWhatsapp(input.customerWhatsapp);
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        business_id: input.businessId,
        name: input.customerName.trim(),
        whatsapp: customerWhatsapp,
        email: input.customerEmail?.trim() || null,
      },
      { onConflict: "business_id,whatsapp" },
    )
    .select("*")
    .single();

  if (customerError || !customer) {
    return { ok: false as const, message: "Nao foi possivel salvar cliente." };
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      business_id: input.businessId,
      customer_id: customer.id,
      professional_id: input.professionalId,
      service_id: input.serviceId,
      customer_name: input.customerName.trim(),
      customer_whatsapp: customerWhatsapp,
      customer_email: input.customerEmail?.trim() || null,
      appointment_date: input.date,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      status: "confirmed",
      source: "internal",
      cancel_token: secureToken(),
      reschedule_token: secureToken(),
    })
    .select("*")
    .single();

  if (error || !appointment) {
    return { ok: false as const, message: getAppointmentWriteMessage(error, "internal") };
  }

  return { ok: true as const, appointment: appointment as AppointmentRecord };
}

export async function updateAppointmentStatus({
  businessId,
  appointmentId,
  status,
}: {
  businessId: string;
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status, cancelled_at: status === "cancelled" ? new Date().toISOString() : null })
    .eq("id", appointmentId)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false as const, message: "Nao foi possivel atualizar status." };
  }

  await supabase.from("internal_notifications").insert({
    business_id: businessId,
    appointment_id: appointmentId,
    type: "appointment_status_changed",
    title: "Status de agendamento atualizado",
    message: getStatusUpdateMessage(data.customer_name, status),
  });

  return { ok: true as const, appointment: data as AppointmentRecord };
}

async function canChangeAppointment(appointment: AppointmentRecord, mode: "cancel" | "reschedule") {
  if (appointment.status === "completed" || appointment.status === "no_show") {
    return { ok: false as const, message: "Esta reserva ja foi finalizada." };
  }

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("professional_booking_settings")
    .select("cancellation_notice_minutes,reschedule_notice_minutes")
    .eq("business_id", appointment.business_id)
    .eq("professional_id", appointment.professional_id)
    .maybeSingle();
  const notice =
    mode === "cancel"
      ? settings?.cancellation_notice_minutes ?? 1440
      : settings?.reschedule_notice_minutes ?? 1440;
  const appointmentStart = new Date(`${appointment.appointment_date}T${appointment.start_time}`);
  const minimumChangeTime = new Date(Date.now() + notice * 60_000);

  if (appointmentStart <= minimumChangeTime) {
    return { ok: false as const, message: "Prazo minimo para alterar esta reserva foi encerrado." };
  }

  return { ok: true as const };
}

async function createNotification({
  businessId,
  appointmentId,
  type,
  title,
  message,
  supabase,
}: {
  businessId: string;
  appointmentId: string;
  type: InternalNotificationRecord["type"];
  title: string;
  message: string;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  await supabase.from("internal_notifications").insert({
    business_id: businessId,
    appointment_id: appointmentId,
    type,
    title,
    message,
  });
}

function secureToken() {
  return randomBytes(32).toString("hex");
}

function getAppointmentWriteMessage(
  error: { code?: string; message?: string; details?: string } | null,
  audience: "public" | "internal",
  action: "create" | "reschedule" = "create",
) {
  const raw = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  const isConflict =
    error?.code === "23P01" ||
    raw.includes("appointments_no_overlapping_active") ||
    raw.includes("agendamento conflita") ||
    raw.includes("conflict") ||
    raw.includes("overlap");

  if (isConflict) {
    if (audience === "public") {
      return action === "reschedule"
        ? "Este horario acabou de ficar indisponivel. Escolha outro horario para remarcar."
        : "Este horario acabou de ser reservado por outra pessoa. Escolha outro horario.";
    }

    return "Este horario conflita com outro agendamento do profissional. Recalcule os horarios e tente novamente.";
  }

  if (audience === "public") {
    return action === "reschedule"
      ? "Nao foi possivel remarcar agora. Confira o horario escolhido e tente novamente."
      : "Nao foi possivel criar a reserva agora. Confira os dados e tente novamente.";
  }

  return "Nao foi possivel criar o agendamento. Confira cliente, servico, profissional e horario.";
}
