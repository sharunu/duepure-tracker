"use client";

export type Scope = "personal" | "team" | "global";

type Props = {
  scope: Scope;
  setScope: (s: Scope) => void;
  teamEnabled?: boolean;
  isGuest?: boolean;
};

const labels: Record<Scope, string> = {
  personal: "個人",
  team: "サーバー",
  global: "全体",
};

export function ScopeSelector({ scope, setScope, teamEnabled = false, isGuest = false }: Props) {
  return (
    <div className="flex rounded-full bg-muted/30 p-1">
      {(["personal", "team", "global"] as const).map((s) => {
        const disabled = (s === "team" && (!teamEnabled || isGuest)) || (s === "global" && isGuest);
        return (
          <button
            key={s}
            type="button"
            onClick={() => !disabled && setScope(s)}
            disabled={disabled}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors min-h-[40px] ${
              disabled
                ? "text-muted-foreground opacity-50 cursor-not-allowed"
                : scope === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {labels[s]}
          </button>
        );
      })}
    </div>
  );
}
