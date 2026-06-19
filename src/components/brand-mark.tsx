import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
        M
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-slate-950">Mireva Agenda</span>
          <span className="block text-xs text-muted-foreground">Design & Sistemas</span>
        </span>
      )}
    </Link>
  );
}
