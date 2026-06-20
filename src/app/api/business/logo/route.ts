import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bucketName = "business-logos";
const maxFileSize = 1024 * 1024;
const allowedMimeTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessao obrigatoria para enviar a foto." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione uma imagem para enviar." }, { status: 400 });
  }

  if (!isAllowedMimeType(file.type)) {
    return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WEBP." }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return NextResponse.json({ error: "A imagem precisa ter ate 1MB." }, { status: 400 });
  }

  const supabase = await createClient();
  const { businessId, role, logoPath } = await getMembershipContext(supabase, user.id);

  if (!businessId) {
    return NextResponse.json({ error: "Configure o estabelecimento antes de enviar a foto." }, { status: 409 });
  }

  if (role !== "owner") {
    return NextResponse.json({ error: "Apenas o responsavel pelo estabelecimento pode alterar a foto." }, { status: 403 });
  }

  const extension = allowedMimeTypes[file.type];
  const path = `${businessId}/logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: "Nao foi possivel enviar a imagem. Verifique se a migration de Storage foi aplicada." }, { status: 400 });
  }

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;
  const { data: business, error: updateError } = await supabase
    .from("businesses")
    .update({ logo_url: logoUrl, logo_path: path })
    .eq("id", businessId)
    .select("logo_url,logo_path")
    .single();

  if (updateError || !business) {
    await supabase.storage.from(bucketName).remove([path]);
    return NextResponse.json({ error: "Nao foi possivel salvar a foto no estabelecimento." }, { status: 400 });
  }

  if (logoPath && logoPath !== path) {
    await supabase.storage.from(bucketName).remove([logoPath]);
  }

  return NextResponse.json({ logoUrl: business.logo_url, logoPath: business.logo_path });
}

export async function DELETE() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sessao obrigatoria para remover a foto." }, { status: 401 });
  }

  const supabase = await createClient();
  const { businessId, role, logoPath } = await getMembershipContext(supabase, user.id);

  if (!businessId) {
    return NextResponse.json({ error: "Estabelecimento nao encontrado." }, { status: 404 });
  }

  if (role !== "owner") {
    return NextResponse.json({ error: "Apenas o responsavel pelo estabelecimento pode remover a foto." }, { status: 403 });
  }

  const { error } = await supabase
    .from("businesses")
    .update({ logo_url: null, logo_path: null })
    .eq("id", businessId);

  if (error) {
    return NextResponse.json({ error: "Nao foi possivel remover a foto do estabelecimento." }, { status: 400 });
  }

  if (logoPath) {
    await supabase.storage.from(bucketName).remove([logoPath]);
  }

  return NextResponse.json({ logoUrl: null, logoPath: null });
}

function isAllowedMimeType(value: string): value is keyof typeof allowedMimeTypes {
  return value in allowedMimeTypes;
}

async function getMembershipContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id,role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership?.business_id) {
    return { businessId: null, role: null, logoPath: null };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", membership.business_id)
    .maybeSingle();

  return {
    businessId: membership.business_id as string,
    role: membership.role as string,
    logoPath: business?.logo_path as string | null | undefined,
  };
}
