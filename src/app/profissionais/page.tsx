import { ProfessionalsManager } from "@/components/professionals-manager";
import { requireBusiness } from "@/lib/auth/server";
import { getProfessionalsForBusiness } from "@/lib/business/server";

export const dynamic = "force-dynamic";

export default async function ProfissionaisPage() {
  const business = await requireBusiness();
  const professionals = await getProfessionalsForBusiness(business.id);

  return (
    <ProfessionalsManager
      businessId={business.id}
      businessName={business.name}
      themeKey={business.theme_key}
      initialProfessionals={professionals}
    />
  );
}
