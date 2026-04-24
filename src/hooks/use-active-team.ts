"use client";

import { useCallback, useState, useEffect } from "react";

export function useActiveTeam() {
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("activeTeamId");
    if (saved) {
      setActiveTeamIdState(saved);
    }
    setReady(true);
  }, []);

  const setActiveTeamId = useCallback((id: string | null) => {
    setActiveTeamIdState(id);
    if (id) {
      localStorage.setItem("activeTeamId", id);
    } else {
      localStorage.removeItem("activeTeamId");
    }
  }, []);

  return { activeTeamId, setActiveTeamId, ready };
}
