"use client";

import { useState } from "react";
import { CreditCard, Eye, Lock, Settings, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthNotice } from "@/components/auth-notice";
import { AdminShell } from "@/components/admin-shell";
import { BusinessLogoField } from "@/components/business-logo-field";
import { SectionHeading } from "@/components/section-heading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppBusiness } from "@/lib/auth/server";
import { slugify, type BusinessSubscriptionRecord, type PlanUsage } from "@/lib/business/types";
import {
  getPlanPriceLabel,
  getSubscriptionPlan,
  subscriptionPlans,
  subscriptionStatusLabels,
  type PlanId,
} from "@/lib/plans";
import { themes } from "@/lib/themes";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Informe o nome do estabelecimento."),
  slug: z
    .string()
    .min(2, "Informe o nome do link.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras, números e hifens."),
  segment: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
});

type SettingsForm = z.infer<typeof schema>;

export function SettingsView({ business, usage }: { business: AppBusiness; usage: PlanUsage }) {
  const [theme, setTheme] = useState(business.theme_key || "mireva");
  const [mode, setMode] = useState(business.booking_confirmation_mode);
  const [businessName, setBusinessName] = useState(business.name);
  const [businessAddress, setBusinessAddress] = useState(business.address ?? "");
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? null);
  const [publicSlug, setPublicSlug] = useState(business.slug);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [planMessage, setPlanMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [accountMessage, setAccountMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [subscription, setSubscription] = useState<BusinessSubscriptionRecord | null>(usage.subscription);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>(getSubscriptionPlan(usage.subscription?.plan_id).id);
  const [isPlanChooserOpen, setIsPlanChooserOpen] = useState(false);
  const [changingPlanId, setChangingPlanId] = useState<PlanId | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState<PlanId | null>(null);
  const [checkoutCpfCnpj, setCheckoutCpfCnpj] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const currentPlan = getSubscriptionPlan(currentPlanId);
  const billingCycle = subscription?.billing_cycle ?? "monthly";
  const canCustomizeTheme = currentPlanId !== "basic";
  const visibleTheme = canCustomizeTheme ? theme : "mireva";
  const selected = themes.find((item) => item.id === visibleTheme) ?? themes[0];
  const maxProfessionals = subscription?.max_professionals ?? currentPlan.maxProfessionals;
  const maxServices = subscription?.max_services ?? currentPlan.maxServices;
  const statusLabel = subscriptionStatusLabels[subscription?.status ?? "trialing"];
  const form = useForm<SettingsForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: business.name,
      slug: business.slug,
      segment: business.segment ?? "",
      whatsapp: business.whatsapp ?? "",
      address: business.address ?? "",
    },
  });

  async function handleSave(values: SettingsForm) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/business/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          slug: values.slug.trim(),
          segment: values.segment?.trim() || null,
          whatsapp: values.whatsapp?.trim() || null,
          address: values.address?.trim() || null,
          themeKey: canCustomizeTheme ? theme : "mireva",
          bookingConfirmationMode: mode,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        business?: {
          name: string;
          address: string | null;
          logo_url: string | null;
          slug: string;
          theme_key: string;
          booking_confirmation_mode: "automatic" | "manual";
        };
        error?: string;
      } | null;

      if (!response.ok || !payload?.business) {
        setMessage({ type: "error", text: payload?.error ?? "Não foi possível salvar as configurações." });
        return;
      }

      setBusinessName(payload.business.name);
      setBusinessAddress(payload.business.address ?? "");
      setLogoUrl(payload.business.logo_url ?? null);
      setPublicSlug(payload.business.slug);
      setTheme(payload.business.theme_key);
      setMode(payload.business.booking_confirmation_mode);
      setMessage({ type: "success", text: "Configurações salvas com sucesso." });
    } catch {
      setMessage({ type: "error", text: "Supabase não configurado ou sessão expirada." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setIsUploadingLogo(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/business/logo", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { logoUrl?: string | null; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível enviar a foto.");
      }

      setLogoUrl(payload?.logoUrl ?? null);
      setMessage({ type: "success", text: "Foto do estabelecimento atualizada." });
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleLogoRemove() {
    setIsUploadingLogo(true);
    setMessage(null);

    try {
      const response = await fetch("/api/business/logo", {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível remover a foto.");
      }

      setLogoUrl(null);
      setMessage({ type: "success", text: "Foto do estabelecimento removida." });
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handlePlanChange(planId: PlanId) {
    if (planId === currentPlanId) {
      return;
    }

    setChangingPlanId(planId);
    setPlanMessage(null);

    try {
      const response = await fetch("/api/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        subscription?: BusinessSubscriptionRecord;
        error?: string;
      } | null;

      if (!response.ok || !payload?.subscription) {
        throw new Error(payload?.error ?? "Não foi possível alterar o plano agora.");
      }

      setSubscription(payload.subscription);
      setCurrentPlanId(payload.subscription.plan_id);
      if (payload.subscription.plan_id === "basic") {
        setTheme("mireva");
      }
      setPlanMessage({
        type: "success",
        text: "Plano atualizado com sucesso.",
      });
    } catch (error) {
      setPlanMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível alterar o plano agora.",
      });
    } finally {
      setChangingPlanId(null);
    }
  }

  async function handleCheckout(planId: PlanId) {
    setCheckoutPlanId(planId);
    setPlanMessage(null);

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle, cpfCnpj: checkoutCpfCnpj }),
      });
      const payload = (await response.json().catch(() => null)) as {
        checkoutUrl?: string;
        subscription?: BusinessSubscriptionRecord;
        error?: string;
      } | null;

      if (!response.ok || !payload?.checkoutUrl || !payload.subscription) {
        throw new Error(payload?.error ?? "Não foi possível criar o checkout do Asaas.");
      }

      setSubscription(payload.subscription);
      setCurrentPlanId(payload.subscription.plan_id);
      if (payload.subscription.plan_id === "basic") {
        setTheme("mireva");
      }
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setPlanMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível criar o checkout do Asaas.",
      });
      setCheckoutPlanId(null);
    }
  }

  async function handleDeleteAccount() {
    setIsDeletingAccount(true);
    setAccountMessage(null);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation.trim().toUpperCase() }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Não foi possível apagar a conta agora.");
      }

      window.location.assign("/login");
    } catch (error) {
      setAccountMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível apagar a conta agora.",
      });
      setIsDeletingAccount(false);
    }
  }

  return (
    <AdminShell
      title="Configurações"
      description="Dados reais do estabelecimento e preferências visuais."
      businessName={businessName}
      businessLogoUrl={logoUrl}
      themeKey={visibleTheme}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-5 p-5">
            <SectionHeading title="Dados do estabelecimento" icon={Settings} />
            {message && <AuthNotice type={message.type} message={message.text} />}
            <form id="settings-form" className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(handleSave)}>
              <div className="space-y-2">
                <Label htmlFor="business-name">Nome</Label>
                <Input
                  id="business-name"
                  {...form.register("name")}
                  onBlur={(event) => {
                    if (!form.getValues("slug")) {
                      form.setValue("slug", slugify(event.target.value));
                    }
                  }}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-slug">Nome do link</Label>
                <Input id="business-slug" {...form.register("slug")} />
                {form.formState.errors.slug && (
                  <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-segment">Segmento</Label>
                <Input id="business-segment" {...form.register("segment")} placeholder="Ex: consultoria, educação, saúde" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-whatsapp">WhatsApp</Label>
                <Input id="business-whatsapp" {...form.register("whatsapp")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="business-address">Endereço</Label>
                <Input id="business-address" {...form.register("address")} />
              </div>
            </form>
            <BusinessLogoField
              label="Foto do estabelecimento"
              logoUrl={logoUrl}
              isBusy={isUploadingLogo}
              onLogoPrepared={handleLogoUpload}
              onRemove={handleLogoRemove}
              onError={(text) => setMessage({ type: "error", text })}
            />
            <div className="rounded-lg border bg-white p-4 text-sm">
              <p className="font-medium text-slate-950">Link público de agendamento</p>
              <p className="mt-1 break-all text-muted-foreground">/agendar/{publicSlug}</p>
              <Button
                className="mt-3"
                type="button"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/agendar/${publicSlug}`)}
              >
                Copiar link público
              </Button>
            </div>
            <Button type="submit" form="settings-form" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar configurações"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 p-5">
              <SectionHeading title="Assinatura" icon={CreditCard} />
              {planMessage && <AuthNotice type={planMessage.type} message={planMessage.text} />}

              <div className="rounded-lg border bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Plano atual</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-950">{currentPlan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{getPlanPriceLabel(currentPlan, billingCycle)}</p>
                  </div>
                  <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {statusLabel}
                  </span>
                </div>
                {subscription?.provider_checkout_id && !subscription.provider_subscription_id && (
                  <p className="mt-3 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                    Checkout Asaas criado. Continue pelo botão abaixo se ainda não concluiu o pagamento.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-secondary p-4">
                  <p className="text-sm text-muted-foreground">Profissionais</p>
                  <strong className="mt-1 block text-2xl text-slate-950">
                    {usage.professionalsCount}/{maxProfessionals}
                  </strong>
                </div>
                <div className="rounded-lg bg-secondary p-4">
                  <p className="text-sm text-muted-foreground">Serviços</p>
                  <strong className="mt-1 block text-2xl text-slate-950">
                    {usage.servicesCount}/{maxServices}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-cpf-cnpj">CPF/CNPJ para cobrança</Label>
                <Input
                  id="subscription-cpf-cnpj"
                  value={checkoutCpfCnpj}
                  inputMode="numeric"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  onChange={(event) => setCheckoutCpfCnpj(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Necessário para abrir o checkout no Asaas.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setIsPlanChooserOpen((current) => !current)}>
                  {isPlanChooserOpen ? "Ocultar planos" : "Alterar plano"}
                </Button>
                <Button type="button" disabled={checkoutPlanId !== null} onClick={() => void handleCheckout(currentPlanId)}>
                  {checkoutPlanId === currentPlanId
                    ? "Abrindo Asaas..."
                    : subscription?.provider_checkout_id
                      ? "Continuar no Asaas"
                      : "Assinar com Asaas"}
                </Button>
              </div>

              {isPlanChooserOpen && (
                <div className="space-y-3">
                  {subscriptionPlans.map((plan) => {
                    const isCurrent = plan.id === currentPlanId;
                    const isOverProfessionals = usage.professionalsCount > plan.maxProfessionals;
                    const isOverServices = usage.servicesCount > plan.maxServices;

                    return (
                      <div
                        key={plan.id}
                        className={cn(
                          "rounded-lg border bg-white p-4",
                          isCurrent && "border-primary ring-2 ring-primary/15",
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-slate-950">{plan.name}</h4>
                              {plan.highlight && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                  {plan.highlight}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                            <p className="mt-2 text-lg font-semibold text-slate-950">
                              {getPlanPriceLabel(plan, billingCycle)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={isCurrent ? "secondary" : "default"}
                            disabled={isCurrent || changingPlanId !== null}
                            onClick={() => void handlePlanChange(plan.id)}
                          >
                            {isCurrent ? "Plano atual" : changingPlanId === plan.id ? "Alterando..." : "Selecionar plano"}
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <span>Profissionais: {plan.maxProfessionals}</span>
                          <span>Serviços: {plan.maxServices}</span>
                        </div>
                        {(isOverProfessionals || isOverServices) && (
                          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                            Seu uso atual está acima deste plano. Os itens existentes continuam funcionando, mas novos
                            cadastros ficam bloqueados até o uso voltar ao limite.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionHeading title="Temas prontos" />
              <div className="relative mt-4">
                <div className={cn("space-y-3", !canCustomizeTheme && "pointer-events-none select-none blur-[2px]")}>
                  {themes.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!canCustomizeTheme}
                      onClick={() => {
                        if (canCustomizeTheme) {
                          setTheme(option.id);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border bg-white p-3 text-left",
                        visibleTheme === option.id && "border-primary ring-2 ring-primary/15",
                      )}
                    >
                      <span>
                        <span className="font-medium text-slate-950">{option.name}</span>
                        <span className="block text-sm text-muted-foreground">{option.description}</span>
                      </span>
                      <span className="flex gap-1">
                        {option.colors.map((color) => (
                          <span key={color} className="size-5 rounded-full border" style={{ backgroundColor: color }} />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
                {!canCustomizeTheme && (
                  <div className="absolute inset-0 grid place-items-center rounded-lg bg-white/65 p-5 text-center backdrop-blur-[1px]">
                    <div className="max-w-xs">
                      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                        <Lock className="size-5" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-slate-950">
                        Assine o plano Plus para desbloquear a personalização
                      </p>
                      <Button
                        className="mt-4"
                        type="button"
                        onClick={() => {
                          setIsPlanChooserOpen(true);
                          setPlanMessage(null);
                        }}
                      >
                        Alterar plano
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionHeading title="Prévia pública" icon={Eye} />
              <div className="rounded-lg border bg-white p-5">
                <div className="mb-4 flex gap-2">
                  {selected.colors.map((color) => (
                    <span key={color} className="h-2 flex-1 rounded-full" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={businessName} className="size-12 rounded-lg object-cover" />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                      {businessName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950">{businessName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{businessAddress || "Endereço não informado"}</p>
                  </div>
                </div>
                <Button className="mt-5 w-full">Agendar horário</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["automatic", "Confirmação automática"],
                  ["manual", "Aprovação manual"],
                ].map(([id, label]) => (
                  <Button
                    key={id}
                    type="button"
                    variant={mode === id ? "default" : "outline"}
                    onClick={() => setMode(id as "automatic" | "manual")}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/25">
            <CardContent className="space-y-4 p-5">
              <SectionHeading title="Conta" icon={Trash2} />
              {accountMessage && <AuthNotice type={accountMessage.type} message={accountMessage.text} />}
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <p className="font-medium text-slate-950">Apagar conta</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Remove seu usuário, o estabelecimento e os dados vinculados a ele. Esta ação não pode ser desfeita.
                </p>
                <Button
                  className="mt-4"
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteConfirmation("");
                    setAccountMessage(null);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  Apagar conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isDeletingAccount) {
            setDeleteConfirmation("");
          }
          setIsDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Apagar conta definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove sua conta e os dados do estabelecimento. Para confirmar, digite APAGAR no campo abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-account-confirmation">Confirmação</Label>
            <Input
              id="delete-account-confirmation"
              value={deleteConfirmation}
              disabled={isDeletingAccount}
              placeholder="Digite APAGAR"
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={deleteConfirmation.trim().toUpperCase() !== "APAGAR" || isDeletingAccount}
              onClick={handleDeleteAccount}
            >
              {isDeletingAccount ? "Apagando..." : "Apagar conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
