"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "default" | "selected";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: Variant;
  children?: ReactNode;
};

const baseClass = [
  "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

function variantClass(variant: Variant): string {
  if (variant === "selected") {
    return "bg-primary/10 border border-primary text-primary";
  }
  return "bg-surface-2 hover:bg-surface-3 text-muted-foreground border border-border-subtle";
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { variant = "default", className, children, type = "button", ...rest },
  ref,
) {
  const parts = [baseClass, variantClass(variant)];
  if (className) parts.push(className);

  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={variant === "selected"}
      className={parts.join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
});
