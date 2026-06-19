import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando login...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
