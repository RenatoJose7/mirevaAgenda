export default function AgendaLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="h-24 animate-pulse rounded-lg bg-secondary" />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="h-[32rem] animate-pulse rounded-lg bg-secondary" />
        <div className="h-96 animate-pulse rounded-lg bg-secondary" />
      </div>
    </main>
  );
}
