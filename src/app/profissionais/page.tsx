import { ProfessionalsManager } from "@/components/professionals-manager";
import { requireBusiness } from "@/lib/auth/server";
import { getPlanUsageForBusiness, getProfessionalsForBusiness } from "@/lib/business/server";
import { getSubscriptionPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function ProfissionaisPage() {
  const business = await requireBusiness();
  const [professionals, usage] = await Promise.all([
    getProfessionalsForBusiness(business.id),
    getPlanUsageForBusiness(business.id),
  ]);
  const plan = getSubscriptionPlan(usage.subscription?.plan_id);

  return (
    <ProfessionalsManager
      businessId={business.id}
      businessName={business.name}
      themeKey={business.theme_key}
      initialProfessionals={professionals}
      planName={plan.name}
      maxProfessionals={usage.subscription?.max_professionals ?? plan.maxProfessionals}
    />
  );
}
