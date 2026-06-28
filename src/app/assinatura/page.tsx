import { SubscriptionView } from "@/components/subscription-view";
import { requireBusiness } from "@/lib/auth/server";
import { getPlanUsageForBusiness } from "@/lib/business/server";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ pagamento?: string }>;
}) {
  const business = await requireBusiness();
  const usage = await getPlanUsageForBusiness(business.id);
  const { pagamento } = await searchParams;
  const paymentStatus =
    pagamento === "sucesso" || pagamento === "cancelado" || pagamento === "expirado" ? pagamento : undefined;

  return <SubscriptionView business={business} usage={usage} paymentStatus={paymentStatus} />;
}
