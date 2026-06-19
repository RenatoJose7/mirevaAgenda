import { AgendaView } from "@/components/agenda-view";
import { requireBusiness } from "@/lib/auth/server";
import {
  getBookingSettingsForBusiness,
  getBreaksForBusiness,
  getAppointmentsForBusiness,
  getFutureScheduleBlocksForBusiness,
  getProfessionalsForBusiness,
  getProfessionalServicesForBusiness,
  getServicesForBusiness,
  getUnreadNotificationCountForBusiness,
  getWorkingHoursForBusiness,
} from "@/lib/business/server";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const business = await requireBusiness();
  const today = new Date().toISOString().slice(0, 10);
  const [professionals, services, links, workingHours, breaks, settings, blocks, appointments, unreadCount] = await Promise.all([
    getProfessionalsForBusiness(business.id),
    getServicesForBusiness(business.id),
    getProfessionalServicesForBusiness(business.id),
    getWorkingHoursForBusiness(business.id),
    getBreaksForBusiness(business.id),
    getBookingSettingsForBusiness(business.id),
    getFutureScheduleBlocksForBusiness(business.id),
    getAppointmentsForBusiness(business.id, { from: today, limit: 200 }),
    getUnreadNotificationCountForBusiness(business.id),
  ]);

  return (
    <AgendaView
      businessId={business.id}
      businessName={business.name}
      themeKey={business.theme_key}
      initialProfessionals={professionals}
      initialServices={services}
      initialLinks={links}
      initialWorkingHours={workingHours}
      initialBreaks={breaks}
      initialSettings={settings}
      initialBlocks={blocks}
      initialAppointments={appointments}
      unreadCount={unreadCount}
    />
  );
}
