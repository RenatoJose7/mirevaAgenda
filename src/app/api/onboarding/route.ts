import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { planIds } from "@/lib/plans";
import { createAdminClient, getAdminClientDiagnostics } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const allowedThemes = ["mireva", "essencial", "premium", "calmo", "editorial"] as const;
const allowedModes = ["automatic", "manual"] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  segment: z.string().trim().max(80).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(180).optional().nullable(),
  themeKey: z.enum(allowedThemes),
  bookingConfirmationMode: z.enum(allowedModes),
  planId: z.enum(planIds),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão obrigatória para concluir o onboarding." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados do estabelecimento." }, { status: 400 });
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: existingMembership, error: membershipError } = await getExistingMembership(admin, user.id);

  if (membershipError) {
    console.error("onboarding membership check failed", {
      admin: getAdminClientDiagnostics(),
      code: membershipError.code,
      message: membershipError.message,
    });

    return NextResponse.json({ error: getSchemaMessage(membershipError.message) }, { status: 500 });
  }

  if (existingMembership?.business_id) {
    return NextResponse.json({ error: "Este usuario ja possui um estabelecimento configurado." }, { status: 409 });
  }

  const slug = await getAvailableSlug(admin, input.name);

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json({ error: "Não foi possível preparar o perfil do usuario." }, { status: 500 });
  }

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .insert({
      name: input.name,
      slug,
      segment: normalizeOptional(input.segment),
      whatsapp: normalizeOptional(input.whatsapp),
      address: normalizeOptional(input.address),
      theme_key: input.themeKey,
      booking_confirmation_mode: input.bookingConfirmationMode,
    })
    .select("id,slug")
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: getDatabaseMessage(businessError?.message) }, { status: 400 });
  }

  const { error: memberError } = await admin.from("business_members").insert({
    business_id: business.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    await admin.from("businesses").delete().eq("id", business.id);
    return NextResponse.json({ error: "Não foi possível vincular o usuario ao estabelecimento." }, { status: 500 });
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("business_subscriptions")
    .insert({
      business_id: business.id,
      plan_id: input.planId,
      status: "trialing",
    })
    .select("id,business_id,plan_id,status,max_professionals,max_services")
    .single();

  if (subscriptionError || !subscription) {
    await admin.from("businesses").delete().eq("id", business.id);
    return NextResponse.json({ error: getSubscriptionMessage(subscriptionError?.message) }, { status: 500 });
  }

  return NextResponse.json({ business, subscription });
}

async function getAvailableSlug(admin: ReturnType<typeof createAdminClient>, name: string) {
  const baseSlug = slugify(name) || "negócio";
  let candidate = baseSlug;
  let suffix = 1;

  while (suffix < 100) {
    const { data } = await admin.from("businesses").select("id").eq("slug", candidate).maybeSingle();

    if (!data) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return `${baseSlug}-${Date.now()}`;
}

async function getExistingMembership(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const query = () =>
    admin
      .from("business_members")
      .select("business_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

  const firstAttempt = await query();

  if (!isSchemaCacheError(firstAttempt.error?.message)) {
    return firstAttempt;
  }

  await wait(800);
  return query();
}

function isSchemaCacheError(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("schema cache") || normalized.includes("could not find the table");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getDatabaseMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("businesses_theme_key_check")) {
    return "O tema escolhido ainda não existe no banco. Aplique as migrations mais recentes ou selecione o tema Mireva por enquanto.";
  }

  if (normalized.includes("booking_confirmation_mode")) {
    return "Modo de confirmação inválido.";
  }

  return "Não foi possível criar o estabelecimento.";
}

function getSubscriptionMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";

  if (isSchemaCacheError(message) || normalized.includes("business_subscriptions")) {
    return "A migration de planos ainda n\u00e3o foi aplicada no Supabase. Aplique as migrations e tente novamente.";
  }

  if (normalized.includes("plano") || normalized.includes("plan")) {
    return "O plano selecionado n\u00e3o est\u00e1 dispon\u00edvel. Escolha outro plano e tente novamente.";
  }

  return "N\u00e3o foi poss\u00edvel salvar o plano inicial do estabelecimento.";
}

function getSchemaMessage(message?: string) {
  if (isSchemaCacheError(message)) {
    return "O Supabase ainda não atualizou o cache das tabelas. Aguarde alguns segundos e tente concluir novamente.";
  }

  return "Não foi possível verificar o onboarding.";
}
