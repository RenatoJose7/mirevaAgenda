import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, LayoutDashboard, Sparkles } from "lucide-react";
import { AppVersion } from "@/components/app-version";
import { BrandMark } from "@/components/brand-mark";
import { PublicBusinessSearch } from "@/components/public-business-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type HomePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const authCode = getFirstSearchParam(params.code);

  if (authCode) {
    const callbackParams = new URLSearchParams({ code: authCode });
    const next = getFirstSearchParam(params.next);

    if (next) {
      callbackParams.set("next", next);
    }

    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  return (
    <main className="mireva-grid min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between rounded-lg border bg-white/86 px-4 py-3 shadow-sm backdrop-blur">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/cadastro">Criar conta</Link>
            </Button>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-9rem)] items-center gap-8 py-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Badge className="mb-5 bg-primary/10 text-primary hover:bg-primary/10">Plataforma de agendamentos</Badge>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
              Mireva Agenda para negócios que vivem de horário marcado.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Encontre um estabelecimento para agendar ou entre para gerenciar profissionais,
              serviços, disponibilidade e reservas do seu negócio.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link href="/cadastro">
                  Criar conta
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Entrar como profissional</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-5">
            <PublicBusinessSearch />
            <Card className="overflow-hidden border-primary/15">
              <CardContent className="p-0">
                <div className="border-b bg-primary p-5 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80">Painel do estabelecimento</p>
                      <h2 className="text-2xl font-semibold">Agenda de hoje</h2>
                    </div>
                    <Sparkles className="size-6" />
                  </div>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <div className="rounded-lg bg-secondary p-4">
                    <CalendarDays className="mb-3 size-5 text-primary" />
                    <strong className="block text-xl text-slate-950">Reservas</strong>
                    <span className="text-sm text-muted-foreground">horários, status e clientes</span>
                  </div>
                  <div className="rounded-lg bg-secondary p-4">
                    <LayoutDashboard className="mb-3 size-5 text-primary" />
                    <strong className="block text-xl text-slate-950">Operação</strong>
                    <span className="text-sm text-muted-foreground">serviços, equipe e disponibilidade</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
        <AppVersion className="pb-2" />
      </div>
    </main>
  );
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
