"use client";

import type { Format } from "@/hooks/use-format";

type Props = {
  format: Format;
  setFormat: (f: Format) => void;
};

export function FormatSelector({ format, setFormat }: Props) {
  return (
    <div className="inline-flex rounded-full border border-border overflow-hidden">
      {(["ND", "AD"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setFormat(f)}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            format === f
              ? "bg-primary text-primary-foreground"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
