"use client";

import { useState } from "react";

type Props = {
  majorSuggestions: string[];
  otherSuggestions: string[];
  value: string;
  onChange: (name: string) => void;
};

export function OpponentDeckSelector({
  majorSuggestions,
  otherSuggestions,
  value,
  onChange,
}: Props) {
  const [mode, setMode] = useState<"major" | "other">("major");
  const [searchText, setSearchText] = useState("");

  if (mode === "other") {
    const filtered = searchText
      ? otherSuggestions.filter((name) =>
          name.toLowerCase().includes(searchText.toLowerCase())
        )
      : otherSuggestions;

    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">対面デッキ</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("major");
              setSearchText("");
              onChange("");
            }}
            className="text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-2"
          >
            ← 戻る
          </button>
        </div>
        <input
          type="text"
          placeholder="対面デッキ名を入力"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            onChange(e.target.value);
          }}
          className="w-full rounded-lg bg-card border border-border px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setSearchText(name);
                }}
                className={`rounded-lg border px-3 py-3 text-sm text-left transition-colors min-h-[44px] ${
                  value === name
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">対面デッキ</p>
      <div className="grid grid-cols-2 gap-2">
        {majorSuggestions.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={`rounded-lg border px-3 py-3 text-sm text-left transition-colors min-h-[44px] ${
              value === name
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("other")}
          className={`rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors min-h-[44px] ${
            value && !majorSuggestions.includes(value)
              ? "border-primary bg-primary/10 text-primary"
              : ""
          }`}
        >
          その他...
        </button>
      </div>
    </div>
  );
}
