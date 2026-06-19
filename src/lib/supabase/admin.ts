import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/env";

export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!key) {
    throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY no .env.local para rotas publicas seguras.");
  }

  return createSupabaseClient(url, key, {
    global: {
      fetch: noStoreFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getAdminClientDiagnostics() {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

  return {
    projectRef: new URL(url).hostname.split(".")[0],
    keyLength: key.length,
    keyKind: key.startsWith("sb_secret_") ? "secret" : key.startsWith("eyJ") ? "jwt" : "unknown",
  };
}

function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}
