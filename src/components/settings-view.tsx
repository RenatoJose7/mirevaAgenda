"use client";

import { useState } from "react";
import { Eye, Settings } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthNotice } from "@/components/auth-notice";
import { AdminShell } from "@/components/admin-shell";
import { BusinessLogoField } from "@/components/business-logo-field";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppBusiness } from "@/lib/auth/server";
import { slugify } from "@/lib/business/types";
import { createClient } from "@/lib/supabase/client";
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

export function SettingsView({ business }: { business: AppBusiness }) {
  const [theme, setTheme] = useState(business.theme_key || "mireva");
  const [mode, setMode] = useState(business.booking_confirmation_mode);
  const [businessName, setBusinessName] = useState(business.name);
  const [businessAddress, setBusinessAddress] = useState(business.address ?? "");
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? null);
  const [publicSlug, setPublicSlug] = useState(business.slug);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const selected = themes.find((item) => item.id === theme) ?? themes[0];
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
      const supabase = createClient();
      const { data, error } = await supabase
        .from("businesses")
        .update({
          name: values.name.trim(),
          slug: values.slug.trim(),
          segment: values.segment?.trim() || null,
          whatsapp: values.whatsapp?.trim() || null,
          address: values.address?.trim() || null,
          theme_key: theme,
          booking_confirmation_mode: mode,
        })
        .eq("id", business.id)
        .select("name,address,logo_url")
        .single();

      if (error) {
        setMessage({
          type: "error",
          text: error.code === "23505"
            ? "Este nome do link já está em uso. Escolha outro."
            : "Não foi possível salvar as configurações.",
        });
        return;
      }

      setBusinessName(data.name);
      setBusinessAddress(data.address ?? "");
      setLogoUrl(data.logo_url ?? null);
      setPublicSlug(values.slug.trim());
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

  return (
    <AdminShell
      title="Configurações"
      description="Dados reais do estabelecimento e preferências visuais."
      businessName={businessName}
      businessLogoUrl={logoUrl}
      themeKey={theme}
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
            <CardContent className="p-5">
              <SectionHeading title="Temas prontos" />
              <div className="mt-4 space-y-3">
                {themes.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border bg-white p-3 text-left",
                      theme === option.id && "border-primary ring-2 ring-primary/15",
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
        </div>
      </div>
    </AdminShell>
  );
}
