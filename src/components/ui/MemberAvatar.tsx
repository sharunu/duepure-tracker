"use client";

import { getAvatarColor, getInitial } from "@/lib/avatar-utils";

type Props = {
  userId: string;
  username: string;
  size?: number;
  selected?: boolean;
  showLabel?: boolean;
};

export function MemberAvatar({ userId, username, size = 32, selected = false, showLabel = false }: Props) {
  const color = getAvatarColor(userId);
  const initial = getInitial(username);
  const fontSize = Math.round(size * 0.4);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={"rounded-full flex items-center justify-center flex-shrink-0 transition-shadow" + (selected ? " ring-2 ring-primary ring-offset-1 ring-offset-[#0f172a]" : "")}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          fontSize,
        }}
      >
        <span className="text-white font-medium leading-none">{initial}</span>
      </div>
      {showLabel && (
        <span className="text-[10px] text-muted-foreground truncate w-[48px] text-center">{username}</span>
      )}
    </div>
  );
}
