import { NotificationsView } from "@/components/notifications-view";
import { requireBusiness } from "@/lib/auth/server";
import { getNotificationsForBusiness } from "@/lib/business/server";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const business = await requireBusiness();
  const notifications = await getNotificationsForBusiness(business.id);

  return (
    <NotificationsView
      businessId={business.id}
      businessName={business.name}
      themeKey={business.theme_key}
      initialNotifications={notifications}
    />
  );
}
