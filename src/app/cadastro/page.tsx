"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { AppVersion } from "@/components/app-version";
import { AuthNotice } from "@/components/auth-notice";
import { BrandMark } from "@/components/brand-mark";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { translateAuthError } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    name: z.string().min(3, "Informe o nome do responsavel."),
    email: z.string().email("Informe um e-mail válido."),
    password: z.string().min(6, "Use pelo menos 6 caracteres."),
    confirmPassword: z.string(),
    terms: z.boolean().refine((value) => value, "Aceite os termos e condições de uso."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function CadastroPage() {
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", terms: false },
  });
  const termsChecked = useWatch({ control: form.control, name: "terms" });

  async function handleSignup(values: FormData) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const email = values.email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
          data: {
            full_name: values.name,
          },
        },
      });

      if (error) {
        setMessage({ type: "error", text: translateAuthError(error.message) });
        return;
      }

      if (data.session) {
        window.location.assign("/onboarding");
        return;
      }

      setMessage({
        type: "success",
        text: "Cadastro criado. Digite o código de verificação enviado para o seu e-mail.",
      });
      setPendingEmail(email);
      setVerificationCode("");
    } catch {
      setMessage({
        type: "error",
        text: "Supabase não configurado. Preencha o .env.local para ativar cadastro real.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    if (!pendingEmail) {
      return;
    }

    const token = verificationCode.trim();

    if (token.length < 6) {
      setMessage({ type: "error", text: "Informe o código completo recebido por e-mail." });
      return;
    }

    setIsVerifying(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/verify-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingEmail,
          token,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;

      if (!response.ok) {
        setMessage({ type: "error", text: payload?.error ?? "Não foi possível verificar o código." });
        return;
      }

      window.location.assign(payload?.redirectTo ?? "/onboarding");
    } catch {
      setMessage({
        type: "error",
        text: "Não foi possível verificar o código agora. Confira o Supabase e tente novamente.",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendCode() {
    if (!pendingEmail) {
      return;
    }

    setIsResending(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
        },
      });

      if (error) {
        setMessage({ type: "error", text: translateAuthError(error.message) });
        return;
      }

      setMessage({ type: "success", text: "Enviamos um novo código para o seu e-mail." });
    } catch {
      setMessage({
        type: "error",
        text: "Não foi possível reenviar o código agora.",
      });
    } finally {
      setIsResending(false);
    }
  }

  async function handleGoogleSignup() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=/onboarding`,
        },
      });

      if (error) {
        setMessage({ type: "error", text: translateAuthError(error.message) });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Supabase não configurado. Preencha o .env.local para ativar cadastro com Google.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-xl shadow-xl shadow-primary/10">
        <CardHeader className="space-y-5">
          <BrandMark />
          <div>
            <CardTitle className="text-2xl">Criar conta</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Cadastre o responsavel e configure seu estabelecimento.</p>
          </div>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-4">
              <AuthNotice type={message.type} message={message.text} />
            </div>
          )}

          {pendingEmail ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-secondary p-4 text-sm text-muted-foreground">
                Enviamos a verificação para <strong className="text-foreground">{pendingEmail}</strong>. Digite o
                código recebido ou, se o e-mail mostrar apenas um link, clique nele para confirmar.
              </div>
              <div className="space-y-2">
                <Label htmlFor="verification-code">Código de verificação</Label>
                <Input
                  id="verification-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleVerifyCode();
                    }
                  }}
                />
              </div>
              <Button className="w-full" type="button" disabled={isVerifying} onClick={handleVerifyCode}>
                {isVerifying ? "Verificando..." : "Verificar código"}
              </Button>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={isResending}
                  onClick={handleResendCode}
                >
                  <RefreshCcw className="size-4" />
                  {isResending ? "Reenviando..." : "Reenviar código"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    setPendingEmail(null);
                    setVerificationCode("");
                    setMessage(null);
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Alterar dados
                </Button>
              </div>
            </div>
          ) : (
            <>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(handleSignup)}>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nome do responsavel</Label>
                  <Input id="name" {...form.register("name")} />
                  {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                <div className="flex items-start gap-3 sm:col-span-2">
                  <Checkbox
                    id="terms"
                    checked={termsChecked}
                    onCheckedChange={(checked) => form.setValue("terms", checked === true)}
                  />
                  <div className="text-sm leading-5">
                    <Label htmlFor="terms">Aceito os </Label>
                    <Link href="/termos" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
                      termos e condições de uso
                    </Link>
                    <span> do Mireva Agenda.</span>
                  </div>
                </div>
                {form.formState.errors.terms && (
                  <p className="text-sm text-destructive sm:col-span-2">{form.formState.errors.terms.message}</p>
                )}
                <Button className="sm:col-span-2" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>

              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full gap-2"
                disabled={isSubmitting}
                onClick={handleGoogleSignup}
              >
                <Mail className="size-4" />
                Cadastro com Google
              </Button>
            </>
          )}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Ja tem acesso?{" "}
            <Link href="/login" className="font-medium text-primary">
              Entrar
            </Link>
          </p>
          <AppVersion className="mt-5" />
        </CardContent>
      </Card>
    </main>
  );
}
