"use client";

import { useState, useEffect } from "react";
import { recordBattle } from "@/lib/actions/battle-actions";
import { OpponentDeckSelector } from "./OpponentDeckSelector";
import { NormalizationBanner } from "./NormalizationBanner";
import { MiniStats } from "../stats/MiniStats";

type Deck = {
  id: string;
  name: string;
};

type MiniStatsData = {
  wins: number;
  losses: number;
  total: number;
  streak: number;
  trend: { index: number; winRate: number }[];
};

type PendingVote = {
  candidate_id: string;
  raw_name: string;
  compare_to: string;
  same_count: number;
  diff_count: number;
} | null;

type Props = {
  decks: Deck[];
  suggestions: string[];
  miniStats: MiniStatsData | null;
  pendingVote: PendingVote;
};

export function BattleRecordForm({
  decks,
  suggestions,
  miniStats,
  pendingVote,
}: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [opponentDeck, setOpponentDeck] = useState("");
  const [turnOrder, setTurnOrder] = useState<"first" | "second" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<"win" | "loss" | null>(null);

  // Restore selected deck from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedDeckId");
    if (saved && decks.some((d) => d.id === saved)) {
      setSelectedDeckId(saved);
    } else if (decks.length > 0) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks]);

  // Save selected deck to localStorage
  useEffect(() => {
    if (selectedDeckId) {
      localStorage.setItem("selectedDeckId", selectedDeckId);
    }
  }, [selectedDeckId]);

  const handleSubmit = async (result: "win" | "loss") => {
    if (!selectedDeckId || !opponentDeck.trim()) return;
    setSubmitting(true);
    try {
      await recordBattle({
        myDeckId: selectedDeckId,
        opponentDeckName: opponentDeck.trim(),
        result,
        turnOrder,
      });
      setLastResult(result);
      setOpponentDeck("");
      setTurnOrder(null);
      // Flash feedback then reset
      setTimeout(() => setLastResult(null), 1500);
    } catch {
      // handle error
    } finally {
      setSubmitting(false);
    }
  };

  if (decks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          まずデッキを登録してください
        </p>
        <a
          href="/decks"
          className="inline-block rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium"
        >
          デッキ登録へ
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Deck selector */}
      <div>
        <select
          value={selectedDeckId}
          onChange={(e) => setSelectedDeckId(e.target.value)}
          className="w-full rounded-lg bg-card border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
        >
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>
      </div>

      {/* Mini stats */}
      {miniStats && <MiniStats stats={miniStats} />}

      {/* Normalization vote */}
      {pendingVote && <NormalizationBanner vote={pendingVote} />}

      {/* Opponent deck */}
      <OpponentDeckSelector
        suggestions={suggestions}
        value={opponentDeck}
        onChange={setOpponentDeck}
      />

      {/* Turn order */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">先攻/後攻（任意）</p>
        <div className="flex gap-2">
          {(["first", "second"] as const).map((order) => (
            <button
              key={order}
              type="button"
              onClick={() =>
                setTurnOrder(turnOrder === order ? null : order)
              }
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors min-h-[44px] ${
                turnOrder === order
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {order === "first" ? "先攻" : "後攻"}
            </button>
          ))}
        </div>
      </div>

      {/* Result buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => handleSubmit("win")}
          disabled={submitting || !opponentDeck.trim()}
          className={`flex-1 rounded-lg py-4 text-lg font-bold transition-all min-h-[56px] ${
            lastResult === "win"
              ? "bg-success text-white scale-95"
              : "bg-success/80 text-white hover:bg-success disabled:opacity-40"
          }`}
        >
          WIN
        </button>
        <button
          onClick={() => handleSubmit("loss")}
          disabled={submitting || !opponentDeck.trim()}
          className={`flex-1 rounded-lg py-4 text-lg font-bold transition-all min-h-[56px] ${
            lastResult === "loss"
              ? "bg-destructive text-white scale-95"
              : "bg-destructive/80 text-white hover:bg-destructive disabled:opacity-40"
          }`}
        >
          LOSS
        </button>
      </div>
    </div>
  );
}
