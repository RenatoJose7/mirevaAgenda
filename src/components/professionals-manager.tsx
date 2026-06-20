"use client";

import { useMemo, useState } from "react";
import { Edit, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthNotice } from "@/components/auth-notice";
import { AdminShell } from "@/components/admin-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { ProfessionalRecord } from "@/lib/business/types";
import { createClient } from "@/lib/supabase/client";

const professionalSchema = z.object({
  name: z.string().min(2, "Informe o nome do profissional."),
  role_title: z.string().optional(),
  bio: z.string().optional(),
  is_active: z.boolean(),
});

type ProfessionalForm = z.infer<typeof professionalSchema>;

const emptyForm: ProfessionalForm = {
  name: "",
  role_title: "",
  bio: "",
  is_active: true,
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProfessionalsManager({
  businessId,
  businessName,
  themeKey,
  initialProfessionals,
}: {
  businessId: string;
  businessName: string;
  themeKey?: string | null;
  initialProfessionals: ProfessionalRecord[];
}) {
  const [professionals, setProfessionals] = useState(initialProfessionals);
  const [editing, setEditing] = useState<ProfessionalRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(initialProfessionals.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [professionalToRemove, setProfessionalToRemove] = useState<ProfessionalRecord | null>(null);

  const activeCount = useMemo(() => professionals.filter((item) => item.is_active).length, [professionals]);
  const form = useForm<ProfessionalForm>({
    resolver: zodResolver(professionalSchema),
    defaultValues: emptyForm,
  });

  async function reloadProfessionals() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error) {
      setProfessionals((data ?? []) as ProfessionalRecord[]);
    }
  }

  function startCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setIsFormOpen(true);
    setMessage(null);
  }

  function startEdit(professional: ProfessionalRecord) {
    setEditing(professional);
    form.reset({
      name: professional.name,
      role_title: professional.role_title ?? "",
      bio: professional.bio ?? "",
      is_active: professional.is_active,
    });
    setIsFormOpen(true);
    setMessage(null);
  }

  async function saveProfessional(values: ProfessionalForm) {
    setIsSubmitting(true);
    setMessage(null);

    const payload = {
      name: values.name.trim(),
      role_title: values.role_title?.trim() || null,
      bio: values.bio?.trim() || null,
      is_active: values.is_active,
    };

    const supabase = createClient();
    const result = editing
      ? await supabase.from("professionals").update(payload).eq("id", editing.id).eq("business_id", businessId)
      : await supabase.from("professionals").insert({ ...payload, business_id: businessId });

    if (result.error) {
      setMessage({ type: "error", text: "Não foi possível salvar o profissional." });
      setIsSubmitting(false);
      return;
    }

    await reloadProfessionals();
    setMessage({
      type: "success",
      text: editing ? "Profissional atualizado com sucesso." : "Profissional cadastrado com sucesso.",
    });
    setEditing(null);
    setIsFormOpen(false);
    form.reset(emptyForm);
    setIsSubmitting(false);
  }

  async function toggleProfessional(professional: ProfessionalRecord) {
    const supabase = createClient();
    const { error } = await supabase
      .from("professionals")
      .update({ is_active: !professional.is_active })
      .eq("id", professional.id)
      .eq("business_id", businessId);

    if (error) {
      setMessage({ type: "error", text: "Não foi possível alterar o status." });
      return;
    }

    await reloadProfessionals();
    setMessage({ type: "success", text: "Status atualizado." });
  }

  async function removeProfessional(professional: ProfessionalRecord) {
    const supabase = createClient();
    const { error } = await supabase
      .from("professionals")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", professional.id)
      .eq("business_id", businessId);

    if (error) {
      setMessage({ type: "error", text: "Não foi possível remover o profissional." });
      return;
    }

    await reloadProfessionals();
    setMessage({ type: "success", text: "Profissional removido." });
    setProfessionalToRemove(null);
  }

  return (
    <AdminShell
      title="Profissionais"
      description="Cadastre a equipe que poderá ser vinculada aos serviços."
      businessName={businessName}
      themeKey={themeKey}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{businessName}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Profissionais cadastrados</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount} ativo{activeCount === 1 ? "" : "s"} nesta conta.
            </p>
          </div>
          <Button onClick={startCreate}>
            <Plus className="size-4" />
            Adicionar profissional
          </Button>
        </div>

        {message && <AuthNotice type={message.type} message={message.text} />}

        {isFormOpen && (
          <Card>
            <CardContent className="p-5">
              <form className="space-y-4" onSubmit={form.handleSubmit(saveProfessional)}>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {editing ? "Editar profissional" : "Novo profissional"}
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditing(null);
                    }}
                    aria-label="Fechar formulario"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="professional-name">Nome</Label>
                    <Input id="professional-name" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="professional-role">Cargo ou especialidade</Label>
                    <Input id="professional-role" {...form.register("role_title")} placeholder="Ex: consultor, instrutor, terapeuta" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="professional-bio">Bio curta</Label>
                    <Textarea id="professional-bio" {...form.register("bio")} rows={3} />
                  </div>
                  <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" {...form.register("is_active")} />
                    Profissional ativo
                  </label>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="size-4" />
                  {isSubmitting ? "Salvando..." : "Salvar profissional"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {professionals.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
              <UserRound className="size-10 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Nenhum profissional cadastrado</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie a equipe base antes de vincular serviços.
                </p>
              </div>
              <Button onClick={startCreate}>
                <Plus className="size-4" />
                Adicionar profissional
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {professionals.map((professional) => (
              <Card key={professional.id}>
                <CardContent className="space-y-5 p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="size-14 border bg-secondary">
                      <AvatarFallback className="bg-secondary text-primary">
                        {initials(professional.name) || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-950">{professional.name}</h2>
                      <p className="text-sm text-muted-foreground">{professional.role_title || "Função não informada"}</p>
                      <Badge className="mt-2" variant={professional.is_active ? "default" : "secondary"}>
                        {professional.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <p className="min-h-12 text-sm text-muted-foreground">
                    {professional.bio || "Bio ainda não informada."}
                  </p>
                  <div className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                    Disponibilidade e agenda real ainda não fazem parte desta etapa.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => startEdit(professional)}>
                      <Edit className="size-4" />
                      Editar
                    </Button>
                    <Button variant="outline" onClick={() => toggleProfessional(professional)}>
                      {professional.is_active ? "Inativar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" onClick={() => setProfessionalToRemove(professional)}>
                      <Trash2 className="size-4" />
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <AlertDialog open={Boolean(professionalToRemove)} onOpenChange={(open) => !open && setProfessionalToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <Trash2 className="size-5" />
              </AlertDialogMedia>
              <AlertDialogTitle>Remover profissional</AlertDialogTitle>
              <AlertDialogDescription>
                {professionalToRemove
                  ? `Remover "${professionalToRemove.name}" da lista? O profissional será inativado e não aparecerá mais nas telas principais.`
                  : "Remover este profissional da lista?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (professionalToRemove) {
                    void removeProfessional(professionalToRemove);
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
