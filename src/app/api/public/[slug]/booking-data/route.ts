import { NextResponse } from "next/server";
import { getPublicBookingData } from "@/lib/appointments/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  try {
    const data = await getPublicBookingData(slug);

    if (!data) {
      return NextResponse.json({ error: "Estabelecimento não encontrado." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar dados públicos." },
      { status: 500 },
    );
  }
}
