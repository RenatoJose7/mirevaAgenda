import Link from "next/link";
import Image from "next/image";
import logoAgenda from "../../assets/logoAgenda.png";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid size-10 place-items-center overflow-hidden rounded-lg bg-primary shadow-sm">
        <Image
          src={logoAgenda}
          alt="Mireva Agenda"
          className="size-full object-cover"
          priority
          sizes="40px"
        />
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
