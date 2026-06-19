import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublicBusinessResult = {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  address: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = sanitizeSearchTerm(searchParams.get("q") ?? "");

  if (term.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createAdminClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,slug,segment,address")
    .or(`name.ilike.%${term}%,segment.ilike.%${term}%`)
    .order("name", { ascending: true })
    .limit(12);

  if (error || !businesses?.length) {
    return NextResponse.json({ results: [] });
  }

  const businessIds = businesses.map((business) => business.id);
  const [servicesResult, professionalsResult, linksResult] = await Promise.all([
    supabase.from("services").select("business_id").in("business_id", businessIds).eq("is_active", true).is("deleted_at", null),
    supabase.from("professionals").select("business_id").in("business_id", businessIds).eq("is_active", true).is("deleted_at", null),
    supabase.from("professional_services").select("business_id").in("business_id", businessIds).eq("is_active", true),
  ]);

  const services = new Set((servicesResult.data ?? []).map((item) => item.business_id));
  const professionals = new Set((professionalsResult.data ?? []).map((item) => item.business_id));
  const links = new Set((linksResult.data ?? []).map((item) => item.business_id));

  const results = (businesses as PublicBusinessResult[])
    .filter((business) => services.has(business.id) && professionals.has(business.id) && links.has(business.id))
    .slice(0, 8)
    .map((business) => ({
      name: business.name,
      slug: business.slug,
      segment: business.segment,
      address: business.address,
    }));

  return NextResponse.json({ results });
}

function sanitizeSearchTerm(value: string) {
  return value.trim().replace(/[%_,]/g, "").slice(0, 80);
}
