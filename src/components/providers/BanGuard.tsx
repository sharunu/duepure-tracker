"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUserStage } from "@/lib/actions/account-actions";

const EXCLUDED_PATHS = ["/auth", "/terms", "/privacy"];

export function BanGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isBanned, setIsBanned] = useState<boolean | null>(null);

  const isExcluded = EXCLUDED_PATHS.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (isExcluded) {
      setIsBanned(false);
      return;
    }
    getUserStage().then(stage => {
      setIsBanned(stage === 4);
    });
  }, [isExcluded]);

  if (isExcluded) return <>{children}</>;
  if (isBanned === null) return null;

  if (isBanned) {
    const handleLogout = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/auth";
    };

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e85d75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h1 className="text-[18px] font-medium text-white">アカウントが停止されています</h1>
          <p className="text-[13px] text-gray-400">
            このアカウントは利用規約に違反したため停止されました。
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-[#232640] text-white rounded-[10px] px-4 py-3 text-[14px] font-medium hover:opacity-90"
            style={{ border: "0.5px solid rgba(100,100,150,0.2)" }}
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
