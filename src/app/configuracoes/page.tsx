import { SettingsView } from "@/components/settings-view";
import { requireBusiness } from "@/lib/auth/server";
import { getPlanUsageForBusiness } from "@/lib/business/server";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const business = await requireBusiness();
  const usage = await getPlanUsageForBusiness(business.id);

  return <SettingsView business={business} currentPlanId={usage.subscription?.plan_id ?? "basic"} />;
}
