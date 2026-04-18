"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  getBattleCountsForPeriod,
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
          <button onClick={() => onUpdate(deck.id)} className="text-[13px] text-[#818cf8] min-h-[44px] px-2">保存</button>
          <button onClick={onCancelEdit} className="text-[13px] text-gray-500 min-h-[44px] px-2">取消</button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[14px]">{deck.name}</span>
          <button onClick={() => onToggleCategory(deck.id, deck.category)} className="text-[12px] px-2 py-1 rounded min-h-[44px] text-gray-500 hover:text-gray-300" disabled={loading}>
            →{categoryCycle[deck.category]}
          </button>
          <button onClick={() => onToggleActive(deck.id, deck.is_active)} className={`text-[12px] px-2 py-1 rounded min-h-[44px] ${deck.is_active ? "text-[#4ade80]" : "text-gray-500"}`} disabled={loading}>
            {deck.is_active ? "有効" : "無効"}
          </button>
          <button onClick={() => onStartEdit(deck.id, deck.name)} className="text-[12px] text-gray-500 hover:text-gray-300 min-h-[44px] px-2" disabled={loading}>編集</button>
          <button onClick={() => onDelete(deck.id)} className="text-[12px] text-[#e85d75] hover:opacity-80 min-h-[44px] px-2" disabled={loading}>削除</button>
        </>
      )}
    </li>
  );
}

// --- Sortable list wrapper for a category ---
function SortableCategoryList({
  categoryDecks, allDecks, setDecks, categoryLabel,
  editingId, editName, setEditName,
  onUpdate, onToggleActive, onToggleCategory, onDelete, onStartEdit, onCancelEdit,
  loading, onReorder,
}: {
  categoryDecks: Deck[]; allDecks: Deck[]; setDecks: (d: Deck[]) => void; categoryLabel: string;
  editingId: string | null; editName: string; setEditName: (v: string) => void;
  onUpdate: (id: string) => void; onToggleActive: (id: string, active: boolean) => void;
  onToggleCategory: (id: string, cat: string) => void; onDelete: (id: string) => void;
  onStartEdit: (id: string, name: string) => void; onCancelEdit: () => void;
  loading: boolean; onReorder?: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categoryDecks.findIndex((d) => d.id === active.id);
    const newIndex = categoryDecks.findIndex((d) => d.id === over.id);
    const reordered = arrayMove(categoryDecks, oldIndex, newIndex);
    const otherDecks = allDecks.filter((d) => d.category !== categoryDecks[0]?.category);
    setDecks([...otherDecks, ...reordered]);
    onReorder?.();
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
                <SortableDeckItem key={deck.id} deck={deck} editingId={editingId} editName={editName} setEditName={setEditName}
                  onUpdate={onUpdate} onToggleActive={onToggleActive} onToggleCategory={onToggleCategory}
                  onDelete={onDelete} onStartEdit={onStartEdit} onCancelEdit={onCancelEdit} loading={loading} />
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
  onDirtyChange,
  onApplyingChange,
  applyRef,
}: {
  initialDecks: Deck[];
  format: string;
  initialSettings: Settings | null;
  onDirtyChange?: (dirty: boolean) => void;
  onApplyingChange?: (applying: boolean) => void;
  applyRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
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

  // Mode 2 specific — string state for free input
  const [majorThresholdStr, setMajorThresholdStr] = useState(String(initialSettings?.major_threshold ?? 3.0));
  const [minorThresholdStr, setMinorThresholdStr] = useState(String(initialSettings?.minor_threshold ?? 1.0));
  const [usagePeriodStr, setUsagePeriodStr] = useState(String(initialSettings?.usage_period_days ?? 14));
  const [disablePeriodStr, setDisablePeriodStr] = useState(String(initialSettings?.disable_period_days ?? 30));
  const [statsDecks, setStatsDecks] = useState<DeckWithStats[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [trialCalcing, setTrialCalcing] = useState(false);
  const [bonusEditing, setBonusEditing] = useState<Record<string, string>>({});
  const [showHelp, setShowHelp] = useState(false);

  // --- Batch apply state ---
  const [dirty, setDirty] = useState(false);
  const [applying, setApplying] = useState(false);
  const addedDeckIdsRef = useRef(new Set<string>());
  const deletedDeckIdsRef = useRef(new Set<string>());

  const savedModeRef = useRef<"admin" | "auto">(
    (initialSettings?.management_mode as "admin" | "auto") ?? "admin"
  );
  const savedDecksRef = useRef(initialDecks);
  const savedSettingsRef = useRef(initialSettings);
  const savedStatsDecksRef = useRef<DeckWithStats[]>([]);

  // Notify parent of dirty/applying changes
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onApplyingChange?.(applying); }, [applying, onApplyingChange]);
  useEffect(() => { if (applyRef) applyRef.current = handleApply; });

  // Sync with initialSettings/initialDecks when format changes
  useEffect(() => {
    const m = (initialSettings?.management_mode as "admin" | "auto") ?? "admin";
    setMode(m);
    setDecks(initialDecks);
    setMajorThresholdStr(String(initialSettings?.major_threshold ?? 3.0));
    setMinorThresholdStr(String(initialSettings?.minor_threshold ?? 1.0));
    setUsagePeriodStr(String(initialSettings?.usage_period_days ?? 14));
    setDisablePeriodStr(String(initialSettings?.disable_period_days ?? 30));
    setStatsLoaded(false);
    setDirty(false);
    addedDeckIdsRef.current.clear();
    deletedDeckIdsRef.current.clear();
    savedModeRef.current = m;
    savedDecksRef.current = initialDecks;
    savedSettingsRef.current = initialSettings;
    savedStatsDecksRef.current = [];
  }, [initialDecks, initialSettings]);

  const loadStats = useCallback(async () => {
    try {
      const result = await getOpponentDeckStatsForAdmin(format);
      const d = result.decks as DeckWithStats[];
      setStatsDecks(d);
      savedStatsDecksRef.current = d;
      setStatsLoaded(true);
    } catch (e) {
      console.error(e);
      alert("操作に失敗しました");
    }
  }, [format]);

  // Load stats when switching to auto mode
  useEffect(() => {
    if (mode === "auto" && !statsLoaded) {
      loadStats();
    }
  }, [mode, statsLoaded, loadStats]);

  // Warn on browser navigation when dirty
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Parse string settings to numbers
  const parseSettings = () => ({
    majorThreshold: parseFloat(majorThresholdStr) || 0,
    minorThreshold: parseFloat(minorThresholdStr) || 0,
    usagePeriod: parseInt(usagePeriodStr) || 1,
    disablePeriod: parseInt(disablePeriodStr) || 1,
  });

  const majorDecks = decks.filter((d) => d.category === "major");
  const minorDecks = decks.filter((d) => d.category === "minor");
  const otherDecks = decks.filter((d) => d.category === "other");

  // --- Handlers (all local) ---

  const handleModeChange = (newMode: "admin" | "auto") => {
    setMode(newMode);
    if (newMode === "auto") setStatsLoaded(false);
    setDirty(true);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const tempId = crypto.randomUUID();
    const maxOrder = decks.length > 0 ? Math.max(...decks.map((d) => d.sort_order)) : 0;
    const newDeck: Deck = { id: tempId, name: newName.trim(), sort_order: maxOrder + 10, is_active: true, category: newCategory };
    setDecks((prev) => [...prev, newDeck]);
    addedDeckIdsRef.current.add(tempId);
    setNewName("");
    setDirty(true);
    if (mode === "auto") {
      setStatsDecks((prev) => [...prev, { ...newDeck, battle_count: 0, usage_rate: 0, admin_bonus_count: 0 }]);
    }
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    setDecks(decks.map((d) => (d.id === id ? { ...d, name: editName.trim() } : d)));
    setStatsDecks(statsDecks.map((d) => (d.id === id ? { ...d, name: editName.trim() } : d)));
    setEditingId(null);
    setDirty(true);
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    setDecks(decks.map((d) => (d.id === id ? { ...d, is_active: !currentActive } : d)));
    setStatsDecks(statsDecks.map((d) => (d.id === id ? { ...d, is_active: !currentActive } : d)));
    setDirty(true);
  };

  const handleToggleCategory = (id: string, currentCategory: string) => {
    const newCat = categoryCycle[currentCategory] ?? "major";
    setDecks(decks.map((d) => (d.id === id ? { ...d, category: newCat } : d)));
    setDirty(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("このデッキを削除しますか？")) return;
    setDecks(decks.filter((d) => d.id !== id));
    setStatsDecks(statsDecks.filter((d) => d.id !== id));
    if (addedDeckIdsRef.current.has(id)) {
      addedDeckIdsRef.current.delete(id);
    } else {
      deletedDeckIdsRef.current.add(id);
    }
    setDirty(true);
  };

  const handleBonusChange = (id: string, value: string) => {
    setBonusEditing({ ...bonusEditing, [id]: value });
  };

  const handleBonusSubmit = (id: string) => {
    const val = bonusEditing[id];
    if (val === undefined) return;
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    setStatsDecks(statsDecks.map((d) => (d.id === id ? { ...d, admin_bonus_count: num } : d)));
    const newEditing = { ...bonusEditing };
    delete newEditing[id];
    setBonusEditing(newEditing);
    setDirty(true);
  };

  // --- Trial calculation (auto mode) ---
  const handleTrialCalc = async () => {
    setTrialCalcing(true);
    try {
      const { majorThreshold, minorThreshold, usagePeriod } = parseSettings();

      // 1. Fetch battle counts for the specified period (read-only, no DB writes)
      const battleCounts = await getBattleCountsForPeriod(format, usagePeriod);

      // 2. Calculate denominator with local bonus counts
      const totalBattles = Object.values(battleCounts).reduce((a, b) => a + b, 0);
      const totalBonus = statsDecks
        .filter((d) => d.is_active && !deletedDeckIdsRef.current.has(d.id))
        .reduce((sum, d) => sum + (d.admin_bonus_count ?? 0), 0);
      const denominator = totalBattles + totalBonus;

      // 3. Recalculate usage_rate and category client-side
      const updated = statsDecks.map((d) => {
        if (!d.is_active || denominator === 0) return d;
        const bc = battleCounts[d.name] ?? 0;
        const rate = ((bc + (d.admin_bonus_count ?? 0)) * 100) / denominator;
        const cat = rate >= majorThreshold ? "major" : rate >= minorThreshold ? "minor" : "other";
        return { ...d, battle_count: bc, usage_rate: rate, category: cat };
      });

      // 4. Sort: major -> minor -> other, within each by rate desc then name asc
      updated.sort((a, b) => {
        if (!a.is_active && b.is_active) return 1;
        if (a.is_active && !b.is_active) return -1;
        const catOrder: Record<string, number> = { major: 0, minor: 1, other: 2 };
        const catDiff = (catOrder[a.category] ?? 2) - (catOrder[b.category] ?? 2);
        if (catDiff !== 0) return catDiff;
        if (b.usage_rate !== a.usage_rate) return b.usage_rate - a.usage_rate;
        return a.name.localeCompare(b.name);
      });

      setStatsDecks(updated);
      // No DB writes. dirty/snapshots unchanged.
    } catch (e) {
      console.error(e);
      alert("試し計算に失敗しました");
    } finally {
      setTrialCalcing(false);
    }
  };

  // --- Apply all changes to DB ---
  const handleApply = async () => {
    setApplying(true);
    try {
      const { majorThreshold, minorThreshold, usagePeriod, disablePeriod } = parseSettings();

      // 1. Save settings
      await updateOpponentDeckSettings(format, {
        management_mode: mode,
        major_threshold: majorThreshold,
        minor_threshold: minorThreshold,
        usage_period_days: usagePeriod,
        disable_period_days: disablePeriod,
      });

      // 2. Delete
      for (const id of deletedDeckIdsRef.current) {
        await deleteOpponentDeck(id);
      }

      // 3. Add
      for (const deck of decks) {
        if (addedDeckIdsRef.current.has(deck.id)) {
          await addOpponentDeck(deck.name, format, deck.category);
        }
      }

      // 4. Update
      const saved = savedDecksRef.current;
      for (const deck of decks) {
        if (addedDeckIdsRef.current.has(deck.id) || deletedDeckIdsRef.current.has(deck.id)) continue;
        const orig = saved.find((d) => d.id === deck.id);
        if (!orig) continue;
        const changes: Record<string, unknown> = {};
        if (deck.name !== orig.name) changes.name = deck.name;
        if (deck.category !== orig.category) changes.category = deck.category;
        if (deck.is_active !== orig.is_active) changes.is_active = deck.is_active;
        if (Object.keys(changes).length > 0) {
          await updateOpponentDeck(deck.id, changes);
        }
      }

      // 5. Reorder (admin mode)
      if (mode === "admin") {
        for (const cat of ["major", "minor", "other"]) {
          const catDecks = decks.filter(
            (d) => d.category === cat && !addedDeckIdsRef.current.has(d.id) && !deletedDeckIdsRef.current.has(d.id)
          );
          if (catDecks.length > 0) {
            await reorderOpponentDecks(catDecks.map((d) => d.id));
          }
        }
      }

      // 6. Bonus counts (auto mode)
      if (mode === "auto") {
        const savedStats = savedStatsDecksRef.current;
        for (const deck of statsDecks) {
          if (addedDeckIdsRef.current.has(deck.id) || deletedDeckIdsRef.current.has(deck.id)) continue;
          const orig = savedStats.find((d) => d.id === deck.id);
          if (orig && (deck.admin_bonus_count ?? 0) !== (orig.admin_bonus_count ?? 0)) {
            await updateAdminBonusCount(deck.id, deck.admin_bonus_count ?? 0);
          }
        }
      }

      // 7. Recalculate (auto mode)
      if (mode === "auto") {
        await recalculateOpponentDecks(format);
      }

      // 8. Reload
      const freshDecks = await getOpponentDeckMasterList(format);
      setDecks(freshDecks);
      savedDecksRef.current = freshDecks;
      savedModeRef.current = mode;
      savedSettingsRef.current = {
        management_mode: mode,
        major_threshold: majorThreshold,
        minor_threshold: minorThreshold,
        usage_period_days: usagePeriod,
        disable_period_days: disablePeriod,
      };

      if (mode === "auto") {
        const result = await getOpponentDeckStatsForAdmin(format);
        const freshStats = result.decks as DeckWithStats[];
        setStatsDecks(freshStats);
        savedStatsDecksRef.current = freshStats;
      }

      addedDeckIdsRef.current.clear();
      deletedDeckIdsRef.current.clear();
      setBonusEditing({});
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert("反映に失敗しました");
    } finally {
      setApplying(false);
    }
  };

  // --- Add form (shared) ---
  const addForm = (
    <div className="bg-[#232640] rounded-[10px] px-4 py-4 space-y-2">
      <div className="flex gap-2">
        {(["major", "minor", "other"] as const).map((cat) => (
          <button key={cat} type="button" onClick={() => setNewCategory(cat)}
            className={`rounded-[6px] px-3 py-2 text-[13px] transition-colors ${
              newCategory === cat ? "bg-[#3d4070] text-white" : "bg-[#232640] text-gray-400 border border-gray-600"
            }`}
          >{cat}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" placeholder="デッキ名を入力" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] placeholder:text-gray-500 focus:outline-none"
        />
        <button onClick={handleAdd} disabled={loading || !newName.trim()}
          className="bg-[#3d4070] text-white rounded-[6px] px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
        >追加</button>
      </div>
    </div>
  );

  const sortableProps = {
    editingId, editName, setEditName,
    onUpdate: handleUpdate,
    onToggleActive: handleToggleActive,
    onToggleCategory: handleToggleCategory,
    onDelete: handleDelete,
    onStartEdit: (id: string, name: string) => { setEditingId(id); setEditName(name); },
    onCancelEdit: () => setEditingId(null),
    loading,
    onReorder: () => setDirty(true),
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="bg-[#232640] rounded-[10px] px-4 py-4">
        <p className="text-[12px] text-gray-500 mb-2">管理モード</p>
        <div className="flex gap-2">
          <button onClick={() => handleModeChange("admin")} disabled={applying}
            className={`flex-1 rounded-[6px] px-3 py-3 text-[13px] transition-colors min-h-[44px] ${
              mode === "admin" ? "bg-[rgba(99,102,241,0.15)] border border-[#6366f1] text-[#818cf8]"
                : "bg-[#1e2138] border border-transparent text-gray-400"
            }`}
          >完全管理者依存</button>
          <button onClick={() => handleModeChange("auto")} disabled={applying}
            className={`flex-1 rounded-[6px] px-3 py-3 text-[13px] transition-colors min-h-[44px] ${
              mode === "auto" ? "bg-[rgba(99,102,241,0.15)] border border-[#6366f1] text-[#818cf8]"
                : "bg-[#1e2138] border border-transparent text-gray-400"
            }`}
          >ユーザー入力依存</button>
        </div>
      </div>

      {/* Help */}
      <button onClick={() => setShowHelp(!showHelp)}
        className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-300 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform ${showHelp ? "rotate-90" : ""}`}
        ><path d="M9 18l6-6-6-6" /></svg>
        {showHelp ? "各モードの説明を閉じる" : "各モードの説明"}
      </button>
      {showHelp && (
        <div className="bg-[#1e2138] rounded-[10px] px-4 py-4 text-[12px] text-gray-400 space-y-3">
          <div>
            <p className="text-gray-300 font-medium mb-1">■ 共通</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>すべての変更は「変更内容反映」ボタンを押すまでDBに反映されません</li>
              <li>「変更内容反映」を押さずにページを離れると、変更は破棄されます</li>
              <li>ユーザー側UIへの反映はDB保存後、次回ページ読み込み時です</li>
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
              <li>「試し計算」で設定値での計算結果をプレビューできます</li>
              <li>対戦記録で未登録デッキが使われた場合、有効状態で自動追加されます</li>
              <li>無効デッキが再使用されると自動的に有効に戻ります</li>
              <li>一定期間未使用のデッキは自動的に無効化されます</li>
            </ul>
          </div>
        </div>
      )}

      {mode === "admin" ? (
        <>
          {addForm}
          <SortableCategoryList categoryDecks={majorDecks} allDecks={decks} setDecks={setDecks} categoryLabel="major" {...sortableProps} />
          <SortableCategoryList categoryDecks={minorDecks} allDecks={decks} setDecks={setDecks} categoryLabel="minor" {...sortableProps} />
          <SortableCategoryList categoryDecks={otherDecks} allDecks={decks} setDecks={setDecks} categoryLabel="other" {...sortableProps} />
        </>
      ) : (
        <>
          {/* Settings */}
          <div className="bg-[#232640] rounded-[10px] px-4 py-4 space-y-3">
            <p className="text-[13px] font-medium text-gray-400">設定</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">major閾値 (%)</label>
                <input type="text" inputMode="decimal" value={majorThresholdStr}
                  onChange={(e) => { setMajorThresholdStr(e.target.value); setDirty(true); }}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">minor閾値 (%)</label>
                <input type="text" inputMode="decimal" value={minorThresholdStr}
                  onChange={(e) => { setMinorThresholdStr(e.target.value); setDirty(true); }}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">算出期間 (日)</label>
                <input type="text" inputMode="numeric" value={usagePeriodStr}
                  onChange={(e) => { setUsagePeriodStr(e.target.value); setDirty(true); }}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[12px] text-gray-500 block mb-1">無効化期間 (日)</label>
                <input type="text" inputMode="numeric" value={disablePeriodStr}
                  onChange={(e) => { setDisablePeriodStr(e.target.value); setDirty(true); }}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={handleTrialCalc}
              disabled={trialCalcing || applying}
              className="w-full bg-[#3d4070] text-white rounded-[6px] px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50 min-h-[44px]"
            >
              {trialCalcing ? "計算中..." : "試し計算"}
            </button>
            <p className="text-[11px] text-gray-500">※現在の設定値・付与数でカテゴリを再計算し結果をプレビューします</p>
          </div>

          {addForm}

          {/* Stats list */}
          <div className="bg-[#232640] rounded-[10px] px-4 py-4">
            <p className="text-[13px] font-medium text-gray-400 mb-3">デッキ一覧</p>
            {!statsLoaded ? (
              <p className="text-center text-gray-500 py-4 text-sm">読み込み中...</p>
            ) : statsDecks.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">デッキなし</p>
            ) : (
              <ul className="space-y-2">
                {statsDecks.map((deck) => (
                  <li key={deck.id} className={`rounded-[8px] bg-[#1e2138] px-4 py-3 ${!deck.is_active ? "opacity-50" : ""}`}>
                    {editingId === deck.id ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdate(deck.id)}
                          className="flex-1 bg-transparent border-b border-[#818cf8] text-[14px] focus:outline-none" autoFocus />
                        <button onClick={() => handleUpdate(deck.id)} className="text-[13px] text-[#818cf8] min-h-[44px] px-2">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-[13px] text-gray-500 min-h-[44px] px-2">取消</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[14px] font-medium">{deck.name}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleToggleActive(deck.id, deck.is_active)}
                              className={`text-[12px] px-2 py-1 rounded min-h-[36px] ${deck.is_active ? "text-[#4ade80]" : "text-gray-500"}`}
                              disabled={applying}>
                              {deck.is_active ? "有効" : "無効"}
                            </button>
                            <button onClick={() => { setEditingId(deck.id); setEditName(deck.name); }}
                              className="text-[12px] text-gray-500 hover:text-gray-300 min-h-[36px] px-1" disabled={applying}>編集</button>
                            <button onClick={() => handleDelete(deck.id)}
                              className="text-[12px] text-[#e85d75] hover:opacity-80 min-h-[36px] px-1" disabled={applying}>削除</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[12px] text-gray-400">
                          <span>対戦: {deck.battle_count}</span>
                          <span className="flex items-center gap-1">
                            付与:
                            <input type="number" value={bonusEditing[deck.id] ?? (deck.admin_bonus_count ?? 0)}
                              onChange={(e) => handleBonusChange(deck.id, e.target.value)}
                              onBlur={() => handleBonusSubmit(deck.id)}
                              onKeyDown={(e) => e.key === "Enter" && handleBonusSubmit(deck.id)}
                              className="w-[60px] bg-[#151729] rounded px-2 py-1 text-[12px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </span>
                          <span>率: {deck.usage_rate.toFixed(1)}%</span>
                          <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                            deck.category === "major" ? "bg-indigo-900/50 text-indigo-300"
                              : deck.category === "minor" ? "bg-gray-700/50 text-gray-300"
                              : "bg-gray-800/50 text-gray-500"
                          }`}>{deck.category}</span>
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
