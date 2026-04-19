"use client";

import { GameProvider } from "@/lib/games/context";
import type { GameSlug } from "@/lib/games";

export function GameLayoutClient({ game, children }: { game: GameSlug; children: React.ReactNode }) {
  return <GameProvider game={game}>{children}</GameProvider>;
}
