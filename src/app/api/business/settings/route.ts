import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const allowedThemes = ["mireva", "essencial", "premium", "calmo", "editorial"] as const;
const allowedModes = ["automatic", "manual"] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  segment: z.string().trim().max(80).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(180).optional().nullable(),
  themeKey: z.enum(allowedThemes),
  bookingConfirmationMode: z.enum(allowedModes),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente para salvar as configurações." }, { status: 401 });
  }

  const business = await getCurrentBusiness(user.id);

  if (!business) {
    return NextResponse.json({ error: "Estabelecimento não configurado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados do estabelecimento." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Apenas o proprietário pode alterar as configurações." }, { status: 403 });
  }

  const { data: subscription } = await admin
    .from("business_subscriptions")
    .select("plan_id")
    .eq("business_id", business.id)
    .maybeSingle();
  const isBasicPlan = !subscription || subscription.plan_id === "basic";
  const input = parsed.data;
  const themeKey = isBasicPlan ? "mireva" : input.themeKey;

  if (isBasicPlan && input.themeKey !== "mireva") {
    return NextResponse.json(
      { error: "Assine o plano Plus para desbloquear a personalização visual." },
      { status: 403 },
    );
  }

  const { data, error } = await admin
    .from("businesses")
    .update({
      name: input.name,
      slug: input.slug,
      segment: normalizeOptional(input.segment),
      whatsapp: normalizeOptional(input.whatsapp),
      address: normalizeOptional(input.address),
      theme_key: themeKey,
      booking_confirmation_mode: input.bookingConfirmationMode,
    })
    .eq("id", business.id)
    .select("name,address,logo_url,slug,theme_key,booking_confirmation_mode")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: getBusinessSettingsError(error?.code) }, { status: 400 });
  }

  return NextResponse.json({ business: data });
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getBusinessSettingsError(code?: string) {
  if (code === "23505") {
    return "Este nome do link já está em uso. Escolha outro.";
  }

  return "Não foi possível salvar as configurações.";
}
