"use client";

import { useRef } from "react";
import type { TeamWithVisibility, TeamMember } from "@/lib/actions/team-actions";
import { MemberAvatar } from "@/components/ui/MemberAvatar";

type Props = {
  teams: TeamWithVisibility[];
  activeTeamId: string | null;
  onTeamSelect: (teamId: string) => void;
  members: TeamMember[];
  selectedMemberId: string | null;
  onMemberSelect: (memberId: string | null) => void;
};

export function TeamServerCard({ teams, activeTeamId, onTeamSelect, members, selectedMemberId, onMemberSelect }: Props) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const activeTeam = teams.find((t) => t.id === activeTeamId);

  return (
    <div className="rounded-xl border border-muted/20 overflow-hidden" style={{ backgroundColor: "#1a1d35" }}>
      {/* 上段: サーバー選択 */}
      <button
        onClick={() => selectRef.current?.showPicker?.()}
        className="flex items-center gap-3 w-full px-3 py-2.5 text-left"
      >
        {activeTeam?.icon_url ? (
          <img src={activeTeam.icon_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
            {activeTeam?.name.charAt(0) ?? "?"}
          </div>
        )}
        <span className="text-sm font-medium text-foreground flex-1 truncate">{activeTeam?.name ?? "サーバー未選択"}</span>
        {teams.length > 1 && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground flex-shrink-0">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
        <select
          ref={selectRef}
          value={activeTeamId ?? ""}
          onChange={(e) => { if (e.target.value) onTeamSelect(e.target.value); }}
          className="absolute opacity-0 w-0 h-0"
          tabIndex={-1}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </button>

      {/* 下段: メンバー選択（横スクロール） */}
      {members.length > 0 && (
        <div
          className="flex gap-3 px-3 py-2.5 overflow-x-auto"
          style={{
            borderTop: "0.5px solid #2a2d48",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {/* 全体アバター */}
          <button
            onClick={() => onMemberSelect(null)}
            className="flex flex-col items-center gap-0.5 flex-shrink-0"
          >
            <div
              className={"w-8 h-8 rounded-full flex items-center justify-center transition-shadow" + (selectedMemberId === null ? " ring-2 ring-primary ring-offset-1 ring-offset-[#1a1d35]" : "")}
              style={{ backgroundColor: "rgba(100,100,150,0.25)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="text-[10px] text-muted-foreground w-[48px] text-center truncate">全体</span>
          </button>

          {/* 各メンバー */}
          {members.map((m) => (
            <button
              key={m.user_id}
              onClick={() => onMemberSelect(m.user_id)}
              className="flex-shrink-0"
            >
              <MemberAvatar
                userId={m.user_id}
                username={m.discord_username}
                size={32}
                selected={selectedMemberId === m.user_id}
                showLabel
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
