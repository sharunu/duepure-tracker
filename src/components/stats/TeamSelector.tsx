"use client";

type TeamOption = {
  id: string;
  name: string;
  icon_url: string | null;
};

type Props = {
  teams: TeamOption[];
  activeTeamId: string | null;
  onSelect: (teamId: string) => void;
};

export function TeamSelector({ teams, activeTeamId, onSelect }: Props) {
  return (
    <div className="w-full">
      <select
        value={activeTeamId ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className="w-full rounded-lg bg-muted/30 border border-muted/50 px-3 py-2.5 text-sm text-foreground appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns=http://www.w3.org/2000/svg width=12 height=12 viewBox=0 0 12 12%3E%3Cpath d=M3 4.5L6 7.5L9 4.5 stroke=%239ca3af stroke-width=1.5 fill=none/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
        }}
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
