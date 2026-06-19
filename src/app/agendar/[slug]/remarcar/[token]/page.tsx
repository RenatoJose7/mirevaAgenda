import { PublicBookingHeader } from "@/components/public-booking-header";
import { PublicRescheduleClient } from "@/components/public-reschedule-client";

export const dynamic = "force-dynamic";

export default async function ReschedulePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;

  return (
    <main className="min-h-screen bg-background">
      <PublicBookingHeader />
      <PublicRescheduleClient slug={slug} token={token} />
    </main>
  );
}
