import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthNotice({
  type = "error",
  message,
}: {
  type?: "error" | "success";
  message: string;
}) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
