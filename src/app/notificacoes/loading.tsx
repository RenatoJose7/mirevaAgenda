export default function NotificacoesLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 md:px-8 md:py-8">
      <div className="ml-auto h-10 w-56 animate-pulse rounded-lg bg-secondary" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-lg bg-secondary" />
      ))}
    </main>
  );
}
