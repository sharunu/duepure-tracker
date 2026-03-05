"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          router.replace("/auth?error=" + encodeURIComponent(error.message));
        } else {
          router.replace("/battle");
        }
      });
    } else {
      supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          router.replace("/battle");
        }
      });

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

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">ログイン処理中...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
