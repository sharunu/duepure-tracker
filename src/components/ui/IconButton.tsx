"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Tone = "default" | "destructive";
type Size = "sm" | "md";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  "aria-label": string;
  icon: ReactNode;
  tone?: Tone;
  size?: Size;
};

const baseClass = [
  "inline-flex items-center justify-center rounded-lg transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

function sizeClass(size: Size): string {
  if (size === "sm") return "size-10 [&_svg]:size-4";
  return "size-11 [&_svg]:size-5";
}

function toneClass(tone: Tone): string {
  if (tone === "destructive") {
    return "text-destructive hover:bg-destructive/10";
  }
  return "text-muted-foreground hover:bg-surface-2 hover:text-foreground";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, tone = "default", size = "md", className, type = "button", ...rest },
  ref,
) {
  const parts = [baseClass, sizeClass(size), toneClass(tone)];
  if (className) parts.push(className);

  return (
    <button ref={ref} type={type} className={parts.join(" ")} {...rest}>
      {icon}
    </button>
  );
});
