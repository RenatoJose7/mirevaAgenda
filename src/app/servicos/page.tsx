import { ServicesManager } from "@/components/services-manager";
import { requireBusiness } from "@/lib/auth/server";
import {
  getPlanUsageForBusiness,
  getProfessionalsForBusiness,
  getProfessionalServicesForBusiness,
  getServicesForBusiness,
} from "@/lib/business/server";
import { getSubscriptionPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const business = await requireBusiness();
  const [services, professionals, links, usage] = await Promise.all([
    getServicesForBusiness(business.id),
    getProfessionalsForBusiness(business.id),
    getProfessionalServicesForBusiness(business.id),
    getPlanUsageForBusiness(business.id),
  ]);
  const plan = getSubscriptionPlan(usage.subscription?.plan_id);

  return (
    <ServicesManager
      businessId={business.id}
      businessName={business.name}
      themeKey={business.theme_key}
      initialServices={services}
      initialProfessionals={professionals}
      initialLinks={links}
      planName={plan.name}
      maxServices={usage.subscription?.max_services ?? plan.maxServices}
    />
  );
}
