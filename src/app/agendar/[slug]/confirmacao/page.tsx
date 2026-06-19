import Link from "next/link";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { PublicBookingHeader } from "@/components/public-booking-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getThemeStyle } from "@/lib/themes";

export default async function ConfirmacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const status = String(query.status ?? "");
  const date = String(query.data ?? "");
  const time = String(query.horario ?? "");
  const cancelToken = String(query.cancelar ?? "");
  const rescheduleToken = String(query.remarcar ?? "");
  const themeKey = String(query.tema ?? "mireva");

  return (
    <main className="min-h-screen bg-background" style={getThemeStyle(themeKey)}>
      <PublicBookingHeader />
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-4xl place-items-center px-4 py-8">
        <Card className="w-full border-primary/20 shadow-xl shadow-primary/10">
          <CardContent className="p-6 text-center md:p-10">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-9" />
            </span>
            <h1 className="mt-5 text-3xl font-semibold text-slate-950">Reserva recebida</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {status === "pending"
                ? "Seu agendamento foi enviado e aguarda confirmacao do estabelecimento."
                : "Seu agendamento foi confirmado com sucesso."}
            </p>
            <div className="mx-auto mt-6 max-w-xl rounded-lg bg-secondary p-5 text-left text-sm">
              <p><strong>Data:</strong> {date || "Nao informada"}</p>
              <p><strong>Horario:</strong> {time || "Nao informado"}</p>
              <p><strong>Status:</strong> {status === "pending" ? "Aguardando confirmacao" : "Confirmado"}</p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="gap-2">
                <Link href="/">
                  <CheckCircle2 className="size-4" />
                  Concluido
                </Link>
              </Button>
              {rescheduleToken && (
                <Button asChild variant="outline" className="gap-2">
                  <Link href={`/agendar/${slug}/remarcar/${rescheduleToken}`}>
                    <CalendarDays className="size-4" />
                    Remarcar
                  </Link>
                </Button>
              )}
              {cancelToken && (
                <Button asChild variant="outline">
                  <Link href={`/agendar/${slug}/cancelar/${cancelToken}`}>Cancelar</Link>
                </Button>
              )}
              <Button asChild variant="secondary">
                <Link href={`/agendar/${slug}`}>Novo agendamento</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
