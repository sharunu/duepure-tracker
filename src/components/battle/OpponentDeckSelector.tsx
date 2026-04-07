"use client";

import { useState, useEffect } from "react";

type Props = {
  majorSuggestions: string[];
  otherSuggestions: string[];
  value: string;
  onChange: (name: string) => void;
};

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666688" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export function OpponentDeckSelector({
  majorSuggestions,
  otherSuggestions,
  value,
  onChange,
}: Props) {
  const [showOther, setShowOther] = useState(false);
  const [searchText, setSearchText] = useState("");

  // value が空になったら内部stateをリセット
  useEffect(() => {
    if (value === "") {
      setShowOther(false);
      setSearchText("");
    }
  }, [value]);

  const filterByQuery = (items: string[]) => {
    if (!searchText) return items;
    const q = searchText.toLowerCase();
    return items.filter((s) => s.toLowerCase().includes(q));
  };

  const filteredMajor = filterByQuery(majorSuggestions);
  const filteredOther = filterByQuery(otherSuggestions);
  const hasSearchText = searchText.trim().length > 0;
  const noMatch =
    hasSearchText && filteredMajor.length === 0 && filteredOther.length === 0;

  const handleSelect = (name: string) => {
    onChange(name);
  };

  const chipStyle = (name: string, size: "major" | "other") => {
    const isSelected = value === name;
    return {
      padding: size === "major" ? "7px 14px" : "6px 12px",
      fontSize: size === "major" ? 12 : 11,
      borderRadius: 8,
      background: isSelected ? "rgba(99,102,241,0.1)" : "#232640",
      border: isSelected ? "1px solid #6366f1" : "0.5px solid #333355",
      color: "#ccccdd",
      cursor: "pointer",
      transition: "all 0.15s",
    } as React.CSSProperties;
  };

  // Determine if "その他" button should look selected
  const otherSelected = value && !majorSuggestions.includes(value);

  return (
    <div>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>対面デッキ</p>

      {/* Major deck chips (always visible) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(hasSearchText ? filteredMajor : majorSuggestions).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => handleSelect(name)}
            style={chipStyle(name, "major")}
          >
            {name}
          </button>
        ))}

        {/* 「その他」toggle button */}
        {!hasSearchText && (
          <button
            type="button"
            onClick={() => setShowOther((prev) => !prev)}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              borderRadius: 8,
              background: otherSelected
                ? "rgba(99,102,241,0.1)"
                : "#232640",
              border: otherSelected
                ? "1px solid #6366f1"
                : "1px dashed rgba(100,100,150,0.4)",
              color: "#999",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            その他{showOther ? " ▴" : "..."}
          </button>
        )}
      </div>

      {/* Expanded other section */}
      {(showOther || hasSearchText) && (
        <div style={{ marginTop: 12 }}>
          {/* Search input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1e2138",
              borderRadius: 8,
              border: "0.5px solid #333355",
              padding: "8px 12px",
              marginBottom: 12,
            }}
          >
            <SearchIcon />
            <input
              type="text"
              placeholder="デッキ名を検索・入力..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                // If typing freely, pass the text as onChange so it can be used as custom deck name
                if (e.target.value.trim()) {
                  onChange(e.target.value);
                }
              }}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#e8e8ec",
                fontSize: 13,
              }}
              autoFocus
            />
            {searchText && (
              <button
                type="button"
                onClick={() => {
                  setSearchText("");
                  onChange("");
                }}
                style={{ color: "#666688", fontSize: 14, lineHeight: 1 }}
              >
                ✕
              </button>
            )}
          </div>

          {noMatch ? (
            <p style={{ fontSize: 11, color: "#666688", textAlign: "center", padding: "8px 0" }}>
              該当するデッキがありません。入力テキストがそのまま使用されます。
            </p>
          ) : (
            <>
              {/* Other deck chips */}
              {(hasSearchText ? filteredOther : otherSuggestions).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(hasSearchText ? filteredOther : otherSuggestions).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelect(name)}
                      style={chipStyle(name, "other")}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
