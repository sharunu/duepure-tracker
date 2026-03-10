"use client";

import { useState } from "react";

type Props = {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  battleCounts: Record<string, number>;
  onMonthChange: (year: number, month: number) => void;
};

function toDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function DateRangeCalendar({ startDate, endDate, onRangeChange, battleCounts, onMonthChange }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingField, setEditingField] = useState<"start" | "end" | null>(null);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const handlePrevMonth = () => {
    const newMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const newYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    setViewYear(newYear);
    setViewMonth(newMonth);
    onMonthChange(newYear, newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    const newYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    setViewYear(newYear);
    setViewMonth(newMonth);
    onMonthChange(newYear, newMonth);
  };

  const openForStart = () => {
    if (calendarOpen && editingField === "start") {
      setCalendarOpen(false);
      setEditingField(null);
    } else {
      setCalendarOpen(true);
      setEditingField("start");
    }
  };

  const openForEnd = () => {
    if (calendarOpen && editingField === "end") {
      setCalendarOpen(false);
      setEditingField(null);
    } else {
      setCalendarOpen(true);
      setEditingField("end");
    }
  };

  const handleDayClick = (day: number) => {
    const clicked = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (editingField === "start") {
      if (clicked > endDate) {
        onRangeChange(clicked, clicked);
      } else {
        onRangeChange(clicked, endDate);
      }
    } else if (editingField === "end") {
      if (clicked < startDate) {
        onRangeChange(clicked, clicked);
      } else {
        onRangeChange(startDate, clicked);
      }
    }
    setCalendarOpen(false);
    setEditingField(null);
  };

  const isInRange = (day: number): boolean => {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const isStart = (day: number): boolean => {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr === startDate;
  };

  const isEnd = (day: number): boolean => {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr === endDate;
  };

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-2">
      {/* Date range display */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground mb-1">期間指定</p>
        <div className="flex items-center gap-2">
          <button
            onClick={openForStart}
            className={`flex-1 rounded-md border px-3 py-2 text-sm text-center transition-colors ${
              calendarOpen && editingField === "start"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {toDisplayDate(startDate)}
          </button>
          <span className="text-muted-foreground text-sm">〜</span>
          <button
            onClick={openForEnd}
            className={`flex-1 rounded-md border px-3 py-2 text-sm text-center transition-colors ${
              calendarOpen && editingField === "end"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {toDisplayDate(endDate)}
          </button>
        </div>
      </div>

      {/* Calendar modal */}
      {calendarOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setCalendarOpen(false)}
        >
          <div
            className="bg-card rounded-xl border border-border p-4 w-[90%] max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
          <p className="text-xs text-center text-muted-foreground mb-2">
            {editingField === "start" ? "開始日を選択" : "終了日を選択"}
          </p>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-muted rounded-md text-muted-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="text-sm font-medium text-primary">{viewYear}年{viewMonth}月</span>
            <button onClick={handleNextMonth} className="p-2 hover:bg-muted rounded-md text-muted-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((w) => (
              <div key={w} className="text-center text-xs text-muted-foreground py-1">{w}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const count = battleCounts[dateStr] || 0;
              const inRange = isInRange(day);
              const start = isStart(day);
              const end = isEnd(day);
              const isSingle = start && end;

              let cellClass = "relative flex flex-col items-center justify-center py-1 text-sm cursor-pointer transition-colors ";
              if (isSingle) {
                cellClass += "bg-primary text-primary-foreground rounded-md ";
              } else if (start) {
                cellClass += "bg-primary text-primary-foreground rounded-l-md ";
              } else if (end) {
                cellClass += "bg-primary text-primary-foreground rounded-r-md ";
              } else if (inRange) {
                cellClass += "bg-primary/15 text-primary ";
              } else {
                cellClass += "hover:bg-muted text-foreground ";
              }

              return (
                <button key={i} onClick={() => handleDayClick(day)} className={cellClass}>
                  <span className="leading-5">{day}</span>
                  {count > 0 && (
                    <span className={`text-[10px] leading-3 font-medium ${inRange || start || end ? (start || end ? "text-primary-foreground/80" : "text-primary/80") : "text-muted-foreground"}`}>
                      {count}件
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
