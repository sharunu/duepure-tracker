"use client";

import { DEFAULT_GAME, GAMES, type GameSlug } from "@/lib/games";
import { useGameOptional } from "@/lib/games/context";

type Props = {
  format: string;
  setFormat: (f: string) => void;
  /** 省略時は GameProvider または DEFAULT_GAME を使う */
  game?: GameSlug;
};

export function FormatSelector({ format, setFormat, game }: Props) {
  const ctx = useGameOptional();
  const gameSlug: GameSlug = game ?? ctx?.slug ?? DEFAULT_GAME;
  const formats = GAMES[gameSlug].formats;

  // ゲームにフォーマット概念がない場合は何も描画しない
  if (formats.length === 0) return null;

  return (
    <div className="inline-flex rounded-full border border-border overflow-hidden">
      {formats.map((f) => (
        <button
          key={f.code}
          type="button"
          onClick={() => setFormat(f.code)}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            format === f.code
              ? "bg-primary text-primary-foreground"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
