"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { GAMES, type GameMeta, type GameSlug } from "./index";

const GameContext = createContext<GameMeta | null>(null);

function writeSelectedGameCookie(game: GameSlug) {
  if (typeof document === "undefined") return;
  // max-age 1年, path=/, samesite=lax
  document.cookie = `selectedGame=${game}; path=/; max-age=31536000; samesite=lax`;
}

function writeSelectedGameLocalStorage(game: GameSlug) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("selectedGame", game);
  } catch {
    // no-op (quota exceeded / private mode)
  }
}

export function GameProvider({
  game,
  children,
}: {
  game: GameSlug;
  children: ReactNode;
}) {
  // URL で現在のゲームが決まるため、Provider マウント時に localStorage + cookie を同期
  useEffect(() => {
    writeSelectedGameLocalStorage(game);
    writeSelectedGameCookie(game);
  }, [game]);

  return <GameContext.Provider value={GAMES[game]}>{children}</GameContext.Provider>;
}

export function useGame(): GameMeta {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within <GameProvider>");
  }
  return ctx;
}

export function useGameOptional(): GameMeta | null {
  return useContext(GameContext);
}
