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

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

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
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  const [newTuningName, setNewTuningName] = useState("");
  const [editingTuningId, setEditingTuningId] = useState<string | null>(null);
  const [editTuningName, setEditTuningName] = useState("");

  const toggleExpanded = (deckId: string) => {
    setExpandedDecks((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) {
        next.delete(deckId);
      } else {
        next.add(deckId);
      }
      return next;
    });
  };

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

  const isExpanded = (deckId: string) => expandedDecks.has(deckId);

  return (
    <div className="space-y-3">
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
            className="flex-1 rounded-lg bg-[#232640] border-[0.5px] border-[#333355] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5b8def]"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !newName.trim()}
            className="rounded-lg bg-[#3d4070] text-white px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            追加
          </button>
        </div>
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-16 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[#333355] bg-[#232640] shadow-lg">
            {filteredSuggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSuggestionSelect(s)}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2d50] transition-colors"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        {deckError && (
          <p className="text-sm text-[#e85d75] mt-1">{deckError}</p>
        )}
      </div>

      {/* Deck list */}
      {decks.length === 0 ? (
        <p className="text-center text-gray-500 py-8 text-sm">
          デッキを追加してください
        </p>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <div key={deck.id} className="rounded-[10px] bg-[#232640] overflow-hidden">
              {/* Card header */}
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer"
                onClick={() => {
                  if (editingId !== deck.id) toggleExpanded(deck.id);
                }}
              >
                {editingId === deck.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) handleUpdate(deck.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-transparent border-b border-[#5b8def] text-sm text-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUpdate(deck.id); }}
                      className="text-sm text-[#5b8def]"
                    >
                      保存
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="text-sm text-gray-400"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Left: deck name + tuning count */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-white truncate">{deck.name}</div>
                      <div className="text-[11px] text-gray-500">チューニング {deck.deck_tunings.length}件</div>
                    </div>
                    {/* Right: edit, delete, arrow */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(deck.id);
                        setEditName(deck.name);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-md"
                      style={{ backgroundColor: "rgba(91,141,239,0.1)", color: "#5b8def" }}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={(e) => {
                        if (!window.confirm(`「${deck.name}」を削除しますか？`)) { e.stopPropagation(); return; }
                        e.stopPropagation();
                        handleArchive(deck.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-md"
                      style={{ backgroundColor: "rgba(232,93,117,0.1)", color: "#e85d75" }}
                    >
                      <XIcon />
                    </button>
                    <span className="text-gray-500 text-sm ml-1 w-4 text-center select-none">
                      {isExpanded(deck.id) ? "▾" : "▸"}
                    </span>
                  </>
                )}
              </div>

              {/* Expanded tuning section */}
              {isExpanded(deck.id) && (
                <div className="bg-[#1e2138] border-t border-[#333355]">
                  {/* Tuning list */}
                  {deck.deck_tunings.map((tuning, idx) => (
                    <div
                      key={tuning.id}
                      className={"flex items-center gap-3 px-4 py-2.5" + (idx < deck.deck_tunings.length - 1 ? " border-b border-[#333355]" : "")}
                    >
                      {editingTuningId === tuning.id ? (
                        <>
                          <div className="w-[3px] self-stretch rounded-sm bg-[#5b8def] flex-shrink-0" />
                          <input
                            type="text"
                            value={editTuningName}
                            onChange={(e) => setEditTuningName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.nativeEvent.isComposing) handleUpdateTuning(deck.id, tuning.id);
                            }}
                            className="flex-1 bg-transparent border-b border-[#5b8def] text-[13px] text-white focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateTuning(deck.id, tuning.id)} className="text-xs text-[#5b8def]">保存</button>
                          <button onClick={() => setEditingTuningId(null)} className="text-xs text-gray-400">取消</button>
                        </>
                      ) : (
                        <>
                          <div className="w-[3px] self-stretch rounded-sm bg-[#5b8def] flex-shrink-0" />
                          <span className="flex-1 text-[13px] text-gray-300">{tuning.name}</span>
                          <button
                            onClick={() => { setEditingTuningId(tuning.id); setEditTuningName(tuning.name); }}
                            className="text-xs text-[#5b8def]"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => { if (!window.confirm(`「${tuning.name}」を削除しますか？`)) return; handleDeleteTuning(deck.id, tuning.id); }}
                            className="text-xs text-[#e85d75]"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add tuning form */}
                  <div className="flex gap-2 px-4 py-3 border-t border-[#333355]">
                    <input
                      type="text"
                      placeholder="チューニング名"
                      value={newTuningName}
                      onChange={(e) => setNewTuningName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) handleCreateTuning(deck.id);
                      }}
                      className="flex-1 rounded-md bg-[#282b48] border-[0.5px] border-[#333355] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#5b8def]"
                    />
                    <button
                      onClick={() => handleCreateTuning(deck.id)}
                      disabled={!newTuningName.trim()}
                      className="rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50"
                      style={{ backgroundColor: "rgba(91,141,239,0.15)", color: "#5b8def" }}
                    >
                      追加
                    </button>
                  </div>
                  {tuningError && isExpanded(deck.id) && (
                    <p className="text-xs text-[#e85d75] px-4 pb-2">{tuningError}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
