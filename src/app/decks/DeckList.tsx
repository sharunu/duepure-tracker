"use client";

import { useState, useRef } from "react";
import {
  createDeck,
  updateDeck,
  archiveDeck,
  getDecks,
  createTuning,
  updateTuning,
  deleteTuning,
} from "@/lib/actions/deck-actions";

type Tuning = {
  id: string;
  name: string;
  sort_order: number;
};

type Deck = {
  id: string;
  name: string;
  sort_order: number;
  deck_tunings: Tuning[];
};

export function DeckList({
  initialDecks,
  format,
  suggestions = [],
}: {
  initialDecks: Deck[];
  format: string;
  suggestions?: string[];
}) {
  const [decks, setDecks] = useState(initialDecks);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deckError, setDeckError] = useState<string | null>(null);
  const [tuningError, setTuningError] = useState<string | null>(null);

  // Tuning state
  const [expandedTuningDeck, setExpandedTuningDeck] = useState<string | null>(null);
  const [newTuningName, setNewTuningName] = useState("");
  const [editingTuningId, setEditingTuningId] = useState<string | null>(null);
  const [editTuningName, setEditTuningName] = useState("");

  const filteredSuggestions =
    newName.length >= 1
      ? suggestions.filter((s) =>
          s.toLowerCase().includes(newName.toLowerCase())
        )
      : [];

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setShowSuggestions(false);
    setDeckError(null);
    try {
      const newDeck = await createDeck(newName.trim(), format);
      setNewName("");
      if (newDeck) {
        setDecks((prev) => [...prev, { ...newDeck, deck_tunings: newDeck.deck_tunings ?? [] }]);
      } else {
        const updated = await getDecks(format);
        setDecks(updated);
      }
    } catch (e) {
      setDeckError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    setDeckError(null);
    try {
      await updateDeck(id, editName.trim());
      setDecks(
        decks.map((d) => (d.id === id ? { ...d, name: editName.trim() } : d))
      );
      setEditingId(null);
    } catch (e) {
      setDeckError(e instanceof Error ? e.message : "エラーが発生しました");
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

  const handleSuggestionSelect = (name: string) => {
    setNewName(name);
    setShowSuggestions(false);
  };

  const handleInputBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  const handleInputFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (newName.length >= 1 && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Tuning handlers
  const handleCreateTuning = async (deckId: string) => {
    if (!newTuningName.trim()) return;
    setTuningError(null);
    try {
      const tuning = await createTuning(deckId, newTuningName.trim());
      setDecks(decks.map(d => d.id === deckId ? {
        ...d,
        deck_tunings: [...d.deck_tunings, tuning],
      } : d));
      setNewTuningName("");
    } catch (e) {
      setTuningError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleUpdateTuning = async (deckId: string, tuningId: string) => {
    if (!editTuningName.trim()) return;
    setTuningError(null);
    try {
      await updateTuning(tuningId, editTuningName.trim());
      setDecks(decks.map(d => d.id === deckId ? {
        ...d,
        deck_tunings: d.deck_tunings.map(t => t.id === tuningId ? { ...t, name: editTuningName.trim() } : t),
      } : d));
      setEditingTuningId(null);
    } catch (e) {
      setTuningError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleDeleteTuning = async (deckId: string, tuningId: string) => {
    try {
      await deleteTuning(tuningId);
      setDecks(decks.map(d => d.id === deckId ? {
        ...d,
        deck_tunings: d.deck_tunings.filter(t => t.id !== tuningId),
      } : d));
    } catch {
      // handle error
    }
  };

  return (
    <div className="space-y-4">
      {/* Add new deck */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="デッキ名を入力"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setShowSuggestions(e.target.value.length >= 1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) handleCreate();
            }}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
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
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-16 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {filteredSuggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSuggestionSelect(s)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        {deckError && (
          <p className="text-sm text-destructive mt-1">{deckError}</p>
        )}
      </div>

      {/* Deck list */}
      {decks.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          デッキを追加してください
        </p>
      ) : (
        <ul className="space-y-2">
          {decks.map((deck) => (
            <li key={deck.id}>
              <div className="flex items-center gap-2 rounded-lg bg-card border border-border px-4 py-3">
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
                      onClick={() => setExpandedTuningDeck(expandedTuningDeck === deck.id ? null : deck.id)}
                      className={"text-xs px-2 py-1 rounded border transition-colors min-h-[44px] flex items-center " + (expandedTuningDeck === deck.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
                    >
                      チューニング{deck.deck_tunings.length > 0 ? ` (${deck.deck_tunings.length})` : ""}
                    </button>
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
              </div>

              {/* Tuning section */}
              {expandedTuningDeck === deck.id && (
                <div className="ml-4 border-l-2 border-border pl-3 mt-1 space-y-1">
                  {deck.deck_tunings.map((tuning) => (
                    <div key={tuning.id} className="flex items-center gap-2 py-1.5 text-sm">
                      {editingTuningId === tuning.id ? (
                        <>
                          <input
                            type="text"
                            value={editTuningName}
                            onChange={(e) => setEditTuningName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.nativeEvent.isComposing) handleUpdateTuning(deck.id, tuning.id);
                            }}
                            className="flex-1 bg-transparent border-b border-primary text-sm focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateTuning(deck.id, tuning.id)} className="text-xs text-primary">保存</button>
                          <button onClick={() => setEditingTuningId(null)} className="text-xs text-muted-foreground">取消</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-muted-foreground">{tuning.name}</span>
                          <button
                            onClick={() => { setEditingTuningId(tuning.id); setEditTuningName(tuning.name); }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteTuning(deck.id, tuning.id)}
                            className="text-xs text-destructive hover:opacity-80"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {/* Add tuning */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="チューニング名"
                      value={newTuningName}
                      onChange={(e) => setNewTuningName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) handleCreateTuning(deck.id);
                      }}
                      className="flex-1 rounded bg-card border border-border px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleCreateTuning(deck.id)}
                      disabled={!newTuningName.trim()}
                      className="rounded bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      追加
                    </button>
                  </div>
                  {tuningError && expandedTuningDeck === deck.id && (
                    <p className="text-xs text-destructive mt-1">{tuningError}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
