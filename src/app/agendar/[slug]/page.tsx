import { PublicBookingClient } from "@/components/public-booking-client";
import { PublicBookingHeader } from "@/components/public-booking-header";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-background">
      <PublicBookingHeader />
      <PublicBookingClient slug={slug} />
    </main>
  );
}
