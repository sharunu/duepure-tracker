"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed top-4 left-4 right-4 bg-card border border-border rounded-lg p-4 shadow-lg z-50 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm">ホーム画面に追加してすばやくアクセス</p>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => setDismissed(true)}
            className="text-sm text-muted-foreground"
          >
            後で
          </button>
          <button
            onClick={handleInstall}
            className="text-sm font-medium text-primary"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
