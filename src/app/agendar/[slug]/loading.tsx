import { PublicBookingHeader } from "@/components/public-booking-header";

export default function PublicBookingLoading() {
  return (
    <main className="min-h-screen bg-background">
      <PublicBookingHeader />
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-secondary" />
          <div className="h-48 animate-pulse rounded-lg bg-secondary" />
          <div className="h-40 animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="h-72 animate-pulse rounded-lg bg-secondary" />
      </section>
    </main>
  );
}
