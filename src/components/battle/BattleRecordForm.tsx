"use client";

import { useState, useEffect } from "react";
import { recordBattle, getMiniStats, getAllBattles } from "@/lib/actions/battle-actions";
import { OpponentDeckSelector } from "./OpponentDeckSelector";
import { BattleIntervalModal } from "./BattleIntervalModal";
import { MiniStats } from "../stats/MiniStats";

import type { Format } from "@/hooks/use-format";

type Tuning = { id: string; name: string; sort_order: number };
type Deck = {
  id: string;
  name: string;
  deck_tunings?: Tuning[];
};

type MiniStatsData = {
  wins: number;
  losses: number;
  total: number;
  streak: number;
};

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
  format: Format;
  setFormat: (f: Format) => void;
};

function parseDeckSelection(value: string): { deckId: string; tuningId: string | null } {
  const parts = value.split(":");
  return { deckId: parts[0], tuningId: parts[1] ?? null };
}

export function BattleRecordForm({
  decks,
  suggestions,
  miniStats: initialMiniStats,
  format,
  setFormat,
}: Props) {
  const [selectedValue, setSelectedValue] = useState<string>("");
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
    const saved = localStorage.getItem(`selectedDeckSelection_${format}`);
    if (saved) {
      const { deckId, tuningId } = parseDeckSelection(saved);
      const deck = decks.find(d => d.id === deckId);
      if (deck) {
        if (!tuningId || deck.deck_tunings?.some(t => t.id === tuningId)) {
          setSelectedValue(saved);
          return;
        }
        setSelectedValue(deckId);
        return;
      }
    }
    if (decks.length > 0) {
      setSelectedValue(decks[0].id);
    } else {
      setSelectedValue("");
    }
  }, [decks, format]);

  // Save selected value to localStorage (per format)
  useEffect(() => {
    if (selectedValue) {
      localStorage.setItem(`selectedDeckSelection_${format}`, selectedValue);
    }
  }, [selectedValue, format]);

  const handleSubmit = async (result: "win" | "loss") => {
    const { deckId, tuningId } = parseDeckSelection(selectedValue);
    if (!deckId || !opponentDeck.trim()) return;
    setSubmitting(true);
    try {
      await recordBattle({
        myDeckId: deckId,
        opponentDeckName: opponentDeck.trim(),
        result,
        turnOrder,
        format,
        tuningId,
      });
      setLastResult(result);
      setOpponentDeck("");
      setTurnOrder(null);
      setTimeout(() => setLastResult(null), 1500);
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
      getMiniStats(format).then(setMiniStats);
    } else {
      localStorage.setItem(`measureSince_${format}`, timestamp);
      setMeasureSince(timestamp);
    }
  };

  const deckOptions: { value: string; label: string }[] = [];
  for (const deck of decks) {
    const tunings = deck.deck_tunings ?? [];
    if (tunings.length === 0) {
      deckOptions.push({ value: deck.id, label: deck.name });
    } else {
      deckOptions.push({ value: deck.id, label: `${deck.name}（指定なし）` });
      for (const t of tunings) {
        deckOptions.push({ value: `${deck.id}:${t.id}`, label: `${deck.name} / ${t.name}` });
      }
    }
  }

  return (
    <div className="space-y-4">

      {decks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4 text-[14px]">
            まずデッキを登録してください
          </p>
          <a
            href="/decks"
            className="inline-block rounded-[10px] bg-indigo-500 text-white px-6 py-3 text-[14px] font-medium"
          >
            デッキ登録へ
          </a>
        </div>
      ) : (
        <>
          {/* Mini stats */}
          <MiniStats
            stats={miniStats ?? { wins: 0, losses: 0, total: 0, streak: 0 }}
            onEditInterval={handleOpenIntervalModal}
          />

          {/* Deck selector */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] text-gray-500">使用デッキ</p>
            <a
              href="/decks"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              使用デッキ管理
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          </div>
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            className="w-full rounded-[6px] px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            style={{ backgroundColor: "#1a1d2e", border: "0.5px solid #333355", color: "#e5e7eb" }}
          >
            {deckOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Opponent deck */}
          <OpponentDeckSelector
            majorSuggestions={suggestions.major}
            otherSuggestions={suggestions.other}
            value={opponentDeck}
            onChange={setOpponentDeck}
          />

          {/* Turn order */}
          <div>
            <p className="text-[12px] text-gray-500 mb-2">先攻/後攻（任意）</p>
            <div className="flex gap-2">
              {(["first", "second"] as const).map((order) => (
                <button
                  key={order}
                  type="button"
                  onClick={() =>
                    setTurnOrder(turnOrder === order ? null : order)
                  }
                  className="flex-1 rounded-[6px] px-3 py-2 text-[13px] transition-colors min-h-[44px]"
                  style={
                    turnOrder === order
                      ? { backgroundColor: "rgba(99,102,241,0.1)", border: "1px solid #6366f1", color: "#818cf8" }
                      : { backgroundColor: "#232640", border: "0.5px solid rgba(100,100,150,0.2)", color: "#9ca3af" }
                  }
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
              className={"flex-1 rounded-[10px] py-4 text-[18px] font-bold transition-all min-h-[56px] shadow-lg text-white " + (
                lastResult === "win"
                  ? "scale-95 opacity-90"
                  : "hover:brightness-110 disabled:opacity-40"
              )}
              style={{ background: "linear-gradient(to right, #22c55e, #16a34a)" }}
            >
              WIN
            </button>
            <button
              onClick={() => handleSubmit("loss")}
              disabled={submitting || !opponentDeck.trim()}
              className={"flex-1 rounded-[10px] py-4 text-[18px] font-bold transition-all min-h-[56px] shadow-lg text-white " + (
                lastResult === "loss"
                  ? "scale-95 opacity-90"
                  : "hover:brightness-110 disabled:opacity-40"
              )}
              style={{ background: "linear-gradient(to right, #ef4444, #dc2626)" }}
            >
              LOSE
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
