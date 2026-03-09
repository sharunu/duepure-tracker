"use client";

import { useState, useEffect } from "react";

export type Format = "AD" | "ND";

export function useFormat() {
  const [format, setFormatState] = useState<Format>("ND");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("selectedFormat");
    if (saved === "AD" || saved === "ND") {
      setFormatState(saved);
    }
    setReady(true);
  }, []);

  const setFormat = (f: Format) => {
    setFormatState(f);
    localStorage.setItem("selectedFormat", f);
  };

  return { format, setFormat, ready };
}
