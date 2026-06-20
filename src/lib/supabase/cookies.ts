import type { NextRequest, NextResponse } from "next/server";

type MutableCookieStore = {
  getAll(): Array<{ name: string }>;
  delete(name: string): void;
};

const authCookieHints = ["auth-token", "code-verifier", "provider-token"];

export function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach((cookie) => {
    if (!isSupabaseAuthCookie(cookie.name)) {
      return;
    }

    response.cookies.set(cookie.name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  });
}

export function clearSupabaseAuthCookieStore(cookieStore: MutableCookieStore) {
  cookieStore.getAll().forEach((cookie) => {
    if (!isSupabaseAuthCookie(cookie.name)) {
      return;
    }

    try {
      cookieStore.delete(cookie.name);
    } catch {
      // Server Components cannot mutate cookies, but Route Handlers can.
    }
  });
}

export function isRefreshTokenError(message?: string | null) {
  const normalized = message?.toLowerCase() ?? "";

  return normalized.includes("invalid refresh token") || normalized.includes("refresh token not found");
}

function isSupabaseAuthCookie(name: string) {
  const normalized = name.toLowerCase();

  return normalized.startsWith("sb-") && authCookieHints.some((hint) => normalized.includes(hint));
}
