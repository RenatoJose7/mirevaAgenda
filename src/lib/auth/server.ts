import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AppBusiness = {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  whatsapp: string | null;
  address: string | null;
  logo_url: string | null;
  logo_path: string | null;
  theme_key: string;
  booking_confirmation_mode: "automatic" | "manual";
};

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getCurrentBusiness(userId?: string): Promise<AppBusiness | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const user = userId ? { id: userId } : await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.business_id) {
    return null;
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,slug,segment,whatsapp,address,logo_url,logo_path,theme_key,booking_confirmation_mode")
    .eq("id", membership.business_id)
    .maybeSingle();

  return (business as AppBusiness | null) ?? null;
}

export async function requireUser() {
  if (!isSupabaseConfigured()) {
    redirect("/login?erro=supabase-env");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireBusiness() {
  const user = await requireUser();
  const business = await getCurrentBusiness(user.id);

  if (!business) {
    redirect("/onboarding");
  }

  return business;
}
