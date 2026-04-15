"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { syncXAccountFromAuth } from "@/lib/actions/account-actions";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const searchParams = new URLSearchParams(window.location.search);

    // linkIdentity 完了後: ?link_x=true パラメータがある場合
    if (searchParams.get("link_x") === "true") {
      const handleLink = async () => {
        // supabase-jsの初期化（hash fragment処理含む）を待つ
        await new Promise<void>((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
              subscription.unsubscribe();
              resolve();
            }
          });
          setTimeout(() => { subscription.unsubscribe(); resolve(); }, 3000);
        });

        // セッションを最新化
        await supabase.auth.refreshSession();

        // サーバーから最新のユーザー情報を取得
        const { data: { user } } = await supabase.auth.getUser();
        console.log("[X link] identities:", user?.identities?.map(i => i.provider));

        if (user) {
          const tw = user.identities?.find((i: { provider: string }) => i.provider === "twitter");
          if (tw) {
            const xUsername = tw.identity_data?.user_name ?? tw.identity_data?.preferred_username;
            const xUserId = tw.identity_data?.provider_id ?? tw.id;
            console.log("[X link] syncing:", { xUsername, xUserId });
            if (xUsername) {
              await supabase.from("profiles").update({
                x_user_id: xUserId,
                x_username: xUsername,
              }).eq("id", user.id);
            }
          } else {
            console.log("[X link] no twitter identity found");
            localStorage.removeItem('x_link_pending');
            window.location.href = "/account?x_link_error=conflict";
            return;
          }
        }

        localStorage.removeItem('x_link_pending');
        window.location.href = "/account";
      };
      handleLink();
      return;
    }

    // X連携失敗検出: linkIdentityが失敗してlink_x=trueパラメータが失われた場合
    const xLinkPending = localStorage.getItem('x_link_pending');
    if (xLinkPending) {
      localStorage.removeItem('x_link_pending');
      window.location.href = "/account?x_link_error=conflict";
      return;
    }

    // supabase-js auto-detects hash fragment tokens
    // Listen for auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          await syncXAccountFromAuth();
          window.location.href = "/battle";
        }
        if (event === "PASSWORD_RECOVERY" && session) {
          window.location.href = "/account";
        }
      }
    );

    // Fallback: check session after a delay
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.href = "/battle";
      } else {
        setError("ログインに失敗しました。もう一度お試しください。");
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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
