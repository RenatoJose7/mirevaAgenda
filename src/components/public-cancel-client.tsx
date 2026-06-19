"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { AuthNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PublicCancelClient({ slug, token }: { slug: string; token: string }) {
  const [summary, setSummary] = useState<string>("Carregando reserva...");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/${slug}/cancel/${token}`)
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ok) {
          setSummary("Reserva nao encontrada.");
          return;
        }
        setSummary(`${payload.appointment.appointment_date} as ${payload.appointment.start_time.slice(0, 5)}`);
      });
  }, [slug, token]);

  async function cancel() {
    const response = await fetch(`/api/public/${slug}/cancel/${token}`, { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "Nao foi possivel cancelar." });
      return;
    }

    setDone(true);
    setMessage({ type: "success", text: "Reserva cancelada com sucesso." });
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <XCircle className="mb-3 size-8 text-rose-600" />
            <h1 className="text-3xl font-semibold text-slate-950">Cancelar reserva</h1>
            <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
          </div>
          {message && <AuthNotice type={message.type} message={message.text} />}
          <Button variant="destructive" className="w-full" onClick={cancel} disabled={done}>
            Confirmar cancelamento
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/agendar/${slug}`}>Voltar</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
