"use client";

import { getAvatarColor, getInitial } from "@/lib/avatar-utils";

type Props = {
  members: { user_id: string; discord_username: string }[];
  max?: number;
};

export function MemberAvatarStack({ members, max = 5 }: Props) {
  const shown = members.slice(0, max);
  const remaining = members.length - max;

  return (
    <div className="flex items-center">
      {shown.map((m, i) => {
        const color = getAvatarColor(m.user_id);
        const initial = getInitial(m.discord_username);
        return (
          <div
            key={m.user_id}
            className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0f172a]"
            style={{
              backgroundColor: color,
              marginLeft: i === 0 ? 0 : -6,
              zIndex: shown.length - i,
            }}
          >
            <span className="text-[9px] text-white font-medium leading-none">{initial}</span>
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0f172a] bg-muted/50"
          style={{ marginLeft: -6, zIndex: 0 }}
        >
          <span className="text-[8px] text-muted-foreground font-medium">+{remaining}</span>
        </div>
      )}
    </div>
  );
}
