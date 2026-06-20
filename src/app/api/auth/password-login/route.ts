import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { translateAuthError } from "@/lib/auth/messages";
import { sanitizeAuthRedirectPath } from "@/lib/auth/redirect";
import { clearSupabaseAuthCookieStore } from "@/lib/supabase/cookies";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteClient } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe e-mail e senha para entrar." }, { status: 400 });
  }

  clearSupabaseAuthCookieStore(await cookies());

  const { supabase, applyCookies } = await createRouteClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  });

  if (error) {
    return applyCookies(NextResponse.json({ error: translateAuthError(error.message) }, { status: 401 }));
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .limit(1)
    .maybeSingle();

  return applyCookies(
    NextResponse.json({
      redirectTo: membership?.business_id ? sanitizeAuthRedirectPath(parsed.data.next) : "/onboarding",
    }),
  );
}
