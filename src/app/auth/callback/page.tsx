"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");

    if (code) {
      // PKCE flow: exchange code for session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          router.replace("/auth?error=" + encodeURIComponent(error.message));
        } else {
          router.replace("/battle");
        }
      });
    } else {
      // Implicit flow: supabase-js auto-detects hash fragment tokens
      supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          router.replace("/battle");
        }
      });

      // If no code and no hash, redirect to auth
      if (!window.location.hash) {
        router.replace("/auth");
      }
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">ログイン処理中...</p>
    </div>
  );
}
