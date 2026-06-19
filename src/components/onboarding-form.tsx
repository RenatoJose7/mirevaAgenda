"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { themes } from "@/lib/themes";
import { useThemeStyle } from "@/lib/use-theme-style";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Informe o nome do estabelecimento."),
  segment: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function OnboardingForm() {
  const router = useRouter();
  const [theme, setTheme] = useState("mireva");
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false);
  const themeStyle = useThemeStyle(theme);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      segment: "",
      whatsapp: "",
      address: "",
      note: "",
    },
  });

  async function handleSubmit(values: FormData) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          segment: values.segment || null,
          whatsapp: values.whatsapp || null,
          address: values.address || null,
          themeKey: theme,
          bookingConfirmationMode: mode,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(getOnboardingErrorMessage(payload?.error ?? "Nao foi possivel criar o estabelecimento."));
        return;
      }

      router.push("/dashboard");
    } catch {
      setMessage("Supabase nao configurado. Preencha o .env.local para criar o estabelecimento real.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={themeStyle}>
      <Card className="mt-6 shadow-xl shadow-primary/10">
        <CardHeader>
          <CardTitle className="text-2xl">Configurar estabelecimento</CardTitle>
          <p className="text-sm text-muted-foreground">
            Crie o primeiro estabelecimento do SaaS. Os dados operacionais seguem demonstrativos.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <form id="onboarding-form" className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
          {message && <AuthNotice message={message} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business-name">Nome do estabelecimento</Label>
              <Input id="business-name" {...form.register("name")} placeholder="Ex: Clinica Central" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-segment">Segmento</Label>
              <Input id="business-segment" {...form.register("segment")} placeholder="Ex: consultoria, educacao, saude" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-whatsapp">WhatsApp</Label>
              <Input id="business-whatsapp" {...form.register("whatsapp")} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-address">Endereco</Label>
              <Input id="business-address" {...form.register("address")} placeholder="Rua, numero - bairro" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logo do estabelecimento</Label>
            <button
              type="button"
              onClick={() => setIsLogoDialogOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-secondary px-4 py-8 text-sm font-medium text-muted-foreground"
            >
              <Upload className="size-4" />
              Selecionar logo visual
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-note">Observacao interna</Label>
            <Textarea
              id="business-note"
              {...form.register("note")}
              placeholder="Campo visual, sem persistencia nesta etapa."
            />
          </div>
        </form>

        <div className="space-y-5">
          <div>
            <Label>Temas prontos</Label>
            <div className="mt-3 grid gap-3">
              {themes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border bg-white p-3 text-left transition",
                    theme === option.id && "border-primary ring-2 ring-primary/15",
                  )}
                >
                  <span>
                    <span className="block font-medium text-slate-950">{option.name}</span>
                    <span className="text-sm text-muted-foreground">{option.description}</span>
                  </span>
                  <span className="flex gap-1">
                    {option.colors.map((color) => (
                      <span key={color} className="size-5 rounded-full border" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Confirmacao de reservas</Label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["automatic", "Automatica", "Padrao do MVP"],
                ["manual", "Manual", "Opcao visual futura"],
              ].map(([id, title, helper]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id as "automatic" | "manual")}
                  className={cn("rounded-lg border bg-white p-4 text-left", mode === id && "border-primary bg-secondary")}
                >
                  <span className="font-medium text-slate-950">{title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{helper}</span>
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" type="submit" form="onboarding-form" disabled={isSubmitting}>
            {isSubmitting ? "Criando estabelecimento..." : "Concluir configuracao"}
          </Button>
        </div>
        </CardContent>
      </Card>
      <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
        <DialogContent style={themeStyle}>
          <DialogHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            <DialogTitle>Upload de logo ainda nao esta ativo</DialogTitle>
            <DialogDescription>
              Nesta etapa o cadastro do estabelecimento ja funciona, mas o envio real de logo e arquivos fica para uma etapa futura com storage configurado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setIsLogoDialogOpen(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getOnboardingErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("tema invalido") || normalized.includes("businesses_theme_key_check")) {
    return "O tema escolhido ainda nao existe no banco. Aplique as migrations mais recentes ou selecione o tema Mireva por enquanto.";
  }

  if (normalized.includes("ja possui") || normalized.includes("already")) {
    return "Este usuario ja possui um estabelecimento configurado. Tente acessar o Dashboard.";
  }

  if (normalized.includes("function") || normalized.includes("schema cache") || normalized.includes("create_business_for_current_user")) {
    return "A migration de onboarding ainda nao foi aplicada no Supabase. Aplique as migrations e tente novamente.";
  }

  return `Nao foi possivel criar o estabelecimento: ${message}`;
}
