"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Result = {
  name: string;
  slug: string;
  segment: string | null;
  address: string | null;
  logoUrl: string | null;
};

export function PublicBusinessSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const canSearch = query.trim().length >= 2;
  const visibleResults = canSearch ? results : [];

  useEffect(() => {
    const term = query.trim();

    if (!canSearch) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      const response = await fetch(`/api/public/business-search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      }).catch(() => null);

      if (response?.ok) {
        const payload = (await response.json()) as { results?: Result[] };
        setResults(payload.results ?? []);
      } else {
        setResults([]);
      }

      setHasSearched(true);
      setIsLoading(false);
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canSearch, query]);

  return (
    <Card className="border-primary/15 shadow-xl shadow-primary/10">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Encontrar estabelecimento</h2>
          <p className="mt-1 text-sm text-muted-foreground">Busque por nome ou segmento para agendar em um negócio real.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Procure um estabelecimento"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="space-y-3">
          {isLoading && (
            <>
              <div className="h-20 animate-pulse rounded-lg bg-secondary" />
              <div className="h-20 animate-pulse rounded-lg bg-secondary" />
            </>
          )}
          {!isLoading &&
            visibleResults.map((business) => (
              <div key={business.slug} className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {business.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logoUrl} alt={business.name} className="size-12 rounded-lg border object-cover" />
                  ) : (
                    <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                      {business.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{business.name}</p>
                    <p className="text-sm text-muted-foreground">{business.segment || "Agendamento por horario marcado"}</p>
                    {business.address && <p className="mt-1 text-xs text-muted-foreground">{business.address}</p>}
                  </div>
                </div>
                <Button asChild>
                  <Link href={`/agendar/${business.slug}`}>Agendar</Link>
                </Button>
              </div>
            ))}
          {!isLoading && canSearch && hasSearched && visibleResults.length === 0 && (
            <p className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Nenhum estabelecimento encontrado para essa busca.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
