"use client";

type Props = {
  deckNames: string[];
  selectedDeck: string | null;
  onSelect: (deckName: string | null) => void;
};

export function DeckFilter({ deckNames, selectedDeck, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-[20px] border px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedDeck === null
            ? "bg-[rgba(91,141,239,0.15)] text-[#5b8def] font-medium border-transparent"
            : "bg-[#232640] text-[#8888aa] border-transparent"
        }`}
      >
        すべて
      </button>
      {deckNames.map((name) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          className={`rounded-[20px] border px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedDeck === name
              ? "bg-[rgba(91,141,239,0.15)] text-[#5b8def] font-medium border-transparent"
              : "bg-[#232640] text-[#8888aa] border-transparent"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
