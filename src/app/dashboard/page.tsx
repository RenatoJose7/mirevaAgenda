import { Bell, CalendarPlus, CalendarX, Clock, Scissors, UserCheck, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { MetricCard } from "@/components/metric-card";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth/server";
import {
  getAppointmentsForBusiness,
  getNotificationsForBusiness,
  getProfessionalsForBusiness,
  getServicesForBusiness,
} from "@/lib/business/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const business = await requireBusiness();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const [appointments, services, professionals, notifications] = await Promise.all([
    getAppointmentsForBusiness(business.id, { from: `${month}-01`, limit: 300 }),
    getServicesForBusiness(business.id),
    getProfessionalsForBusiness(business.id),
    getNotificationsForBusiness(business.id),
  ]);
  const todayAppointments = appointments.filter((item) => item.appointment_date === today && item.status !== "cancelled");
  const monthAppointments = appointments.filter((item) => item.appointment_date.startsWith(month));
  const cancelled = monthAppointments.filter((item) => item.status === "cancelled");
  const noShow = monthAppointments.filter((item) => item.status === "no_show");
  const upcoming = appointments
    .filter((item) => item.status !== "cancelled" && item.appointment_date >= today)
    .slice(0, 5);
  const serviceCounts = services
    .map((service) => ({
      service,
      total: appointments.filter((item) => item.service_id === service.id).length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <AdminShell
      title="Dashboard"
      description="Resumo real do estabelecimento."
      businessName={business.name}
      themeKey={business.theme_key}
      unreadCount={notifications.filter((item) => !item.is_read).length}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Atendimentos hoje" value={String(todayAppointments.length)} helper="Dados reais" icon={UserCheck} />
          <MetricCard label="Total do mes" value={String(monthAppointments.length)} helper="Agendamentos do mes" icon={CalendarPlus} />
          <MetricCard label="Cancelamentos" value={String(cancelled.length)} helper="No mes atual" icon={CalendarX} />
          <MetricCard label="Nao comparecimentos" value={String(noShow.length)} helper="No mes atual" icon={Users} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Proximos agendamentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground">Nenhum agendamento futuro.</p>
              ) : (
                upcoming.map((appointment) => {
                  const service = services.find((item) => item.id === appointment.service_id);
                  const professional = professionals.find((item) => item.id === appointment.professional_id);
                  return (
                    <div key={appointment.id} className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{service?.name ?? "Servico"}</p>
                        <p className="text-sm text-muted-foreground">
                          {appointment.customer_name} com {professional?.name ?? "Profissional"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {appointment.appointment_date}, {appointment.start_time.slice(0, 5)}
                        </Badge>
                        <StatusBadge status={appointment.status} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificacoes recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.slice(0, 4).map((notification) => (
                <div key={notification.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Bell className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium text-slate-950">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground">Nenhuma notificacao real ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <SectionHeading title="Servicos mais agendados" icon={Scissors} />
              <div className="mt-5 space-y-4">
                {serviceCounts.map(({ service, total }) => (
                  <div key={service.id}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>{service.name}</span>
                      <span className="text-muted-foreground">{total} reservas</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(total * 20, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionHeading title="Resumo operacional" icon={Clock} />
              <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                <p>{professionals.length} profissionais cadastrados.</p>
                <p>{services.length} servicos cadastrados.</p>
                <p>{appointments.length} agendamentos no historico atual.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
