"use client";

import { useState, useEffect } from "react";
import { recordBattle, getMiniStats, getAllBattles } from "@/lib/actions/battle-actions";
import { OpponentDeckSelector } from "./OpponentDeckSelector";
import { NormalizationBanner } from "./NormalizationBanner";
import { BattleIntervalModal } from "./BattleIntervalModal";
import { MiniStats } from "../stats/MiniStats";
import { FormatSelector } from "../ui/FormatSelector";
import type { Format } from "@/hooks/use-format";

type Deck = {
  id: string;
  name: string;
};

type MiniStatsData = {
  wins: number;
  losses: number;
  total: number;
  streak: number;
};

type PendingVote = {
  candidate_id: string;
  raw_name: string;
  compare_to: string;
  same_count: number;
  diff_count: number;
} | null;

type BattleForModal = {
  id: string;
  opponent_deck_name: string;
  result: string;
  fought_at: string;
  decks: { name: string } | null;
};

type Props = {
  decks: Deck[];
  suggestions: { major: string[]; other: string[] };
  miniStats: MiniStatsData | null;
  pendingVote: PendingVote;
  format: Format;
  setFormat: (f: Format) => void;
};

export function BattleRecordForm({
  decks,
  suggestions,
  miniStats: initialMiniStats,
  pendingVote,
  format,
  setFormat,
}: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [opponentDeck, setOpponentDeck] = useState("");
  const [turnOrder, setTurnOrder] = useState<"first" | "second" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<"win" | "loss" | null>(null);
  const [miniStats, setMiniStats] = useState<MiniStatsData | null>(initialMiniStats);

  // Measure interval state
  const [measureSince, setMeasureSince] = useState<string | null>(null);
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [modalBattles, setModalBattles] = useState<BattleForModal[]>([]);

  // Load measureSince from localStorage on mount and format change
  useEffect(() => {
    const saved = localStorage.getItem(`measureSince_${format}`);
    setMeasureSince(saved);
  }, [format]);

  // When measureSince changes, refresh stats
  useEffect(() => {
    if (measureSince !== null) {
      getMiniStats(format, measureSince).then(setMiniStats);
    }
  }, [measureSince, format]);

  // Sync miniStats when props change (e.g. format switch) - only if no custom interval
  useEffect(() => {
    const saved = localStorage.getItem(`measureSince_${format}`);
    if (!saved) {
      setMiniStats(initialMiniStats);
    }
  }, [initialMiniStats, format]);

  // Restore selected deck from localStorage (per format)
  useEffect(() => {
    const saved = localStorage.getItem(`selectedDeckId_${format}`);
    if (saved && decks.some((d) => d.id === saved)) {
      setSelectedDeckId(saved);
    } else if (decks.length > 0) {
      setSelectedDeckId(decks[0].id);
    } else {
      setSelectedDeckId("");
    }
  }, [decks, format]);

  // Save selected deck to localStorage (per format)
  useEffect(() => {
    if (selectedDeckId) {
      localStorage.setItem(`selectedDeckId_${format}`, selectedDeckId);
    }
  }, [selectedDeckId, format]);

  const handleSubmit = async (result: "win" | "loss") => {
    if (!selectedDeckId || !opponentDeck.trim()) return;
    setSubmitting(true);
    try {
      await recordBattle({
        myDeckId: selectedDeckId,
        opponentDeckName: opponentDeck.trim(),
        result,
        turnOrder,
        format,
      });
      setLastResult(result);
      setOpponentDeck("");
      setTurnOrder(null);
      // Flash feedback then reset
      setTimeout(() => setLastResult(null), 1500);
      // Refresh mini stats immediately
      const updatedStats = await getMiniStats(format, measureSince ?? undefined);
      setMiniStats(updatedStats);
    } catch {
      // handle error
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenIntervalModal = async () => {
    const battles = await getAllBattles(format);
    setModalBattles(battles);
    setShowIntervalModal(true);
  };

  const handleSelectInterval = (timestamp: string | null) => {
    if (timestamp === null) {
      localStorage.removeItem(`measureSince_${format}`);
      setMeasureSince(null);
      // Reset to all battles
      getMiniStats(format).then(setMiniStats);
    } else {
      localStorage.setItem(`measureSince_${format}`, timestamp);
      setMeasureSince(timestamp);
    }
  };

  return (
    <div className="space-y-4">
      {/* Format selector */}
      <FormatSelector format={format} setFormat={setFormat} />

      {decks.length === 0 ? (
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
      ) : (
        <>
          {/* Mini stats */}
          {/* Always show MiniStats - use default 0 values when null */}
          <MiniStats
            stats={miniStats ?? { wins: 0, losses: 0, total: 0, streak: 0 }}
            onEditInterval={handleOpenIntervalModal}
          />

          {/* Deck selector */}
          <div>
            <p className="text-sm text-muted-foreground mb-1">使用デッキ</p>
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

          {/* Normalization vote */}
          {pendingVote && <NormalizationBanner vote={pendingVote} />}

          {/* Opponent deck */}
          <OpponentDeckSelector
            majorSuggestions={suggestions.major}
            otherSuggestions={suggestions.other}
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

          {/* Interval modal */}
          <BattleIntervalModal
            open={showIntervalModal}
            onClose={() => setShowIntervalModal(false)}
            battles={modalBattles}
            onSelect={handleSelectInterval}
            currentTimestamp={measureSince}
          />
        </>
      )}
    </div>
  );
}
