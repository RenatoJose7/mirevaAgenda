import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, getSupabaseConfig } from "@/lib/supabase/env";
import { clearSupabaseAuthCookies, isRefreshTokenError } from "@/lib/supabase/cookies";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  let nextResponse = response;
  const { url, key } = getSupabaseConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        nextResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => nextResponse.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.getClaims();

  if (isRefreshTokenError(error?.message)) {
    clearSupabaseAuthCookies(request, nextResponse);
  }

  return nextResponse;
}
