"use client";

import { useState } from "react";
import {
  addOpponentDeck,
  updateOpponentDeck,
  deleteOpponentDeck,
} from "@/lib/actions/admin-actions";

type Deck = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export function OpponentDeckManager({
  initialDecks,
}: {
  initialDecks: Deck[];
}) {
  const [decks, setDecks] = useState(initialDecks);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await addOpponentDeck(newName.trim());
      setNewName("");
      window.location.reload();
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      await updateOpponentDeck(id, { name: editName.trim() });
      setDecks(
        decks.map((d) => (d.id === id ? { ...d, name: editName.trim() } : d))
      );
      setEditingId(null);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setLoading(true);
    try {
      await updateOpponentDeck(id, { is_active: !currentActive });
      setDecks(
        decks.map((d) =>
          d.id === id ? { ...d, is_active: !currentActive } : d
        )
      );
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このデッキを削除しますか？")) return;
    setLoading(true);
    try {
      await deleteOpponentDeck(id);
      setDecks(decks.filter((d) => d.id !== id));
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="デッキ名を入力"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 rounded-lg bg-card border border-border px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !newName.trim()}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          追加
        </button>
      </div>

      {/* Deck list */}
      {decks.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          対面デッキを追加してください
        </p>
      ) : (
        <ul className="space-y-2">
          {decks.map((deck) => (
            <li
              key={deck.id}
              className={`flex items-center gap-2 rounded-lg bg-card border border-border px-4 py-3 ${
                !deck.is_active ? "opacity-50" : ""
              }`}
            >
              {editingId === deck.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUpdate(deck.id)
                    }
                    className="flex-1 bg-transparent border-b border-primary text-sm focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdate(deck.id)}
                    className="text-sm text-primary min-h-[44px] px-2"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-muted-foreground min-h-[44px] px-2"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{deck.name}</span>
                  <button
                    onClick={() => handleToggleActive(deck.id, deck.is_active)}
                    className={`text-xs px-2 py-1 rounded min-h-[44px] ${
                      deck.is_active
                        ? "text-success"
                        : "text-muted-foreground"
                    }`}
                  >
                    {deck.is_active ? "有効" : "無効"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(deck.id);
                      setEditName(deck.name);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-2"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(deck.id)}
                    className="text-sm text-destructive hover:opacity-80 min-h-[44px] px-2"
                  >
                    削除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
