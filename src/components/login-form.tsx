"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AppVersion } from "@/components/app-version";
import { AuthNotice } from "@/components/auth-notice";
import { BrandMark } from "@/components/brand-mark";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { translateAuthError } from "@/lib/auth/messages";
import { sanitizeAuthRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "Use pelo menos 6 caracteres."),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const envError = searchParams.get("erro") === "supabase-env";
  const oauthError = searchParams.get("erro") === "oauth";
  const sessionExpired = searchParams.get("erro") === "session-expired";
  const nextPath = sanitizeAuthRedirectPath(searchParams.get("next"));

  async function handleLogin(values: FormData) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Nao foi possivel entrar. Verifique os dados e tente novamente.");
        return;
      }

      window.location.assign(payload?.redirectTo ?? "/dashboard");
    } catch {
      setMessage("Supabase nao configurado. Preencha o .env.local para ativar login real.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) {
        setMessage(translateAuthError(error.message));
      }
    } catch {
      setMessage("Supabase nao configurado. Preencha o .env.local para ativar login com Google.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl shadow-primary/10">
      <CardHeader className="space-y-5">
        <BrandMark />
        <div>
          <CardTitle className="text-2xl">Entrar no Mireva Agenda</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">Acesse o painel do seu estabelecimento.</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-3">
          {envError && (
            <AuthNotice message="Supabase ainda nao foi configurado. Preencha as variaveis em .env.local." />
          )}
          {oauthError && <AuthNotice message="Nao foi possivel concluir o login com Google. Verifique o provider." />}
          {sessionExpired && <AuthNotice message="Sua sessao expirou. Entre novamente para continuar." />}
          {message && <AuthNotice message={message} />}
        </div>

        <form className="space-y-4" onSubmit={form.handleSubmit(handleLogin)}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button className="w-full gap-2" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={isSubmitting}
          onClick={handleGoogleLogin}
        >
          <Mail className="size-4" />
          Continuar com Google
        </Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Ainda nao tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-primary">
            Criar cadastro
          </Link>
        </p>
        <AppVersion className="mt-5" />
      </CardContent>
    </Card>
  );
}
