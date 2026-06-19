import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCurrentBusiness(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

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
    .select("id,name,slug,segment,whatsapp,address,theme_key,booking_confirmation_mode")
    .eq("id", membership.business_id)
    .maybeSingle();

  return business;
}
