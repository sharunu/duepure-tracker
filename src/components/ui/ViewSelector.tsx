"use client";

export type View = "stats" | "distribution" | "trend";

type Props = {
  view: View;
  setView: (v: View) => void;
};

const labels: Record<View, string> = {
  stats: "統計",
  distribution: "分布",
  trend: "推移",
};

export function ViewSelector({ view, setView }: Props) {
  return (
    <div className="flex gap-2">
      {(["stats", "distribution", "trend"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
            view === v
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
