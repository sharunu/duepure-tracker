"use client";

import {
  displayDeckName,
  type OpponentDeckNameMap,
} from "@/lib/actions/opponent-deck-display";
import {
  resultColorClass,
  resultLabel,
  type BattleResult,
} from "@/lib/battle/result-format";

type Battle = {
  id: string;
  opponent_deck_name: string;
  result: string;
  fought_at: string;
  my_deck_name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  battles: Battle[];
  onSelect: (timestamp: string | null) => void;
  currentTimestamp: string | null;
  opponentDeckNameMap?: OpponentDeckNameMap;
};

export function BattleIntervalModal({ open, onClose, battles, onSelect, currentTimestamp, opponentDeckNameMap }: Props) {
  if (!open) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-bold">計測区間編集</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {/* Start from now */}
          <button
            type="button"
            onClick={() => { onSelect(new Date().toISOString()); onClose(); }}
            className="w-full text-left rounded-lg border border-primary bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            今試合から計測開始
          </button>

          {/* Battle list */}
          {battles.map((b) => {
            const isSelected = currentTimestamp === b.fought_at;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { onSelect(b.fought_at); onClose(); }}
                className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold ${resultColorClass(b.result as BattleResult)}`}>
                      {resultLabel(b.result as BattleResult)}
                    </span>
                    <span className="truncate">
                      {b.my_deck_name ?? "?"} vs {displayDeckName(b.opponent_deck_name, opponentDeckNameMap)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {formatDate(b.fought_at)}
                  </span>
                </div>
              </button>
            );
          })}

          {battles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">対戦履歴がありません</p>
          )}
        </div>

        {/* Reset button at bottom */}
        {currentTimestamp && (
          <div className="p-4 border-t border-border">
            <button
              type="button"
              onClick={() => { onSelect(null); onClose(); }}
              className="w-full rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              計測区間をリセット
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
