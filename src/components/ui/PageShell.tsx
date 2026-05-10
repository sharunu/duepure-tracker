"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  bottomNav?: boolean;
  className?: string;
};

export function PageShell({ children, bottomNav = true, className }: Props) {
  const padBottom = bottomNav ? "pb-20" : "";
  const extra = className ? ` ${className}` : "";
  return (
    <div className={`min-h-screen ${padBottom} px-4 pt-6 max-w-lg mx-auto space-y-4${extra}`}>
      {children}
    </div>
  );
}
