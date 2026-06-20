"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { prepareBusinessLogo } from "@/lib/images/client";
import { cn } from "@/lib/utils";

type BusinessLogoFieldProps = {
  label?: string;
  logoUrl?: string | null;
  disabled?: boolean;
  isBusy?: boolean;
  helper?: string;
  onLogoPrepared: (file: File, previewUrl: string) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
  onError?: (message: string) => void;
};

export function BusinessLogoField({
  label = "Foto do estabelecimento",
  logoUrl,
  disabled = false,
  isBusy = false,
  helper = "JPG, PNG ou WEBP. A imagem será reduzida antes do envio.",
  onLogoPrepared,
  onRemove,
  onError,
}: BusinessLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl ?? null);
  const [isPreparing, setIsPreparing] = useState(false);
  const busy = disabled || isBusy || isPreparing;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsPreparing(true);

    try {
      const prepared = await prepareBusinessLogo(file);
      const nextPreviewUrl = URL.createObjectURL(prepared);
      const previousPreviewUrl = previewUrl;

      setPreviewUrl(nextPreviewUrl);

      try {
        await onLogoPrepared(prepared, nextPreviewUrl);
      } catch (error) {
        URL.revokeObjectURL(nextPreviewUrl);
        setPreviewUrl(previousPreviewUrl ?? logoUrl ?? null);
        onError?.(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Não foi possível preparar a imagem.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleRemove() {
    if (!onRemove) {
      setPreviewUrl(null);
      return;
    }

    try {
      await onRemove();
      setPreviewUrl(null);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Não foi possível remover a foto.");
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center">
        <div
          className={cn(
            "grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-secondary text-muted-foreground",
            previewUrl && "bg-white",
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Foto do estabelecimento" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="size-7" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-950">
            {previewUrl ? "Foto selecionada" : "Nenhuma foto enviada"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {isPreparing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {previewUrl ? "Trocar foto" : "Selecionar foto"}
            </Button>
            {previewUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
                <Trash2 className="size-4" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />
    </div>
  );
}
