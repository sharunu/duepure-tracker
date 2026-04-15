"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      // ゲスト（anonymous）セッションが復元された場合は強制ログアウト
      if (user?.is_anonymous) {
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        if (!pathname.startsWith("/auth")) {
          router.replace("/auth");
        }
        return;
      }

      setUser(user);
      setLoading(false);

      // 未認証ユーザーをログイン画面にリダイレクト
      if (!user && !pathname.startsWith("/auth")) {
        router.replace("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // anonymousセッション復元を検知して排除
      if (session?.user?.is_anonymous) {
        await supabase.auth.signOut();
        setUser(null);
        if (!pathname.startsWith("/auth")) {
          router.replace("/auth");
        }
        return;
      }
      setUser(session?.user ?? null);
      if (!session?.user && !pathname.startsWith("/auth")) {
        router.replace("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  return { user, loading };
}
