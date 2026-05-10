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
            ? "bg-primary/15 text-primary font-medium border-transparent"
            : "bg-surface-2 text-muted-foreground border-transparent"
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
              ? "bg-primary/15 text-primary font-medium border-transparent"
              : "bg-surface-2 text-muted-foreground border-transparent"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
