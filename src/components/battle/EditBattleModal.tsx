"use client";

import { useState } from "react";
import { OpponentDeckSelector } from "./OpponentDeckSelector";

type Deck = { id: string; name: string };

type Battle = {
  id: string;
  my_deck_id: string;
  opponent_deck_name: string;
  result: "win" | "loss";
  turn_order: "first" | "second" | null;
};

type Props = {
  battle: Battle;
  decks: Deck[];
  suggestions: string[];
  onSave: (fields: {
    opponentDeckName: string;
    result: "win" | "loss";
    turnOrder: "first" | "second" | null;
    myDeckId: string;
  }) => Promise<void>;
  onClose: () => void;
};

export function EditBattleModal({ battle, decks, suggestions, onSave, onClose }: Props) {
  const [myDeckId, setMyDeckId] = useState(battle.my_deck_id);
  const [opponentDeckName, setOpponentDeckName] = useState(battle.opponent_deck_name);
  const [result, setResult] = useState<"win" | "loss">(battle.result);
  const [turnOrder, setTurnOrder] = useState<"first" | "second" | null>(battle.turn_order);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ opponentDeckName: opponentDeckName.trim(), result, turnOrder, myDeckId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border p-5 w-[90%] max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold">対戦記録を編集</h2>

        {/* My deck selector */}
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">自デッキ</label>
          <select
            value={myDeckId}
            onChange={(e) => setMyDeckId(e.target.value)}
            className="w-full rounded-lg bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
          >
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </div>

        {/* Opponent deck selector */}
        <div className="space-y-1">
          <OpponentDeckSelector
            majorSuggestions={suggestions}
            otherSuggestions={[]}
            value={opponentDeckName}
            onChange={setOpponentDeckName}
          />
        </div>

        {/* Result */}
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">勝敗</label>
          <div className="flex gap-2">
            {(["win", "loss"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResult(r)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                  result === r
                    ? r === "win"
                      ? "border-success bg-success/10 text-success"
                      : "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-card hover:bg-muted text-muted-foreground"
                }`}
              >
                {r === "win" ? "Win" : "Lose"}
              </button>
            ))}
          </div>
        </div>

        {/* Turn order */}
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">先攻/後攻</label>
          <div className="flex gap-2">
            {(["first", "second"] as const).map((order) => (
              <button
                key={order}
                type="button"
                onClick={() => setTurnOrder(turnOrder === order ? null : order)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors min-h-[44px] ${
                  turnOrder === order
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted text-muted-foreground"
                }`}
              >
                {order === "first" ? "先攻" : "後攻"}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-3 text-sm font-medium hover:bg-muted transition-colors min-h-[44px]"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !opponentDeckName.trim()}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors min-h-[44px]"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
