"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addOpponentDeck,
  updateOpponentDeck,
  deleteOpponentDeck,
  updateOpponentDeckSettings,
  recalculateOpponentDecks,
  reorderOpponentDecks,
  updateAdminBonusCount,
  getOpponentDeckStatsForAdmin,
  getOpponentDeckMasterList,
} from "@/lib/actions/admin-actions";

type Deck = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  category: string;
  admin_bonus_count?: number;
};

type DeckWithStats = Deck & {
  battle_count: number;
  usage_rate: number;
};

type Settings = {
  management_mode: string;
  major_threshold: number;
  minor_threshold: number;
  usage_period_days: number;
  disable_period_days: number;
};

const categoryCycle: Record<string, string> = { major: "minor", minor: "other", other: "major" };

// --- Sortable deck item for Mode 1 ---
function SortableDeckItem({
  deck,
  editingId,
  editName,
  setEditName,
  onUpdate,
  onToggleActive,
  onToggleCategory,
  onDelete,
  onStartEdit,
  onCancelEdit,
  loading,
}: {
  deck: Deck;
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  onUpdate: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleCategory: (id: string, cat: string) => void;
  onDelete: (id: string) => void;
  onStartEdit: (id: string, name: string) => void;
  onCancelEdit: () => void;
  loading: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: deck.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-[8px] bg-[#1e2138] px-4 py-3 ${
        !deck.is_active ? "opacity-50" : ""
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 touch-none"
        tabIndex={-1}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>

      {editingId === deck.id ? (
        <>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onUpdate(deck.id)}
            className="flex-1 bg-transparent border-b border-[#818cf8] text-[14px] focus:outline-none"
            autoFocus
          />
          <button onClick={() => onUpdate(deck.id)} className="text-[13px] text-[#818cf8] min-h-[44px] px-2">
            保存
          </button>
          <button onClick={onCancelEdit} className="text-[13px] text-gray-500 min-h-[44px] px-2">
            取消
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[14px]">{deck.name}</span>
          <button
            onClick={() => onToggleCategory(deck.id, deck.category)}
            className="text-[12px] px-2 py-1 rounded min-h-[44px] text-gray-500 hover:text-gray-300"
            disabled={loading}
          >
            →{categoryCycle[deck.category]}
          </button>
          <button
            onClick={() => onToggleActive(deck.id, deck.is_active)}
            className={`text-[12px] px-2 py-1 rounded min-h-[44px] ${
              deck.is_active ? "text-[#4ade80]" : "text-gray-500"
            }`}
            disabled={loading}
          >
            {deck.is_active ? "有効" : "無効"}
          </button>
          <button
            onClick={() => onStartEdit(deck.id, deck.name)}
            className="text-[12px] text-gray-500 hover:text-gray-300 min-h-[44px] px-2"
            disabled={loading}
          >
            編集
          </button>
          <button
            onClick={() => onDelete(deck.id)}
            className="text-[12px] text-[#e85d75] hover:opacity-80 min-h-[44px] px-2"
            disabled={loading}
          >
            削除
          </button>
        </>
      )}
    </li>
  );
}

// --- Sortable list wrapper for a category ---
function SortableCategoryList({
  categoryDecks,
  allDecks,
  setDecks,
  categoryLabel,
  editingId,
  editName,
  setEditName,
  onUpdate,
  onToggleActive,
  onToggleCategory,
  onDelete,
  onStartEdit,
  onCancelEdit,
  loading,
}: {
  categoryDecks: Deck[];
  allDecks: Deck[];
  setDecks: (d: Deck[]) => void;
  categoryLabel: string;
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  onUpdate: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleCategory: (id: string, cat: string) => void;
  onDelete: (id: string) => void;
  onStartEdit: (id: string, name: string) => void;
  onCancelEdit: () => void;
  loading: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categoryDecks.findIndex((d) => d.id === active.id);
    const newIndex = categoryDecks.findIndex((d) => d.id === over.id);
    const reordered = arrayMove(categoryDecks, oldIndex, newIndex);

    // Update local state
    const otherDecks = allDecks.filter((d) => d.category !== categoryDecks[0]?.category);
    setDecks([...otherDecks, ...reordered]);

    // Persist
    await reorderOpponentDecks(reordered.map((d) => d.id));
  };

  return (
    <div className="bg-[#232640] rounded-[10px] px-4 py-4">
      <h3 className="text-[13px] font-medium text-gray-400 mb-2">{categoryLabel}</h3>
      {categoryDecks.length === 0 ? (
        <p className="text-center text-gray-500 py-4 text-sm">{categoryLabel}デッキなし</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categoryDecks.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {categoryDecks.map((deck) => (
                <SortableDeckItem
                  key={deck.id}
                  deck={deck}
                  editingId={editingId}
                  editName={editName}
                  setEditName={setEditName}
                  onUpdate={onUpdate}
                  onToggleActive={onToggleActive}
                  onToggleCategory={onToggleCategory}
                  onDelete={onDelete}
                  onStartEdit={onStartEdit}
                  onCancelEdit={onCancelEdit}
                  loading={loading}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// --- Main component ---
export function OpponentDeckManager({
  initialDecks,
  format,
  initialSettings,
}: {
  initialDecks: Deck[];
  format: string;
  initialSettings: Settings | null;
}) {
  const [mode, setMode] = useState<"admin" | "auto">(
    (initialSettings?.management_mode as "admin" | "auto") ?? "admin"
  );
  const [decks, setDecks] = useState(initialDecks);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"major" | "minor" | "other">("major");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);

  // Mode 2 specific state
  const [majorThreshold, setMajorThreshold] = useState(initialSettings?.major_threshold ?? 3.0);
  const [minorThreshold, setMinorThreshold] = useState(initialSettings?.minor_threshold ?? 1.0);
  const [usagePeriod, setUsagePeriod] = useState(initialSettings?.usage_period_days ?? 14);
  const [disablePeriod, setDisablePeriod] = useState(initialSettings?.disable_period_days ?? 30);
  const [statsDecks, setStatsDecks] = useState<DeckWithStats[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [bonusEditing, setBonusEditing] = useState<Record<string, string>>({});
  const [showHelp, setShowHelp] = useState(false);

  // Sync with initialSettings/initialDecks when format changes
  useEffect(() => {
    setMode((initialSettings?.management_mode as "admin" | "auto") ?? "admin");
    setDecks(initialDecks);
    setMajorThreshold(initialSettings?.major_threshold ?? 3.0);
    setMinorThreshold(initialSettings?.minor_threshold ?? 1.0);
    setUsagePeriod(initialSettings?.usage_period_days ?? 14);
    setDisablePeriod(initialSettings?.disable_period_days ?? 30);
    setStatsLoaded(false);
  }, [initialDecks, initialSettings]);

  // Load stats when switching to auto mode
  useEffect(() => {
    if (mode === "auto" && !statsLoaded) {
      loadStats();
    }
  }, [mode, statsLoaded]);

  const loadStats = async () => {
    try {
      const result = await getOpponentDeckStatsForAdmin(format);
      setStatsDecks(result.decks as DeckWithStats[]);
      setStatsLoaded(true);
    } catch {
      // handle error
    }
  };

  const reloadAdminDecks = async () => {
    const d = await getOpponentDeckMasterList(format);
    setDecks(d);
  };

  const majorDecks = decks.filter((d) => d.category === "major");
  const minorDecks = decks.filter((d) => d.category === "minor");
  const otherDecks = decks.filter((d) => d.category === "other");

  // --- Handlers ---

  const handleModeChange = async (newMode: "admin" | "auto") => {
    setLoading(true);
    try {
      await updateOpponentDeckSettings(format, { management_mode: newMode });
      setMode(newMode);
      if (newMode === "auto") {
        setStatsLoaded(false);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await addOpponentDeck(newName.trim(), format, newCategory);
      setNewName("");
      if (mode === "admin") {
        await reloadAdminDecks();
      } else {
        setStatsLoaded(false);
        await loadStats();
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
      await updateOpponentDeck(id, { name: editName.trim() });
      setDecks(decks.map((d) => (d.id === id ? { ...d, name: editName.trim() } : d)));
      setStatsDecks(statsDecks.map((d) => (d.id === id ? { ...d, name: editName.trim() } : d)));
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
      setDecks(decks.map((d) => (d.id === id ? { ...d, is_active: !currentActive } : d)));
      setStatsDecks(statsDecks.map((d) => (d.id === id ? { ...d, is_active: !currentActive } : d)));
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
      setDecks(decks.map((d) => (d.id === id ? { ...d, category: newCat } : d)));
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
      setStatsDecks(statsDecks.filter((d) => d.id !== id));
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateOpponentDeckSettings(format, {
        major_threshold: majorThreshold,
        minor_threshold: minorThreshold,
        usage_period_days: usagePeriod,
        disable_period_days: disablePeriod,
      });
    } catch {
      // handle error
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await recalculateOpponentDecks(format);
      await loadStats();
      await reloadAdminDecks();
    } catch {
      // handle error
    } finally {
      setRecalculating(false);
    }
  };

  const handleBonusChange = (id: string, value: string) => {
    setBonusEditing({ ...bonusEditing, [id]: value });
  };

  const handleBonusSubmit = async (id: string) => {
    const val = bonusEditing[id];
    if (val === undefined) return;
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    setLoading(true);
    try {
      await updateAdminBonusCount(id, num);
      setStatsDecks(statsDecks.map((d) => (d.id === id ? { ...d, admin_bonus_count: num } : d)));
      const newEditing = { ...bonusEditing };
      delete newEditing[id];
      setBonusEditing(newEditing);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  // --- Add form (shared) ---
  const addForm = (
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
  );

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="bg-[#232640] rounded-[10px] px-4 py-4">
        <p className="text-[12px] text-gray-500 mb-2">管理モード</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange("admin")}
            disabled={loading}
            className={`flex-1 rounded-[6px] px-3 py-3 text-[13px] transition-colors min-h-[44px] ${
              mode === "admin"
                ? "bg-[rgba(99,102,241,0.15)] border border-[#6366f1] text-[#818cf8]"
                : "bg-[#1e2138] border border-transparent text-gray-400"
            }`}
          >
            完全管理者依存
          </button>
          <button
            onClick={() => handleModeChange("auto")}
            disabled={loading}
            className={`flex-1 rounded-[6px] px-3 py-3 text-[13px] transition-colors min-h-[44px] ${
              mode === "auto"
                ? "bg-[rgba(99,102,241,0.15)] border border-[#6366f1] text-[#818cf8]"
                : "bg-[#1e2138] border border-transparent text-gray-400"
            }`}
          >
            ユーザー入力依存
          </button>
        </div>
      </div>

      {/* Help toggle */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-300 transition-colors"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${showHelp ? "rotate-90" : ""}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {showHelp ? "各モードの説明を閉じる" : "各モードの説明"}
      </button>
      {showHelp && (
        <div className="bg-[#1e2138] rounded-[10px] px-4 py-4 text-[12px] text-gray-400 space-y-3">
          <div>
            <p className="text-gray-300 font-medium mb-1">■ 共通</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>デッキの追加/削除/名前編集/有効・無効切替は即座にDBに反映されます</li>
              <li>ユーザー側UIへの反映は次回ページ読み込み時です</li>
            </ul>
          </div>
          <div>
            <p className="text-gray-300 font-medium mb-1">■ 完全管理者依存</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>カテゴリ(major/minor/other)と並び順は手動で管理します</li>
              <li>対戦記録で未登録デッキが使われた場合、無効状態で自動追加されます</li>
            </ul>
          </div>
          <div>
            <p className="text-gray-300 font-medium mb-1">■ ユーザー入力依存</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>カテゴリと並び順は使用率に基づいて自動計算されます</li>
              <li>反映タイミング: 毎日4:00 or 即時再計算ボタン</li>
              <li>対戦記録で未登録デッキが使われた場合、有効状態で自動追加されます</li>
              <li>無効デッキが再使用されると自動的に有効に戻ります</li>
              <li>一定期間未使用のデッキは自動的に無効化されます</li>
            </ul>
          </div>
          <p className="text-gray-500 text-[11px]">※モード切替はDBに即時保存されますが、ユーザー側UIには直接影響しません。autoモードの場合はバッチ実行 or 即時再計算後に反映されます。</p>
        </div>
      )}

      {mode === "admin" ? (
        <>
          {/* Mode 1: Admin-managed */}
          {addForm}

          <SortableCategoryList
            categoryDecks={majorDecks}
            allDecks={decks}
            setDecks={setDecks}
            categoryLabel="major"
            editingId={editingId}
            editName={editName}
            setEditName={setEditName}
            onUpdate={handleUpdate}
            onToggleActive={handleToggleActive}
            onToggleCategory={handleToggleCategory}
            onDelete={handleDelete}
            onStartEdit={(id, name) => { setEditingId(id); setEditName(name); }}
            onCancelEdit={() => setEditingId(null)}
            loading={loading}
          />
          <SortableCategoryList
            categoryDecks={minorDecks}
            allDecks={decks}
            setDecks={setDecks}
            categoryLabel="minor"
            editingId={editingId}
            editName={editName}
            setEditName={setEditName}
            onUpdate={handleUpdate}
            onToggleActive={handleToggleActive}
            onToggleCategory={handleToggleCategory}
            onDelete={handleDelete}
            onStartEdit={(id, name) => { setEditingId(id); setEditName(name); }}
            onCancelEdit={() => setEditingId(null)}
            loading={loading}
          />
          <SortableCategoryList
            categoryDecks={otherDecks}
            allDecks={decks}
            setDecks={setDecks}
            categoryLabel="other"
            editingId={editingId}
            editName={editName}
            setEditName={setEditName}
            onUpdate={handleUpdate}
            onToggleActive={handleToggleActive}
            onToggleCategory={handleToggleCategory}
            onDelete={handleDelete}
            onStartEdit={(id, name) => { setEditingId(id); setEditName(name); }}
            onCancelEdit={() => setEditingId(null)}
            loading={loading}
          />
        </>
      ) : (
        <>
          {/* Mode 2: Auto-managed */}

          {/* Settings form */}
          <div className="bg-[#232640] rounded-[10px] px-4 py-4 space-y-3">
            <p className="text-[13px] font-medium text-gray-400">設定</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">major閾値 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={majorThreshold}
                  onChange={(e) => setMajorThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">minor閾値 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={minorThreshold}
                  onChange={(e) => setMinorThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">算出期間 (日)</label>
                <input
                  type="number"
                  min="1"
                  value={usagePeriod}
                  onChange={(e) => setUsagePeriod(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">無効化期間 (日)</label>
                <input
                  type="number"
                  min="1"
                  value={disablePeriod}
                  onChange={(e) => setDisablePeriod(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 bg-[#3d4070] text-white rounded-[6px] px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50 min-h-[44px]"
              >
                {savingSettings ? "保存中..." : "設定保存"}
              </button>
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="flex-1 bg-indigo-600 text-white rounded-[6px] px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50 min-h-[44px]"
              >
                {recalculating ? "計算中..." : "即時再計算"}
              </button>
            </div>
          </div>

          {/* Add form */}
          {addForm}

          {/* Deck stats list */}
          <div className="bg-[#232640] rounded-[10px] px-4 py-4">
            <p className="text-[13px] font-medium text-gray-400 mb-3">デッキ一覧</p>
            {!statsLoaded ? (
              <p className="text-center text-gray-500 py-4 text-sm">読み込み中...</p>
            ) : statsDecks.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">デッキなし</p>
            ) : (
              <ul className="space-y-2">
                {statsDecks.map((deck) => (
                  <li
                    key={deck.id}
                    className={`rounded-[8px] bg-[#1e2138] px-4 py-3 ${
                      !deck.is_active ? "opacity-50" : ""
                    }`}
                  >
                    {editingId === deck.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdate(deck.id)}
                          className="flex-1 bg-transparent border-b border-[#818cf8] text-[14px] focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleUpdate(deck.id)} className="text-[13px] text-[#818cf8] min-h-[44px] px-2">
                          保存
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-[13px] text-gray-500 min-h-[44px] px-2">
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[14px] font-medium">{deck.name}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(deck.id, deck.is_active)}
                              className={`text-[12px] px-2 py-1 rounded min-h-[36px] ${
                                deck.is_active ? "text-[#4ade80]" : "text-gray-500"
                              }`}
                              disabled={loading}
                            >
                              {deck.is_active ? "有効" : "無効"}
                            </button>
                            <button
                              onClick={() => { setEditingId(deck.id); setEditName(deck.name); }}
                              className="text-[12px] text-gray-500 hover:text-gray-300 min-h-[36px] px-1"
                              disabled={loading}
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(deck.id)}
                              className="text-[12px] text-[#e85d75] hover:opacity-80 min-h-[36px] px-1"
                              disabled={loading}
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[12px] text-gray-400">
                          <span>対戦: {deck.battle_count}</span>
                          <span className="flex items-center gap-1">
                            付与:
                            <input
                              type="number"
                              value={bonusEditing[deck.id] ?? (deck.admin_bonus_count ?? 0)}
                              onChange={(e) => handleBonusChange(deck.id, e.target.value)}
                              onBlur={() => handleBonusSubmit(deck.id)}
                              onKeyDown={(e) => e.key === "Enter" && handleBonusSubmit(deck.id)}
                              className="w-[60px] bg-[#151729] rounded px-2 py-1 text-[12px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </span>
                          <span>率: {deck.usage_rate.toFixed(1)}%</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] ${
                              deck.category === "major"
                                ? "bg-indigo-900/50 text-indigo-300"
                                : deck.category === "minor"
                                ? "bg-gray-700/50 text-gray-300"
                                : "bg-gray-800/50 text-gray-500"
                            }`}
                          >
                            {deck.category}
                          </span>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
