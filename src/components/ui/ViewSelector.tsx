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
    <div className="flex border-b border-border">
      {(["stats", "distribution", "trend"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
            view === v
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground"
          }`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
