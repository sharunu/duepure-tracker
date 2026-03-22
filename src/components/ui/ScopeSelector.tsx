"use client";

export type Scope = "personal" | "team" | "global";

type Props = {
  scope: Scope;
  setScope: (s: Scope) => void;
};

const labels: Record<Scope, string> = {
  personal: "個人",
  team: "チーム",
  global: "全体",
};

export function ScopeSelector({ scope, setScope }: Props) {
  return (
    <div className="flex gap-2">
      {(["personal", "team", "global"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => s !== "team" && setScope(s)}
          disabled={s === "team"}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
            s === "team"
              ? "border-border bg-card text-muted-foreground opacity-50 cursor-not-allowed"
              : scope === s
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          {labels[s]}
        </button>
      ))}
    </div>
  );
}
