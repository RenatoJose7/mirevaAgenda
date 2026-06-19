import { SettingsView } from "@/components/settings-view";
import { requireBusiness } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const business = await requireBusiness();

  return <SettingsView business={business} />;
}
