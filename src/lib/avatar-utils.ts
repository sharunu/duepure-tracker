import { COLORS } from "@/lib/stats-utils";

export function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash += userId.charCodeAt(i);
  }
  return COLORS[hash % COLORS.length];
}

export function getInitial(username: string): string {
  return username.charAt(0).toUpperCase();
}
