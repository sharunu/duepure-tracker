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
    <div className="flex rounded-full bg-muted/30 p-1">
      {(["personal", "team", "global"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => s !== "team" && setScope(s)}
          disabled={s === "team"}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors min-h-[40px] ${
            s === "team"
              ? "text-muted-foreground opacity-50 cursor-not-allowed"
              : scope === s
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          {labels[s]}
        </button>
      ))}
    </div>
  );
}
