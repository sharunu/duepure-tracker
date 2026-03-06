"use client";

import type { Format } from "@/hooks/use-format";

type Props = {
  format: Format;
  setFormat: (f: Format) => void;
};

export function FormatSelector({ format, setFormat }: Props) {
  return (
    <div className="flex gap-2">
      {(["AD", "ND"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setFormat(f)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
            format === f
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
