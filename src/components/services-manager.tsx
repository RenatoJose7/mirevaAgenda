"use client";

import { useMemo, useState } from "react";
import { Edit, Plus, Save, Trash2, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthNotice } from "@/components/auth-notice";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  centsToCurrency,
  currencyToCents,
  formatCents,
  type ProfessionalRecord,
  type ProfessionalServiceRecord,
  type ServiceRecord,
} from "@/lib/business/types";
import { createClient } from "@/lib/supabase/client";

const serviceSchema = z.object({
  name: z.string().min(2, "Informe o nome do serviço."),
  short_description: z.string().optional(),
  base_price: z.string().optional(),
  base_duration_minutes: z.number().int().min(1, "Informe uma duração válida."),
  is_active: z.boolean(),
});

type ServiceForm = z.infer<typeof serviceSchema>;
type AssociationDraft = Record<string, { enabled: boolean; price: string; duration: string }>;

const emptyForm: ServiceForm = {
  name: "",
  short_description: "",
  base_price: "",
  base_duration_minutes: 60,
  is_active: true,
};

function linkKey(serviceId: string, professionalId: string) {
  return `${serviceId}:${professionalId}`;
}

export function ServicesManager({
  businessId,
  businessName,
  themeKey,
  initialServices,
  initialProfessionals,
  initialLinks,
  planName,
  maxServices,
}: {
  businessId: string;
  businessName: string;
  themeKey?: string | null;
  initialServices: ServiceRecord[];
  initialProfessionals: ProfessionalRecord[];
  initialLinks: ProfessionalServiceRecord[];
  planName: string;
  maxServices: number;
}) {
  const [services, setServices] = useState(initialServices);
  const [professionals] = useState(initialProfessionals);
  const [links, setLinks] = useState(initialLinks);
  const [editing, setEditing] = useState<ServiceRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(initialServices.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [associationDraft, setAssociationDraft] = useState<AssociationDraft>({});
  const [serviceToRemove, setServiceToRemove] = useState<ServiceRecord | null>(null);

  const activeProfessionals = useMemo(
    () => professionals.filter((professional) => professional.is_active),
    [professionals],
  );
  const totalCount = services.length;
  const limitReached = totalCount >= maxServices;

  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: emptyForm,
  });

  async function reloadData() {
    const supabase = createClient();
    const [{ data: servicesData, error: servicesError }, { data: linksData, error: linksError }] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("professional_services")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true),
    ]);

    if (!servicesError) {
      setServices((servicesData ?? []) as ServiceRecord[]);
    }

    if (!linksError) {
      setLinks((linksData ?? []) as ProfessionalServiceRecord[]);
    }
  }

  function buildAssociationDraft(service: ServiceRecord | null) {
    const draft: AssociationDraft = {};

    for (const professional of activeProfessionals) {
      const link = service
        ? links.find((item) => item.service_id === service.id && item.professional_id === professional.id && item.is_active)
        : null;

      draft[professional.id] = {
        enabled: Boolean(link),
        price: centsToCurrency(link?.custom_price_cents),
        duration: link?.custom_duration_minutes ? String(link.custom_duration_minutes) : "",
      };
    }

    return draft;
  }

  function startCreate() {
    if (limitReached) {
      setEditing(null);
      setIsFormOpen(false);
      setMessage({
        type: "error",
        text: `Seu plano ${planName} permite até ${maxServices} serviço${maxServices === 1 ? "" : "s"}. Para adicionar mais, altere o plano em Configurações.`,
      });
      return;
    }

    setEditing(null);
    form.reset(emptyForm);
    setAssociationDraft(buildAssociationDraft(null));
    setIsFormOpen(true);
    setMessage(null);
  }

  function startEdit(service: ServiceRecord) {
    setEditing(service);
    form.reset({
      name: service.name,
      short_description: service.short_description ?? "",
      base_price: centsToCurrency(service.base_price_cents),
      base_duration_minutes: service.base_duration_minutes,
      is_active: service.is_active,
    });
    setAssociationDraft(buildAssociationDraft(service));
    setIsFormOpen(true);
    setMessage(null);
  }

  function updateAssociation(professionalId: string, values: Partial<AssociationDraft[string]>) {
    setAssociationDraft((current) => ({
      ...current,
      [professionalId]: {
        enabled: current[professionalId]?.enabled ?? false,
        price: current[professionalId]?.price ?? "",
        duration: current[professionalId]?.duration ?? "",
        ...values,
      },
    }));
  }

  async function syncAssociations(serviceId: string) {
    const supabase = createClient();
    const selectedRows = Object.entries(associationDraft)
      .filter(([, value]) => value.enabled)
      .map(([professionalId, value]) => ({
        business_id: businessId,
        professional_id: professionalId,
        service_id: serviceId,
        custom_price_cents: currencyToCents(value.price),
        custom_duration_minutes:
          value.duration && Number.isFinite(Number(value.duration)) ? Number(value.duration) : null,
        is_active: true,
      }));

    if (selectedRows.length > 0) {
      const { error } = await supabase
        .from("professional_services")
        .upsert(selectedRows, { onConflict: "professional_id,service_id" });

      if (error) {
        throw error;
      }
    }

    const selectedIds = selectedRows.map((row) => row.professional_id);
    const inactiveIds = links
      .filter((link) => link.service_id === serviceId && !selectedIds.includes(link.professional_id))
      .map((link) => link.professional_id);

    if (inactiveIds.length > 0) {
      const { error } = await supabase
        .from("professional_services")
        .update({ is_active: false })
        .eq("business_id", businessId)
        .eq("service_id", serviceId)
        .in("professional_id", inactiveIds);

      if (error) {
        throw error;
      }
    }
  }

  async function saveService(values: ServiceForm) {
    setIsSubmitting(true);
    setMessage(null);

    const price = currencyToCents(values.base_price ?? "");
    const payload = {
      name: values.name.trim(),
      short_description: values.short_description?.trim() || null,
      base_price_cents: price,
      base_duration_minutes: values.base_duration_minutes,
      is_active: values.is_active,
    };

    try {
      const supabase = createClient();
      const result = editing
        ? await supabase
            .from("services")
            .update(payload)
            .eq("id", editing.id)
            .eq("business_id", businessId)
            .select("id")
            .single()
        : await supabase
            .from("services")
            .insert({ ...payload, business_id: businessId })
            .select("id")
            .single();

      if (result.error || !result.data) {
        setMessage({ type: "error", text: getServiceSaveError(result.error?.message, planName, maxServices) });
        setIsSubmitting(false);
        return;
      }

      await syncAssociations(result.data.id);
      await reloadData();
      setMessage({ type: "success", text: editing ? "Serviço atualizado." : "Serviço cadastrado." });
      setEditing(null);
      setIsFormOpen(false);
      form.reset(emptyForm);
    } catch {
      setMessage({ type: "error", text: "Não foi possível salvar os vínculos do serviço." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleService(service: ServiceRecord) {
    const supabase = createClient();
    const { error } = await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id)
      .eq("business_id", businessId);

    if (error) {
      setMessage({ type: "error", text: "Não foi possível alterar o status." });
      return;
    }

    await reloadData();
    setMessage({ type: "success", text: "Status atualizado." });
  }

  async function removeService(service: ServiceRecord) {
    const supabase = createClient();
    const [{ error: serviceError }, { error: linksError }] = await Promise.all([
      supabase
        .from("services")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", service.id)
        .eq("business_id", businessId),
      supabase
        .from("professional_services")
        .update({ is_active: false })
        .eq("business_id", businessId)
        .eq("service_id", service.id),
    ]);

    if (serviceError || linksError) {
      setMessage({ type: "error", text: "Não foi possível remover o serviço." });
      return;
    }

    await reloadData();
    setMessage({ type: "success", text: "Serviço removido." });
    setServiceToRemove(null);
  }

  return (
    <AdminShell
      title="Serviços"
      description="Catálogo real de serviços e vínculos por profissional."
      businessName={businessName}
      themeKey={themeKey}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{businessName}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Serviços cadastrados</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Serviços: {totalCount}/{maxServices}. Configure preço, duração e quais profissionais podem realizar cada serviço.
            </p>
            {totalCount > maxServices && (
              <p className="mt-1 text-sm text-amber-700">
                Uso acima do plano atual. Os serviços existentes continuam funcionando, mas novos cadastros ficam bloqueados.
              </p>
            )}
          </div>
          <Button onClick={startCreate}>
            <Plus className="size-4" />
            Cadastrar serviço
          </Button>
        </div>

        {message && <AuthNotice type={message.type} message={message.text} />}

        {isFormOpen && (
          <Card>
            <CardContent className="p-5">
              <form className="space-y-5" onSubmit={form.handleSubmit(saveService)}>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {editing ? "Editar serviço" : "Novo serviço"}
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditing(null);
                    }}
                    aria-label="Fechar formulário"
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="service-name">Nome do serviço</Label>
                    <Input id="service-name" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="service-price">Preço base</Label>
                    <Input id="service-price" inputMode="decimal" placeholder="Ex: 120,00" {...form.register("base_price")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="service-duration">Duração base em minutos</Label>
                    <Input
                      id="service-duration"
                      type="number"
                      min={1}
                      {...form.register("base_duration_minutes", { valueAsNumber: true })}
                    />
                    {form.formState.errors.base_duration_minutes && (
                      <p className="text-sm text-destructive">{form.formState.errors.base_duration_minutes.message}</p>
                    )}
                  </div>
                  <label className="flex items-center gap-3 self-end rounded-lg border p-3 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" {...form.register("is_active")} />
                    Serviço ativo
                  </label>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="service-description">Descrição curta</Label>
                    <Textarea id="service-description" {...form.register("short_description")} rows={3} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">Vínculos com profissionais</h3>
                    <p className="text-sm text-muted-foreground">
                      Preço e duração personalizados são opcionais e substituem os valores base para aquele profissional.
                    </p>
                  </div>

                  {activeProfessionals.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-secondary p-4 text-sm text-muted-foreground">
                      Cadastre profissionais ativos para criar vínculos.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {activeProfessionals.map((professional) => {
                        const draft = associationDraft[professional.id] ?? { enabled: false, price: "", duration: "" };
                        return (
                          <div key={professional.id} className="rounded-lg border p-3">
                            <label className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 size-4 accent-primary"
                                checked={draft.enabled}
                                onChange={(event) => updateAssociation(professional.id, { enabled: event.target.checked })}
                              />
                              <span>
                                <span className="font-medium text-slate-950">{professional.name}</span>
                                <span className="block text-sm text-muted-foreground">
                                  {professional.role_title || "Sem cargo informado"}
                                </span>
                              </span>
                            </label>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <Input
                                value={draft.price}
                                inputMode="decimal"
                                placeholder="Preço opcional"
                                disabled={!draft.enabled}
                                onChange={(event) => updateAssociation(professional.id, { price: event.target.value })}
                              />
                              <Input
                                value={draft.duration}
                                type="number"
                                min={1}
                                placeholder="Duração opcional"
                                disabled={!draft.enabled}
                                onChange={(event) => updateAssociation(professional.id, { duration: event.target.value })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting}>
                  <Save className="size-4" />
                  {isSubmitting ? "Salvando..." : "Salvar serviço"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {services.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
              <Plus className="size-10 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Nenhum serviço cadastrado</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie o catálogo base do estabelecimento.
                </p>
              </div>
              <Button onClick={startCreate}>
                <Plus className="size-4" />
                Cadastrar serviço
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {services.map((service) => {
              const serviceLinks = links.filter((link) => link.service_id === service.id && link.is_active);
              return (
                <Card key={service.id}>
                  <CardContent className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">{service.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {service.short_description || "Descrição ainda não informada."}
                        </p>
                      </div>
                      <Badge variant={service.is_active ? "default" : "secondary"}>
                        {service.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-secondary p-3">
                        <span className="text-xs text-muted-foreground">Preço base</span>
                        <strong className="block text-lg text-slate-950">{formatCents(service.base_price_cents)}</strong>
                      </div>
                      <div className="rounded-lg bg-secondary p-3">
                        <span className="text-xs text-muted-foreground">Duração base</span>
                        <strong className="block text-lg text-slate-950">{service.base_duration_minutes} min</strong>
                      </div>
                    </div>
                    <div>
                      <p className="mb-3 text-sm font-medium text-slate-950">Profissionais vinculados</p>
                      {serviceLinks.length === 0 ? (
                        <div className="rounded-lg border border-dashed bg-secondary p-3 text-sm text-muted-foreground">
                          Nenhum profissional vinculado.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {serviceLinks.map((link) => {
                            const professional = professionals.find((item) => item.id === link.professional_id);
                            return (
                              <div key={linkKey(service.id, link.professional_id)} className="rounded-lg border p-3 text-sm">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <span>{professional?.name ?? "Profissional removido"}</span>
                                  <span className="font-medium text-primary">
                                    {formatCents(link.custom_price_cents ?? service.base_price_cents)} /{" "}
                                    {link.custom_duration_minutes ?? service.base_duration_minutes} min
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => startEdit(service)}>
                        <Edit className="size-4" />
                        Editar
                      </Button>
                      <Button variant="outline" onClick={() => toggleService(service)}>
                        {service.is_active ? "Inativar" : "Ativar"}
                      </Button>
                      <Button variant="ghost" onClick={() => setServiceToRemove(service)}>
                        <Trash2 className="size-4" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <AlertDialog open={Boolean(serviceToRemove)} onOpenChange={(open) => !open && setServiceToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <Trash2 className="size-5" />
              </AlertDialogMedia>
              <AlertDialogTitle>Remover serviço</AlertDialogTitle>
              <AlertDialogDescription>
                {serviceToRemove
                  ? `Remover "${serviceToRemove.name}" do catálogo? O serviço será inativado e os vínculos com profissionais também serão desativados.`
                  : "Remover este serviço do catálogo?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (serviceToRemove) {
                    void removeService(serviceToRemove);
                  }
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminShell>
  );
}

function getServiceSaveError(message: string | undefined, planName: string, maxServices: number) {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("limite do plano")) {
    return `Seu plano ${planName} permite até ${maxServices} serviço${maxServices === 1 ? "" : "s"}. Para adicionar mais, altere o plano em Configurações.`;
  }

  return "Não foi possível salvar o serviço.";
}
