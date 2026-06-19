import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:3000";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for QA.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = Date.now();
const slug = `qa-mireva-${runId}`;
const targetDate = nextBookableDate();
let businessId = null;

try {
  await assertAppIsRunning();
  const seed = await createSeedData();
  businessId = seed.business.id;

  const bookingData = await apiGet(`/api/public/${slug}/booking-data`);
  assert(bookingData.services.length === 1, "public booking data should expose one active service");
  assert(bookingData.professionals.length === 1, "public booking data should expose one active professional");
  assert(bookingData.links.length === 1, "public booking data should expose one active service-professional link");

  const availability = await apiPost(`/api/public/${slug}/availability`, {
    serviceId: seed.service.id,
    professionalId: seed.professional.id,
    date: targetDate.date,
  });
  assert(availability.slots.some((slot) => slot.start_time === "09:00"), "availability should include 09:00");

  const appointment = await apiPost(`/api/public/${slug}/appointments`, {
    serviceId: seed.service.id,
    professionalId: seed.professional.id,
    date: targetDate.date,
    startTime: "09:00",
    customerName: "Cliente QA",
    customerWhatsapp: "11999999999",
    customerEmail: "qa-public-booking@example.com",
    customerNote: "Fluxo QA temporario",
  });
  assert(appointment.appointment.status === "confirmed", "automatic booking should be confirmed");

  const conflict = await apiPostExpectingError(`/api/public/${slug}/appointments`, {
    serviceId: seed.service.id,
    professionalId: seed.professional.id,
    date: targetDate.date,
    startTime: "09:00",
    customerName: "Cliente QA Conflito",
    customerWhatsapp: "11888888888",
    customerEmail: "qa-public-booking-conflict@example.com",
  });
  assert(
    /reservado|indisponivel|conflita/i.test(conflict.error),
    "double booking should return a clear conflict message",
  );

  const rescheduled = await apiPost(`/api/public/${slug}/reschedule/${appointment.appointment.reschedule_token}`, {
    date: targetDate.date,
    startTime: "10:30",
  });
  assert(rescheduled.appointment.start_time.startsWith("10:30"), "reschedule should move the appointment");

  const cancelled = await apiPost(`/api/public/${slug}/cancel/${rescheduled.appointment.cancel_token}`, {});
  assert(cancelled.appointment.status === "cancelled", "cancel should mark the appointment as cancelled");

  console.log("public booking QA passed");
} finally {
  if (businessId) {
    await supabase.from("businesses").delete().eq("id", businessId);
  }
}

async function createSeedData() {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({
      name: "QA Mireva Agenda",
      slug,
      segment: "Servicos",
      theme_key: "mireva",
      booking_confirmation_mode: "automatic",
    })
    .select("id,slug")
    .single();
  if (businessError || !business) throw businessError ?? new Error("business seed failed");

  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .insert({
      business_id: business.id,
      name: "Profissional QA",
      role_title: "Atendimento",
      is_active: true,
    })
    .select("id")
    .single();
  if (professionalError || !professional) throw professionalError ?? new Error("professional seed failed");

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .insert({
      business_id: business.id,
      name: "Servico QA",
      short_description: "Servico temporario para QA.",
      base_price_cents: 10000,
      base_duration_minutes: 60,
      is_active: true,
    })
    .select("id")
    .single();
  if (serviceError || !service) throw serviceError ?? new Error("service seed failed");

  const { error: linkError } = await supabase.from("professional_services").insert({
    business_id: business.id,
    professional_id: professional.id,
    service_id: service.id,
    is_active: true,
  });
  if (linkError) throw linkError;

  const { error: workingHoursError } = await supabase.from("professional_working_hours").insert({
    business_id: business.id,
    professional_id: professional.id,
    weekday: targetDate.weekday,
    start_time: "09:00",
    end_time: "12:00",
    is_active: true,
  });
  if (workingHoursError) throw workingHoursError;

  const { error: settingsError } = await supabase.from("professional_booking_settings").insert({
    business_id: business.id,
    professional_id: professional.id,
    buffer_minutes: 0,
    minimum_notice_minutes: 0,
    booking_window_days: 60,
    slot_step_minutes: 30,
    cancellation_notice_minutes: 0,
    reschedule_notice_minutes: 0,
  });
  if (settingsError) throw settingsError;

  return { business, professional, service };
}

async function assertAppIsRunning() {
  const response = await fetch(`${baseUrl}/`);
  assert(response.ok, `app should respond at ${baseUrl}`);
}

async function apiGet(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? `GET ${path} failed`);
  }

  return payload;
}

async function apiPost(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? `POST ${path} failed`);
  }

  return payload;
}

async function apiPostExpectingError(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();

  if (response.ok) {
    throw new Error(`POST ${path} should have failed`);
  }

  return payload;
}

function nextBookableDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  date.setHours(12, 0, 0, 0);

  return {
    date: [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-"),
    weekday: date.getDay(),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadEnv(fileName) {
  try {
    const content = readFileSync(resolve(fileName), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (!match || process.env[match[1]]) continue;

      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional env file.
  }
}
