import { cn } from "@/lib/utils";

export function AppVersion({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-xs font-medium text-muted-foreground", className)}>
      Mireva Agenda - Versão 1.0
    </p>
  );
}
