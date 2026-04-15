"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Props = {
  memo: string;
  isSelected: boolean;
  onSelect: (memo: string) => void;
  onDelete: (memo: string) => Promise<void>;
};

export function MemoSuggestionButton({ memo, isSelected, onSelect, onDelete }: Props) {
  const [showPopup, setShowPopup] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const moved = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    isLongPress.current = false;
    moved.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setShowPopup(true);
    }, 500);
  }, []);

  const handleClick = useCallback(() => {
    if (!isLongPress.current && !moved.current && !showPopup) {
      onSelect(memo);
    }
  }, [onSelect, memo, showPopup]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    clearTimer();
    isLongPress.current = true;
    setShowPopup(true);
  }, [clearTimer]);

  const handleTouchMove = useCallback(() => {
    moved.current = true;
    clearTimer();
  }, [clearTimer]);

  // Close popup on outside click
  useEffect(() => {
    if (!showPopup) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showPopup]);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(memo);
    setDeleting(false);
    setShowPopup(false);
  };

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={startTimer}
        onMouseUp={clearTimer}
        onMouseLeave={clearTimer}
        onTouchStart={startTimer}
        onTouchEnd={clearTimer}
        onTouchMove={handleTouchMove}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        style={{
          padding: "5px 10px",
          fontSize: 11,
          borderRadius: 6,
          background: isSelected ? "rgba(99,102,241,0.15)" : "#232640",
          border: isSelected ? "1px solid #6366f1" : "0.5px solid #333355",
          color: "#ccccdd",
          cursor: "pointer",
          transition: "all 0.15s",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {memo}
      </button>

      {/* Floating delete popup */}
      {showPopup && (
        <div
          ref={popupRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            animation: "memoPopupIn 0.18s ease-out",
          }}
        >
          <div
            style={{
              background: "#1e2138",
              border: "1px solid rgba(232,93,117,0.4)",
              borderRadius: 10,
              padding: "6px 4px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 56,
            }}
          >
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "6px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                opacity: deleting ? 0.5 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e85d75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span style={{ fontSize: 10, color: "#e85d75", fontWeight: 500 }}>
                {deleting ? "..." : "削除"}
              </span>
            </button>
          </div>
          {/* Arrow pointing down */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #1e2138",
              margin: "0 auto",
            }}
          />
          <style>{`
            @keyframes memoPopupIn {
              from { opacity: 0; transform: translateX(-50%) scale(0.8) translateY(4px); }
              to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </span>
  );
}
