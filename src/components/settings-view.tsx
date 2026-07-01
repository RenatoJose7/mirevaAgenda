"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  Lock,
  Palette,
  Trash2,
} from "lucide-react";
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
import { slugify } from "@/lib/business/types";
import type { PlanId } from "@/lib/plans";
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

export function SettingsView({ business, currentPlanId }: { business: AppBusiness; currentPlanId: PlanId }) {
  const [theme, setTheme] = useState(business.theme_key || "mireva");
  const [mode, setMode] = useState(business.booking_confirmation_mode);
  const [businessName, setBusinessName] = useState(business.name);
  const [businessAddress, setBusinessAddress] = useState(business.address ?? "");
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? null);
  const [publicSlug, setPublicSlug] = useState(business.slug);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [accountMessage, setAccountMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const canCustomizeTheme = currentPlanId !== "basic";
  const visibleTheme = canCustomizeTheme ? theme : "mireva";
  const selected = themes.find((item) => item.id === visibleTheme) ?? themes[0];
  const publicBookingPath = `/agendar/${publicSlug}`;
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <Card className="border-primary/10 bg-white shadow-sm">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <SectionHeading
                title="Dados do estabelecimento"
                description="Nome, contato, endereco e link publico usados no agendamento."
                icon={Building2}
              />
            </div>
            {message && <AuthNotice type={message.type} message={message.text} />}
            <form id="settings-form" className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(handleSave)}>
              <div className="space-y-2 sm:col-span-2">
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
                <div className="flex overflow-hidden rounded-md border bg-white focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="flex items-center border-r bg-secondary px-3 text-sm text-muted-foreground">
                    /agendar/
                  </span>
                  <Input
                    id="business-slug"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...form.register("slug")}
                  />
                </div>
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
            <div className="rounded-lg border border-primary/15 bg-secondary/40 p-4 text-sm">
              <p className="font-medium text-slate-950">Link público de agendamento</p>
              <p className="mt-1 break-all text-muted-foreground">{publicBookingPath}</p>
              <Button
                className="mt-3 gap-2"
                type="button"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}${publicBookingPath}`)}
              >
                Copiar link público
              </Button>
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-5">
              <Button type="submit" form="settings-form" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/10 bg-white shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="border-b border-slate-100 pb-5">
                <SectionHeading
                  title="Temas prontos"
                  description="Aparencia aplicada a pagina publica de agendamento."
                  icon={Palette}
                />
              </div>
              <div className="relative">
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
                        "flex w-full items-center justify-between gap-4 rounded-lg border border-primary/10 bg-secondary/30 p-3 text-left transition hover:border-primary/30 hover:bg-secondary/50",
                        visibleTheme === option.id && "border-primary bg-white ring-2 ring-primary/15",
                      )}
                    >
                      <span>
                        <span className="font-medium text-slate-950">{option.name}</span>
                        <span className="block text-sm text-muted-foreground">{option.description}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {visibleTheme === option.id && <CheckCircle2 className="size-4 text-primary" />}
                        <span className="flex gap-1">
                          {option.colors.map((color) => (
                            <span
                              key={color}
                              className="size-5 rounded-full border"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
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
                      <Button className="mt-4" asChild>
                        <Link href="/assinatura">Alterar plano</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <SectionHeading title="Prévia pública" icon={Eye} />
              <div className="rounded-lg border border-primary/15 bg-white p-5 shadow-sm">
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
                    className="gap-2"
                    variant={mode === id ? "default" : "outline"}
                    onClick={() => setMode(id as "automatic" | "manual")}
                  >
                    {id === "automatic" ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-white shadow-sm">
            <CardContent className="space-y-4 p-5 sm:p-6">
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
