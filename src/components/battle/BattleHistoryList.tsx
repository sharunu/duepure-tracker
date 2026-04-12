"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { updateBattle, deleteBattle } from "@/lib/actions/battle-actions";
import { EditBattleModal } from "./EditBattleModal";

type Tuning = { id: string; name: string; sort_order: number };
type Deck = { id: string; name: string; deck_tunings?: Tuning[] };

type Battle = {
  id: string;
  my_deck_id: string;
  my_deck_name: string;
  opponent_deck_name: string;
  opponent_memo?: string | null;
  result: "win" | "loss";
  turn_order: "first" | "second" | null;
  fought_at: string;
  tuning_id: string | null;
  tuning_name?: string | null;
};

type Props = {
  battles: Battle[];
  decks: Deck[];
  suggestions: { major: string[]; minor: string[]; other: string[] };
  onRefresh: () => void;
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function groupByDate(battles: Battle[]): { date: string; battles: Battle[] }[] {
  const map = new Map<string, Battle[]>();
  for (const b of battles) {
    const d = new Date(b.fought_at);
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return Array.from(map.entries()).map(([date, battles]) => ({ date, battles }));
}

export function BattleHistoryList({ battles, decks, suggestions, onRefresh }: Props) {
  const [editingBattle, setEditingBattle] = useState<Battle | null>(null);

  if (battles.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        対戦履歴がありません
      </p>
    );
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("この対戦記録を削除しますか？")) return;
    await deleteBattle(id);
    onRefresh();
  };

  const handleSave = async (fields: {
    opponentDeckName: string;
    result: "win" | "loss";
    turnOrder: "first" | "second" | null;
    myDeckId: string;
    myDeckName: string;
    tuningId?: string | null;
    tuningName?: string | null;
    opponentMemo?: string | null;
  }) => {
    if (!editingBattle) return;
    await updateBattle(editingBattle.id, fields);
    setEditingBattle(null);
    onRefresh();
  };

  const groups = groupByDate(battles);

  return (
    <>
      <div className="space-y-0">
        {groups.map((group, groupIdx) => (
          <div key={group.date}>
            {/* Date group header */}
            <div
              className={`text-[11px] font-medium text-[#555577] ${
                groupIdx === 0 ? "pt-[4px]" : "pt-[10px]"
              } pb-[6px]`}
            >
              {group.date}
            </div>

            {/* Battle cards */}
            <div className="flex flex-col gap-[6px]">
              {group.battles.map((b) => {
                const deckDisplay = b.my_deck_name ?? "?";
                const tuningDisplay = b.tuning_name;
                const isWin = b.result === "win";

                return (
                  <div
                    key={b.id}
                    className="bg-[#232640] rounded-[10px] overflow-hidden flex"
                  >
                    {/* Left color bar */}
                    <div
                      className={`w-[3px] shrink-0 ${
                        isWin ? "bg-[#50c878]" : "bg-[#e85d75]"
                      }`}
                    />

                    {/* Card content */}
                    <div className="flex-1 px-3 py-2.5 min-w-0">
                      {/* Top row: badge, deck, vs, opponent */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`shrink-0 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isWin
                              ? "bg-[rgba(80,200,120,0.12)] text-[#50c878]"
                              : "bg-[rgba(232,93,117,0.12)] text-[#e85d75]"
                          }`}
                        >
                          {isWin ? "WIN" : "LOSE"}
                        </span>

                        <span className="text-[13px] font-medium text-white truncate">
                          {deckDisplay}
                        </span>
                        {tuningDisplay && (
                          <>
                            <span className="text-[11px] text-[#8888aa] shrink-0">/</span>
                            <span className="text-[11px] text-[#8888aa] truncate">
                              {tuningDisplay}
                            </span>
                          </>
                        )}
                        <span className="text-[11px] text-[#555577] shrink-0">vs</span>
                        <span className="text-[13px] text-[#ccccdd] truncate">
                          {b.opponent_deck_name}
                        </span>
                      </div>

                      {/* Bottom row: turn order, memo, time, buttons */}
                      <div className="flex items-center gap-2 mt-1">
                        {b.turn_order && (
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] ${
                              b.turn_order === "first"
                                ? "bg-[rgba(240,160,48,0.1)] text-[#f0a030]"
                                : "bg-[rgba(91,141,239,0.1)] text-[#5b8def]"
                            }`}
                          >
                            {b.turn_order === "first" ? "先攻" : "後攻"}
                          </span>
                        )}
                        {b.opponent_memo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[rgba(148,163,184,0.1)] text-[#94a3b8] truncate max-w-[120px]">
                            {b.opponent_memo}
                          </span>
                        )}
                        <span className="text-[10px] text-[#555577]">
                          {formatTime(b.fought_at)}
                        </span>

                        <div className="ml-auto flex gap-1.5">
                          <button
                            onClick={() => setEditingBattle(b)}
                            className="relative p-2 -m-2 flex items-center justify-center"
                          >
                            <span className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] bg-[rgba(91,141,239,0.08)]"><Pencil size={13} color="#5b8def" /></span>
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="relative p-2 -m-2 flex items-center justify-center"
                          >
                            <span className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] bg-[rgba(232,93,117,0.08)]"><X size={13} color="#e85d75" /></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editingBattle && (
        <EditBattleModal
          battle={editingBattle}
          decks={decks}
          suggestions={suggestions}
          onSave={handleSave}
          onClose={() => setEditingBattle(null)}
        />
      )}
    </>
  );
}
