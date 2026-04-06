"use client";

import type { TeamMember } from "@/lib/actions/team-actions";

type Props = {
  members: TeamMember[];
  selectedMemberId: string | null;
  onSelect: (memberId: string | null) => void;
};

export function TeamMemberSelector({ members, selectedMemberId, onSelect }: Props) {
  return (
    <div className="w-full">
      <select
        value={selectedMemberId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="w-full rounded-lg bg-muted/30 border border-muted/50 px-3 py-2.5 text-sm text-foreground appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns=http://www.w3.org/2000/svg width=12 height=12 viewBox=0 0 12 12%3E%3Cpath d=M3 4.5L6 7.5L9 4.5 stroke=%239ca3af stroke-width=1.5 fill=none/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
        }}
      >
        <option value="">チーム全体</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.discord_username}
          </option>
        ))}
      </select>
    </div>
  );
}
