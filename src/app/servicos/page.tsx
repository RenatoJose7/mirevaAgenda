import { ServicesManager } from "@/components/services-manager";
import { requireBusiness } from "@/lib/auth/server";
import {
  getProfessionalsForBusiness,
  getProfessionalServicesForBusiness,
  getServicesForBusiness,
} from "@/lib/business/server";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const business = await requireBusiness();
  const [services, professionals, links] = await Promise.all([
    getServicesForBusiness(business.id),
    getProfessionalsForBusiness(business.id),
    getProfessionalServicesForBusiness(business.id),
  ]);

  return (
    <ServicesManager
      businessId={business.id}
      businessName={business.name}
      themeKey={business.theme_key}
      initialServices={services}
      initialProfessionals={professionals}
      initialLinks={links}
    />
  );
}
