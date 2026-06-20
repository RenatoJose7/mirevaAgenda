import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { translateAuthError } from "@/lib/auth/messages";
import { clearSupabaseAuthCookieStore } from "@/lib/supabase/cookies";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteClient } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  token: z.string().trim().min(6).max(12),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe o código completo recebido por e-mail." }, { status: 400 });
  }

  clearSupabaseAuthCookieStore(await cookies());

  const { supabase, applyCookies } = await createRouteClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email.trim().toLowerCase(),
    token: parsed.data.token,
    type: "signup",
  });

  if (error) {
    return applyCookies(NextResponse.json({ error: translateAuthError(error.message) }, { status: 401 }));
  }

  return applyCookies(NextResponse.json({ redirectTo: "/onboarding" }));
}
