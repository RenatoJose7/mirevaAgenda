import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus as RealAppointmentStatus } from "@/lib/business/types";
import type { AppointmentStatus as MockAppointmentStatus } from "@/lib/types";

type AnyStatus = RealAppointmentStatus | MockAppointmentStatus;

const statusMap: Record<AnyStatus, { label: string; className: string }> = {
  pending: {
    label: "Aguardando confirmação",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  confirmed: {
    label: "Confirmado",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  cancelled: {
    label: "Cancelado",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  no_show: {
    label: "Cliente não apareceu",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  completed: {
    label: "Concluído",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  aguardando_confirmacao: {
    label: "Aguardando confirmação",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  confirmado: {
    label: "Confirmado",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  cancelado: {
    label: "Cancelado",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  cliente_nao_apareceu: {
    label: "Cliente não apareceu",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const item = statusMap[status];
  return (
    <Badge variant="outline" className={item.className}>
      {item.label}
    </Badge>
  );
}
