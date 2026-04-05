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
        <p className="text-[12px] text-gray-500 mb-2">対面デッキ</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("major");
              setSearchText("");
              onChange("");
            }}
            className="text-[13px] text-gray-400 hover:text-white min-h-[44px] px-3 py-1 rounded-[6px] transition-colors"
            style={{ backgroundColor: "#1a1d2e", border: "0.5px solid #333355" }}
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
          className="w-full rounded-[6px] px-4 py-3 text-[14px] placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ backgroundColor: "#1a1d2e", border: "0.5px solid #333355" }}
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
                className="rounded-[10px] px-3 py-3 text-[13px] text-left transition-colors min-h-[44px]"
                style={
                  value === name
                    ? { backgroundColor: "rgba(99,102,241,0.1)", border: "1px solid #6366f1" }
                    : { backgroundColor: "#232640", border: "0.5px solid rgba(100,100,150,0.2)" }
                }
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
      <p className="text-[12px] text-gray-500 mb-2">対面デッキ</p>
      <div className="grid grid-cols-2 gap-2">
        {majorSuggestions.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className="rounded-[10px] px-3 py-3 text-[13px] text-left transition-colors min-h-[44px]"
            style={
              value === name
                ? { backgroundColor: "rgba(99,102,241,0.1)", border: "1px solid #6366f1" }
                : { backgroundColor: "#232640", border: "0.5px solid rgba(100,100,150,0.2)" }
            }
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("other")}
          className="rounded-[10px] px-3 py-3 text-[13px] text-gray-400 hover:text-white transition-colors min-h-[44px]"
          style={
            value && !majorSuggestions.includes(value)
              ? { backgroundColor: "rgba(99,102,241,0.1)", border: "1px solid #6366f1" }
              : { backgroundColor: "#232640", border: "1px dashed rgba(100,100,150,0.4)" }
          }
        >
          その他...
        </button>
      </div>
    </div>
  );
}
