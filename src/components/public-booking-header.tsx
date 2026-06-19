import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export function PublicBookingHeader() {
  return (
    <header className="border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Button asChild variant="outline" size="sm">
            <Link href="/">Buscar estabelecimento</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
