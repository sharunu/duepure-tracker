"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareModal } from "./ShareModal";

export type StatsShareData = {
  totalWins: number;
  totalLosses: number;
  winRate: number;
  firstWins: number;
  firstLosses: number;
  secondWins: number;
  secondLosses: number;
  topMyDecks: { name: string; wins: number; losses: number; winRate: number }[];
  topOpponentDecks: { name: string; wins: number; losses: number; winRate: number }[];
  encounterDistribution: { name: string; count: number; percentage: number }[];
  period: string;
  format: string;
};

export type DeckShareData = {
  deckName: string;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  firstWins: number;
  firstLosses: number;
  secondWins: number;
  secondLosses: number;
  topMatchups: { name: string; wins: number; losses: number; winRate: number }[];
  period: string;
  format: string;
};

type Props = {
  type: "stats" | "deck" | "opponent";
  data: StatsShareData | DeckShareData;
};

export function ShareButton({ type, data }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg hover:bg-[#232640] transition-colors"
        title="シェア"
      >
        <Share2 size={18} className="text-gray-400" />
      </button>
      {isOpen && (
        <ShareModal
          type={type}
          data={data}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
