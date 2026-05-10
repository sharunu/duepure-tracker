"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

type Tone = "raised" | "subtle";
type Padding = "sm" | "md";

export type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone;
  padding?: Padding;
  children?: ReactNode;
};

const baseClass = "rounded-[10px]";

function toneClass(tone: Tone): string {
  if (tone === "subtle") return "bg-surface-2 border border-border-subtle";
  return "bg-surface-1 border border-border-subtle";
}

function paddingClass(padding: Padding): string {
  return padding === "sm" ? "p-2" : "p-3";
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { tone = "raised", padding = "md", className, children, ...rest },
  ref,
) {
  const parts = [baseClass, toneClass(tone), paddingClass(padding)];
  if (className) parts.push(className);

  return (
    <div ref={ref} className={parts.join(" ")} {...rest}>
      {children}
    </div>
  );
});
