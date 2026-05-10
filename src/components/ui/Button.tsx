"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "result";
type Tone = "win" | "loss" | "draw";
type Size = "sm" | "md" | "lg";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant: Variant;
  tone?: Tone;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
};

const baseClass = [
  "inline-flex items-center justify-center font-medium rounded-lg transition-all",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-inherit",
].join(" ");

function sizeClass(size: Size): string {
  if (size === "sm") return "h-8 px-3 text-xs gap-1.5";
  if (size === "lg") return "h-11 px-5 text-sm gap-2";
  return "h-10 px-4 text-sm gap-2";
}

function variantClass(variant: Variant, tone?: Tone): string {
  if (variant === "primary") {
    return "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]";
  }
  if (variant === "secondary") {
    return "bg-surface-2 hover:bg-surface-3 text-foreground border border-border-subtle";
  }
  if (variant === "ghost") {
    return "bg-transparent hover:bg-surface-2 text-foreground";
  }
  if (variant === "destructive") {
    return "bg-destructive text-white hover:bg-destructive/90 active:scale-[0.98]";
  }
  const toneBg = tone === "win" ? "bg-success" : tone === "loss" ? "bg-destructive" : "bg-warning";
  return `${toneBg} text-white shadow-sm active:scale-95`;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    tone,
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const parts = [baseClass, sizeClass(size), variantClass(variant, tone)];
  if (fullWidth) parts.push("w-full");
  if (className) parts.push(className);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={parts.join(" ")}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
