import { createClient } from "@/lib/supabase/server";
import type {
  AppointmentRecord,
  BusinessSubscriptionRecord,
  BookingSettingsRecord,
  InternalNotificationRecord,
  PlanUsage,
  ProfessionalRecord,
  ProfessionalBreakRecord,
  ProfessionalServiceRecord,
  ScheduleBlockRecord,
  ServiceRecord,
  WorkingHourRecord,
} from "@/lib/business/types";

export async function getProfessionalsForBusiness(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professionals")
    .select("id,business_id,name,role_title,bio,avatar_url,is_active,sort_order,created_at,updated_at,deleted_at")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []) as ProfessionalRecord[];
}

export async function getServicesForBusiness(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id,business_id,name,short_description,base_price_cents,base_duration_minutes,is_active,sort_order,created_at,updated_at,deleted_at")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []) as ServiceRecord[];
}

export async function getProfessionalServicesForBusiness(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_services")
    .select("id,business_id,professional_id,service_id,custom_price_cents,custom_duration_minutes,is_active,created_at,updated_at")
    .eq("business_id", businessId)
    .eq("is_active", true);

  if (error) {
    return [];
  }

  return (data ?? []) as ProfessionalServiceRecord[];
}

export async function getPlanUsageForBusiness(businessId: string): Promise<PlanUsage> {
  const supabase = await createClient();
  const [subscriptionResult, professionalsResult, servicesResult] = await Promise.all([
    supabase
      .from("business_subscriptions")
      .select(
        "id,business_id,plan_id,status,max_professionals,max_services,current_period_started_at,current_period_ends_at,trial_ends_at,provider,provider_customer_id,provider_subscription_id,canceled_at,created_at,updated_at",
      )
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null),
  ]);

  return {
    subscription: (subscriptionResult.data as BusinessSubscriptionRecord | null) ?? null,
    professionalsCount: professionalsResult.count ?? 0,
    servicesCount: servicesResult.count ?? 0,
  };
}

export async function getWorkingHoursForBusiness(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_working_hours")
    .select("id,business_id,professional_id,weekday,start_time,end_time,is_active,created_at,updated_at")
    .eq("business_id", businessId)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []) as WorkingHourRecord[];
}

export async function getBreaksForBusiness(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_breaks")
    .select("id,business_id,professional_id,weekday,start_time,end_time,is_active,created_at,updated_at")
    .eq("business_id", businessId)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []) as ProfessionalBreakRecord[];
}

export async function getBookingSettingsForBusiness(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_booking_settings")
    .select("id,business_id,professional_id,buffer_minutes,minimum_notice_minutes,booking_window_days,slot_step_minutes,cancellation_notice_minutes,reschedule_notice_minutes,created_at,updated_at")
    .eq("business_id", businessId);

  if (error) {
    return [];
  }

  return (data ?? []) as BookingSettingsRecord[];
}

export async function getFutureScheduleBlocksForBusiness(businessId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("id,business_id,professional_id,block_date,is_full_day,start_time,end_time,reason,is_active,created_at,updated_at")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .gte("block_date", today)
    .order("block_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []) as ScheduleBlockRecord[];
}

export async function getAppointmentsForBusiness(
  businessId: string,
  dateOrOptions?: string | { date?: string; from?: string; to?: string; limit?: number },
) {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id,business_id,customer_id,professional_id,service_id,professional_service_id,customer_name,customer_whatsapp,customer_email,customer_note,internal_note,appointment_date,start_time,end_time,status,source,notes,cancel_token,reschedule_token,cancelled_at,created_at,updated_at")
    .eq("business_id", businessId)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (typeof dateOrOptions === "string") {
    query = query.eq("appointment_date", dateOrOptions);
  } else if (dateOrOptions?.date) {
    query = query.eq("appointment_date", dateOrOptions.date);
  } else {
    if (dateOrOptions?.from) {
      query = query.gte("appointment_date", dateOrOptions.from);
    }

    if (dateOrOptions?.to) {
      query = query.lte("appointment_date", dateOrOptions.to);
    }
  }

  if (typeof dateOrOptions === "object" && dateOrOptions.limit) {
    query = query.limit(dateOrOptions.limit);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []) as AppointmentRecord[];
}

export async function getNotificationsForBusiness(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("internal_notifications")
    .select("id,business_id,appointment_id,type,title,message,is_read,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return [];
  }

  return (data ?? []) as InternalNotificationRecord[];
}

export async function getUnreadNotificationCountForBusiness(businessId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("internal_notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_read", false);

  if (error) {
    return 0;
  }

  return count ?? 0;
}
