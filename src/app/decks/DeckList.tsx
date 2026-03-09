"use client";

import { useState } from "react";
import {
  createDeck,
  updateDeck,
  archiveDeck,
  getDecks,
} from "@/lib/actions/deck-actions";

type Deck = {
  id: string;
  name: string;
  sort_order: number;
};

export function DeckList({ initialDecks, format }: { initialDecks: Deck[]; format: string }) {
  const [decks, setDecks] = useState(initialDecks);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const newDeck = await createDeck(newName.trim(), format);
      setNewName("");
      if (newDeck) {
        setDecks((prev) => [...prev, newDeck]);
      } else {
        const updated = await getDecks(format);
        setDecks(updated);
      }
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
      await updateDeck(id, editName.trim());
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

  const handleArchive = async (id: string) => {
    setLoading(true);
    try {
      await archiveDeck(id);
      setDecks(decks.filter((d) => d.id !== id));
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add new deck */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="デッキ名を入力"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) handleCreate();
          }}
          className="flex-1 rounded-lg bg-card border border-border px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleCreate}
          disabled={loading || !newName.trim()}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          追加
        </button>
      </div>

      {/* Deck list */}
      {decks.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          デッキを追加してください
        </p>
      ) : (
        <ul className="space-y-2">
          {decks.map((deck) => (
            <li
              key={deck.id}
              className="flex items-center gap-2 rounded-lg bg-card border border-border px-4 py-3"
            >
              {editingId === deck.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) handleUpdate(deck.id);
                    }}
                    className="flex-1 bg-transparent border-b border-primary text-sm focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdate(deck.id)}
                    className="text-sm text-primary"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-muted-foreground"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{deck.name}</span>
                  <button
                    onClick={() => {
                      setEditingId(deck.id);
                      setEditName(deck.name);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleArchive(deck.id)}
                    className="text-sm text-destructive hover:opacity-80 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
