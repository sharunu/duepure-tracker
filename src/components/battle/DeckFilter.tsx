"use client";

type Props = {
  deckNames: string[];
  selectedDeck: string | null;
  onSelect: (deckName: string | null) => void;
};

export function DeckFilter({ deckNames, selectedDeck, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          selectedDeck === null
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-muted"
        }`}
      >
        すべて
      </button>
      {deckNames.map((name) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedDeck === name
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
