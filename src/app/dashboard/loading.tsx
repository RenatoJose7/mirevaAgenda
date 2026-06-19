export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-lg bg-secondary" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="h-80 animate-pulse rounded-lg bg-secondary" />
        <div className="h-80 animate-pulse rounded-lg bg-secondary" />
      </div>
    </main>
  );
}
