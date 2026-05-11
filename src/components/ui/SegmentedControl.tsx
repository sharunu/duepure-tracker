"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type SegmentedItem<V extends string> = {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  ariaControls?: string;
};

type Props<V extends string> = {
  items: readonly SegmentedItem<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md";
  variant?: "filled" | "underline";
  fullWidth?: boolean;
  pill?: boolean;
  ariaLabel?: string;
  role?: "tablist" | "radiogroup";
  itemIdPrefix?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
};

export function SegmentedControl<V extends string>({
  items,
  value,
  onChange,
  size = "md",
  variant = "filled",
  fullWidth = false,
  pill = false,
  ariaLabel,
  role,
  itemIdPrefix,
  onKeyDown,
  className,
}: Props<V>) {
  const isTablist = role === "tablist";
  const isRadiogroup = role === "radiogroup";
  const containerClass = buildContainerClass({ variant, fullWidth, pill, className });
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) onKeyDown(e);
    if (!isRadiogroup) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const currentItemsIdx = items.findIndex((i) => i.value === value);
    if (currentItemsIdx === -1) return;
    const delta = e.key === "ArrowRight" ? 1 : -1;
    let nextIdx = currentItemsIdx;
    for (let step = 0; step < items.length; step++) {
      nextIdx = (nextIdx + delta + items.length) % items.length;
      if (!items[nextIdx].disabled) break;
      if (nextIdx === currentItemsIdx) return;
    }
    if (items[nextIdx].value === value) return;
    onChange(items[nextIdx].value);
    buttonRefs.current[nextIdx]?.focus();
    e.preventDefault();
  };

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={containerClass}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, idx) => {
        const isActive = item.value === value;
        const buttonClass = buildButtonClass({
          variant,
          size,
          fullWidth,
          pill,
          isActive,
          disabled: !!item.disabled,
        });

        const childRole = isTablist ? "tab" : isRadiogroup ? "radio" : undefined;
        const rovingTabIndex = isTablist || isRadiogroup ? (isActive ? 0 : -1) : undefined;

        return (
          <button
            key={item.value}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role={childRole}
            id={isTablist && itemIdPrefix ? `${itemIdPrefix}-tab-${item.value}` : undefined}
            aria-selected={isTablist ? isActive : undefined}
            aria-checked={isRadiogroup ? isActive : undefined}
            aria-controls={item.ariaControls}
            aria-disabled={item.disabled || undefined}
            tabIndex={rovingTabIndex}
            onClick={() => {
              if (!item.disabled) onChange(item.value);
            }}
            disabled={item.disabled}
            className={buttonClass}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function buildContainerClass(opts: {
  variant: "filled" | "underline";
  fullWidth: boolean;
  pill: boolean;
  className?: string;
}): string {
  const { variant, fullWidth, pill, className } = opts;
  const extra = className ? ` ${className}` : "";

  if (variant === "underline") {
    return `flex border-b border-border${extra}`;
  }
  if (pill) {
    return `inline-flex rounded-full border border-border overflow-hidden${extra}`;
  }
  const layout = fullWidth ? "flex" : "inline-flex";
  return `${layout} rounded-xl p-1 border border-border-subtle bg-surface-2${extra}`;
}

function buildButtonClass(opts: {
  variant: "filled" | "underline";
  size: "sm" | "md";
  fullWidth: boolean;
  pill: boolean;
  isActive: boolean;
  disabled: boolean;
}): string {
  const { variant, size, fullWidth, pill, isActive, disabled } = opts;
  const parts: string[] = [];

  if (fullWidth) parts.push("flex-1");

  if (variant === "underline") {
    parts.push(
      "px-3",
      size === "sm" ? "py-1 text-xs min-h-[40px]" : "py-2 text-sm min-h-[44px]",
      "font-medium transition-colors",
      isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
    );
  } else if (pill) {
    parts.push(
      "px-3 py-1 text-xs font-medium transition-colors",
      isActive ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted text-muted-foreground"
    );
  } else {
    parts.push(
      "rounded-lg",
      size === "sm" ? "px-3 py-1 text-xs min-h-[32px]" : "px-3 py-2 text-sm min-h-[40px]",
      "font-medium transition-all"
    );
    if (disabled) {
      parts.push("text-muted-foreground opacity-50 cursor-not-allowed");
    } else {
      parts.push(isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground");
    }
  }

  return parts.join(" ");
}
