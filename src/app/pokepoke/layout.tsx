import type { Metadata } from "next";
import { GAMES } from "@/lib/games";
import { GameLayoutClient } from "./GameLayoutClient";

const meta = GAMES.pokepoke;

export const metadata: Metadata = {
  title: {
    default: meta.trackerName,
    template: `%s | ${meta.trackerName}`,
  },
  description: meta.description,
};

export default function PokepokeLayout({ children }: { children: React.ReactNode }) {
  return <GameLayoutClient game="pokepoke">{children}</GameLayoutClient>;
}
