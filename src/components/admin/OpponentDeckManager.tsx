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
  category: string;
};

const categoryCycle: Record<string, string> = { major: "minor", minor: "other", other: "major" };

export function OpponentDeckManager({
  initialDecks,
  format,
}: {
  initialDecks: Deck[];
  format: string;
}) {
  const [decks, setDecks] = useState(initialDecks);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"major" | "minor" | "other">("major");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);

  const majorDecks = decks.filter((d) => d.category === "major");
  const minorDecks = decks.filter((d) => d.category === "minor");
  const otherDecks = decks.filter((d) => d.category === "other");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await addOpponentDeck(newName.trim(), format, newCategory);
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

  const handleToggleCategory = async (id: string, currentCategory: string) => {
    const newCat = categoryCycle[currentCategory] ?? "major";
    setLoading(true);
    try {
      await updateOpponentDeck(id, { category: newCat });
      setDecks(
        decks.map((d) =>
          d.id === id ? { ...d, category: newCat } : d
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

  const renderDeckItem = (deck: Deck) => (
    <li
      key={deck.id}
      className={`flex items-center gap-2 rounded-[8px] bg-[#1e2138] px-4 py-3 ${
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
            className="flex-1 bg-transparent border-b border-[#818cf8] text-[14px] focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => handleUpdate(deck.id)}
            className="text-[13px] text-[#818cf8] min-h-[44px] px-2"
          >
            保存
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="text-[13px] text-gray-500 min-h-[44px] px-2"
          >
            取消
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[14px]">{deck.name}</span>
          <button
            onClick={() => handleToggleCategory(deck.id, deck.category)}
            className="text-[12px] px-2 py-1 rounded min-h-[44px] text-gray-500 hover:text-gray-300"
            title={`${categoryCycle[deck.category]}に移動`}
          >
            →{categoryCycle[deck.category]}
          </button>
          <button
            onClick={() => handleToggleActive(deck.id, deck.is_active)}
            className={`text-[12px] px-2 py-1 rounded min-h-[44px] ${
              deck.is_active
                ? "text-[#4ade80]"
                : "text-gray-500"
            }`}
          >
            {deck.is_active ? "有効" : "無効"}
          </button>
          <button
            onClick={() => {
              setEditingId(deck.id);
              setEditName(deck.name);
            }}
            className="text-[12px] text-gray-500 hover:text-gray-300 min-h-[44px] px-2"
          >
            編集
          </button>
          <button
            onClick={() => handleDelete(deck.id)}
            className="text-[12px] text-[#e85d75] hover:opacity-80 min-h-[44px] px-2"
          >
            削除
          </button>
        </>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-[#232640] rounded-[10px] px-4 py-4 space-y-2">
        <div className="flex gap-2">
          {(["major", "minor", "other"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setNewCategory(cat)}
              className={`rounded-[6px] px-3 py-2 text-[13px] transition-colors ${
                newCategory === cat
                  ? "bg-[#3d4070] text-white"
                  : "bg-[#232640] text-gray-400 border border-gray-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="デッキ名を入力"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] placeholder:text-gray-500 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            className="bg-[#3d4070] text-white rounded-[6px] px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>

      {/* Major decks */}
      <div className="bg-[#232640] rounded-[10px] px-4 py-4">
        <h3 className="text-[13px] font-medium text-gray-400 mb-2">major</h3>
        {majorDecks.length === 0 ? (
          <p className="text-center text-gray-500 py-4 text-sm">
            majorデッキなし
          </p>
        ) : (
          <ul className="space-y-2">{majorDecks.map(renderDeckItem)}</ul>
        )}
      </div>

      {/* Minor decks */}
      <div className="bg-[#232640] rounded-[10px] px-4 py-4">
        <h3 className="text-[13px] font-medium text-gray-400 mb-2">minor</h3>
        {minorDecks.length === 0 ? (
          <p className="text-center text-gray-500 py-4 text-sm">
            minorデッキなし
          </p>
        ) : (
          <ul className="space-y-2">{minorDecks.map(renderDeckItem)}</ul>
        )}
      </div>

      {/* Other decks */}
      <div className="bg-[#232640] rounded-[10px] px-4 py-4">
        <h3 className="text-[13px] font-medium text-gray-400 mb-2">other</h3>
        {otherDecks.length === 0 ? (
          <p className="text-center text-gray-500 py-4 text-sm">
            otherデッキなし
          </p>
        ) : (
          <ul className="space-y-2">{otherDecks.map(renderDeckItem)}</ul>
        )}
      </div>
    </div>
  );
}
