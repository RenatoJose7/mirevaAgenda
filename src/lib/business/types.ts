export type ProfessionalRecord = {
  id: string;
  business_id: string;
  name: string;
  role_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ServiceRecord = {
  id: string;
  business_id: string;
  name: string;
  short_description: string | null;
  base_price_cents: number | null;
  base_duration_minutes: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProfessionalServiceRecord = {
  id: string;
  business_id: string;
  professional_id: string;
  service_id: string;
  custom_price_cents: number | null;
  custom_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessSubscriptionRecord = {
  id: string;
  business_id: string;
  plan_id: "basic" | "plus" | "business";
  billing_cycle: "monthly" | "annual";
  status: "trialing" | "pending" | "active" | "canceled" | "past_due";
  max_professionals: number;
  max_services: number;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_plan_id: string | null;
  provider_checkout_id: string | null;
  provider_payment_method: string | null;
  provider_status: string | null;
  started_at: string | null;
  renews_at: string | null;
  cancel_requested_at: string | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, unknown>;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanUsage = {
  subscription: BusinessSubscriptionRecord | null;
  professionalsCount: number;
  servicesCount: number;
};

export type PaymentWebhookEventRecord = {
  id: string;
  provider: string;
  provider_event_id: string | null;
  event_type: string;
  business_id: string | null;
  subscription_id: string | null;
  payload: Record<string, unknown>;
  headers: Record<string, unknown>;
  signature_hash: string | null;
  processing_status: "received" | "ignored" | "processed" | "failed";
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkingHourRecord = {
  id: string;
  business_id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfessionalBreakRecord = {
  id: string;
  business_id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BookingSettingsRecord = {
  id: string;
  business_id: string;
  professional_id: string;
  buffer_minutes: number;
  minimum_notice_minutes: number;
  booking_window_days: number;
  slot_step_minutes: number;
  cancellation_notice_minutes?: number;
  reschedule_notice_minutes?: number;
  created_at: string;
  updated_at: string;
};

export type ScheduleBlockRecord = {
  id: string;
  business_id: string;
  professional_id: string;
  block_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AppointmentRecord = {
  id: string;
  business_id: string;
  customer_id: string | null;
  professional_id: string;
  service_id: string;
  professional_service_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  customer_email: string | null;
  customer_note: string | null;
  internal_note: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  source: "internal" | "public";
  notes?: string | null;
  cancel_token: string | null;
  reschedule_token: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AvailabilitySlot = {
  start_time: string;
  end_time: string;
};

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "no_show" | "completed";

export type CustomerRecord = {
  id: string;
  business_id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type InternalNotificationRecord = {
  id: string;
  business_id: string;
  appointment_id: string | null;
  type: "appointment_created" | "appointment_cancelled" | "appointment_rescheduled" | "appointment_status_changed";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export function currencyToCents(value: string) {
  const clean = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");

  if (!clean) {
    return null;
  }

  const parsed = Number(clean);

  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function centsToCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCents(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Sob consulta";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
