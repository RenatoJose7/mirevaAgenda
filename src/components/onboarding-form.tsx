"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthNotice } from "@/components/auth-notice";
import { BusinessLogoField } from "@/components/business-logo-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPlanCycleHelper,
  getPlanPriceLabel,
  subscriptionPlans,
  type BillingCycle,
  type PlanId,
} from "@/lib/plans";
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
  const [step, setStep] = useState<"business" | "plan">("business");
  const [theme, setTheme] = useState("mireva");
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("plus");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
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
  const selectedPlanData = subscriptionPlans.find((plan) => plan.id === selectedPlan) ?? subscriptionPlans[0];

  async function handleContinueToPlan() {
    const isValid = await form.trigger();

    if (!isValid) {
      return;
    }

    setMessage(null);
    setStep("plan");
  }

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
          planId: selectedPlan,
          billingCycle,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(getOnboardingErrorMessage(payload?.error ?? "Não foi possível criar o estabelecimento."));
        return;
      }

      if (logoFile) {
        await uploadInitialLogo(logoFile).catch((error) => {
          console.error("initial logo upload failed", error);
        });
      }

      router.push("/dashboard");
    } catch {
      setMessage("Supabase não configurado. Preencha o .env.local para criar o estabelecimento real.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={themeStyle}>
      <Card className="mt-6 shadow-xl shadow-primary/10">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-2xl">Configurar estabelecimento</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Primeiro cadastre as informações principais. Depois escolha o plano inicial.
              </p>
            </div>
            <div className="grid grid-cols-2 rounded-lg border bg-white p-1 text-sm">
              <span
                className={cn(
                  "rounded-md px-3 py-2 text-center font-medium",
                  step === "business" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                1. Dados
              </span>
              <span
                className={cn(
                  "rounded-md px-3 py-2 text-center font-medium",
                  step === "plan" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                2. Plano
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-5">
              <AuthNotice message={message} />
            </div>
          )}

          <form id="onboarding-form" className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
            {step === "business" ? (
              <>
                <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="business-name">Nome do estabelecimento</Label>
                        <Input id="business-name" {...form.register("name")} placeholder="Ex: Clínica Central" />
                        {form.formState.errors.name && (
                          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business-segment">Segmento</Label>
                        <Input
                          id="business-segment"
                          {...form.register("segment")}
                          placeholder="Ex: consultoria, educação, saúde"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business-whatsapp">WhatsApp</Label>
                        <Input id="business-whatsapp" {...form.register("whatsapp")} placeholder="(11) 99999-0000" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business-address">Endereço</Label>
                        <Input id="business-address" {...form.register("address")} placeholder="Rua, número - bairro" />
                      </div>
                    </div>
                    <BusinessLogoField
                      label="Foto do estabelecimento"
                      logoUrl={logoPreviewUrl}
                      disabled={isSubmitting}
                      onLogoPrepared={(file, previewUrl) => {
                        setLogoFile(file);
                        setLogoPreviewUrl(previewUrl);
                      }}
                      onRemove={() => {
                        setLogoFile(null);
                        setLogoPreviewUrl(null);
                      }}
                      onError={setMessage}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="business-note">Observação interna</Label>
                      <Textarea
                        id="business-note"
                        {...form.register("note")}
                        placeholder="Campo visual, sem persistência nesta etapa."
                      />
                    </div>
                  </div>

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
                      <Label>Confirmação de reservas</Label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          ["automatic", "Automática", "Padrão do MVP"],
                          ["manual", "Manual", "Opção visual futura"],
                        ].map(([id, title, helper]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setMode(id as "automatic" | "manual")}
                            className={cn(
                              "rounded-lg border bg-white p-4 text-left",
                              mode === id && "border-primary bg-secondary",
                            )}
                          >
                            <span className="font-medium text-slate-950">{title}</span>
                            <span className="mt-1 block text-sm text-muted-foreground">{helper}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" className="gap-2" onClick={handleContinueToPlan}>
                    Continuar para planos
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="space-y-5">
                  <div className="mx-auto max-w-3xl text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Teste grátis</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">
                      Experimente o {selectedPlanData.name} gratuitamente por 1 mês
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Escolha o plano inicial agora. A cobrança real pelo Asaas entra na próxima etapa.
                    </p>
                  </div>

                  <div className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-lg border bg-white p-1 text-sm">
                    {[
                      ["monthly", "Mensal"],
                      ["annual", "Anual"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setBillingCycle(id as BillingCycle)}
                        className={cn(
                          "rounded-md px-4 py-2 font-medium transition",
                          billingCycle === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    {subscriptionPlans.map((plan) => {
                      const isSelected = selectedPlan === plan.id;

                      return (
                        <button
                          key={plan.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedPlan(plan.id);
                            setMessage(null);
                          }}
                          className={cn(
                            "relative flex min-h-[520px] flex-col rounded-lg border bg-white p-5 text-left transition hover:border-primary/70",
                            isSelected && "border-primary bg-primary/5 ring-2 ring-primary/20",
                          )}
                        >
                          <span className="flex min-h-8 items-start justify-between gap-3">
                            <span className="block text-xl font-semibold text-slate-950">{plan.name}</span>
                            {plan.highlight && (
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                {plan.highlight}
                              </span>
                            )}
                          </span>
                          <span className="mt-6 block">
                            <span className="text-sm text-muted-foreground">Depois do teste</span>
                            <span className="mt-1 block text-3xl font-semibold leading-tight text-slate-950">
                              {getPlanPriceLabel(plan, billingCycle)}
                            </span>
                            <span className="mt-2 block text-xs font-medium text-primary">
                              Primeiro mês grátis
                            </span>
                          </span>
                          <span className="mt-5 block min-h-16 text-sm text-muted-foreground">{plan.description}</span>
                          <span className="mt-5 grid gap-3 text-sm text-slate-700">
                            {plan.features.map((feature) => (
                              <span key={feature} className="flex items-start gap-2">
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                                <span>{feature}</span>
                              </span>
                            ))}
                          </span>
                          <span className="mt-auto pt-6 text-xs text-muted-foreground">
                            {getPlanCycleHelper(plan, billingCycle)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border bg-white p-4 text-center text-sm text-muted-foreground">
                    Plano selecionado: <strong className="text-slate-950">{selectedPlanData.name}</strong> em{" "}
                    <strong className="text-slate-950">{billingCycle === "annual" ? "ciclo anual" : "ciclo mensal"}</strong>.
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setStep("business")}>
                    <ArrowLeft className="size-4" />
                    Voltar para dados
                  </Button>
                  <Button type="submit" className="gap-2" disabled={isSubmitting}>
                    {isSubmitting ? "Criando estabelecimento..." : "Concluir configuração"}
                    {!isSubmitting && <CheckCircle2 className="size-4" />}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function uploadInitialLogo(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/business/logo", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Não foi possível enviar a foto.");
  }
}

function getOnboardingErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("tema inválido") || normalized.includes("businesses_theme_key_check")) {
    return "O tema escolhido ainda não existe no banco. Aplique as migrations mais recentes ou selecione o tema Mireva por enquanto.";
  }

  if (normalized.includes("ja possui") || normalized.includes("já possui") || normalized.includes("already")) {
    return "Este usuário já possui um estabelecimento configurado. Tente acessar o Dashboard.";
  }

  if (normalized.includes("function") || normalized.includes("schema cache") || normalized.includes("create_business_for_current_user")) {
    return "A migration de onboarding ainda não foi aplicada no Supabase. Aplique as migrations e tente novamente.";
  }

  if (normalized.includes("billing_cycle") || normalized.includes("business_subscriptions_billing_cycle")) {
    return "A migration de ciclo de cobrança ainda não foi aplicada no Supabase. Aplique as migrations e tente novamente.";
  }

  return `Não foi possível criar o estabelecimento: ${message}`;
}
