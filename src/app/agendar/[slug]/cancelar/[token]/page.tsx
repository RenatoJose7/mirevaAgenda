import { PublicCancelClient } from "@/components/public-cancel-client";
import { PublicBookingHeader } from "@/components/public-booking-header";

export const dynamic = "force-dynamic";

export default async function CancelPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;

  return (
    <main className="min-h-screen bg-background">
      <PublicBookingHeader />
      <PublicCancelClient slug={slug} token={token} />
    </main>
  );
}
