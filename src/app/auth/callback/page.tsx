"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
        router.replace("/battle");
        return;
      }

      // Implicit flow: check for session from hash fragment
      // supabase-js auto-processes hash on init
      const checkSession = async () => {
        for (let i = 0; i < 20; i++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            router.replace("/battle");
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        setError("セッションを取得できませんでした");
      };

      if (window.location.hash) {
        await checkSession();
      } else {
        router.replace("/auth");
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-sm">{error}</p>
          <a href="/auth" className="text-primary underline text-sm">
            ログイン画面に戻る
          </a>
        </div>
      </div>
    );
  }

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
