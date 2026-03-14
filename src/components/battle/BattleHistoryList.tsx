"use client";

import { useState } from "react";
import { updateBattle, deleteBattle } from "@/lib/actions/battle-actions";
import { EditBattleModal } from "./EditBattleModal";

type Tuning = { id: string; name: string; sort_order: number };
type Deck = { id: string; name: string; deck_tunings?: Tuning[] };

type Battle = {
  id: string;
  my_deck_id: string;
  opponent_deck_name: string;
  result: "win" | "loss";
  turn_order: "first" | "second" | null;
  fought_at: string;
  tuning_id: string | null;
  decks: { name: string } | null;
  deck_tunings: { name: string } | null;
};

type Props = {
  battles: Battle[];
  decks: Deck[];
  suggestions: { major: string[]; other: string[] };
  onRefresh: () => void;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
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
    tuningId?: string | null;
  }) => {
    if (!editingBattle) return;
    await updateBattle(editingBattle.id, fields);
    setEditingBattle(null);
    onRefresh();
  };

  return (
    <>
      <div className="space-y-2">
        {battles.map((b) => {
          const deckDisplay = b.decks?.name ?? "?";
          const tuningDisplay = b.deck_tunings?.name;
          const fullDeckName = tuningDisplay ? `${deckDisplay} / ${tuningDisplay}` : deckDisplay;

          return (
            <div
              key={b.id}
              className="relative rounded-lg border border-border bg-card p-3"
            >
              {/* Edit/Delete buttons */}
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => setEditingBattle(b)}
                  className="text-xs text-muted-foreground hover:text-primary px-1.5 py-0.5"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-xs text-muted-foreground hover:text-destructive px-1.5 py-0.5"
                >
                  削除
                </button>
              </div>

              <div className="flex items-center gap-2 pr-16">
                {/* Result badge */}
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-bold text-white ${
                    b.result === "win" ? "bg-success" : "bg-destructive"
                  }`}
                >
                  {b.result === "win" ? "Win" : "Lose"}
                </span>

                {/* Deck names */}
                <span className="text-sm font-medium truncate">
                  {fullDeckName}
                </span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="text-sm truncate">{b.opponent_deck_name}</span>
              </div>

              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                {b.turn_order && (
                  <span>{b.turn_order === "first" ? "先攻" : "後攻"}</span>
                )}
                <span>{formatDate(b.fought_at)}</span>
              </div>
            </div>
          );
        })}
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
