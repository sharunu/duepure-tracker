"use client";

import { DEFAULT_GAME, GAMES, type GameSlug } from "@/lib/games";
import { useGameOptional } from "@/lib/games/context";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

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

  if (formats.length === 0) return null;

  return (
    <SegmentedControl
      items={formats.map((f) => ({ value: f.code, label: f.label }))}
      value={format}
      onChange={setFormat}
      size="sm"
      variant="filled"
      pill
    />
  );
}
