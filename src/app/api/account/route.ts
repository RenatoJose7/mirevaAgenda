import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { clearSupabaseAuthCookies } from "@/lib/supabase/cookies";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const businessLogosBucket = "business-logos";
const schema = z.object({
  confirmation: z.literal("APAGAR"),
});

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente para apagar a conta." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Digite APAGAR para confirmar a exclusão da conta." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("business_members")
    .select("business_id,role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: "Não foi possível validar a conta antes da exclusão." }, { status: 500 });
  }

  if (membership?.business_id && membership.role === "owner") {
    const { data: business } = await admin
      .from("businesses")
      .select("logo_path")
      .eq("id", membership.business_id)
      .maybeSingle();

    await admin.from("payment_webhook_events").delete().eq("business_id", membership.business_id);
    await admin.from("business_subscriptions").delete().eq("business_id", membership.business_id);

    const { error: businessError } = await admin.from("businesses").delete().eq("id", membership.business_id);

    if (businessError) {
      return NextResponse.json({ error: "Não foi possível apagar os dados do estabelecimento." }, { status: 500 });
    }

    if (business?.logo_path) {
      await admin.storage.from(businessLogosBucket).remove([business.logo_path]);
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id, false);

  if (deleteUserError) {
    return NextResponse.json({ error: "Não foi possível apagar o usuário do Supabase Auth." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  clearSupabaseAuthCookies(request, response);

  return response;
}
