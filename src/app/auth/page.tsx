"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  // ハッシュフラグメントからセッションを検出（implicit flowの場合）
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN") {
          window.location.href = "/battle";
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithOAuth = async (provider: "google" | "twitter") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signInWithEmail = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("メールを確認してください。ログインリンクを送信しました。");
    }
  };

  const signInAsGuest = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      window.location.href = "/battle";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">
            デュエプレトラッカー
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            対戦記録・環境分析ツール
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signInWithOAuth("google")}
            className="w-full rounded-lg bg-card border border-border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            Googleでログイン
          </button>
          <button
            onClick={() => signInWithOAuth("twitter")}
            className="w-full rounded-lg bg-card border border-border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            X (Twitter) でログイン
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signInWithEmail()}
            className="w-full rounded-lg bg-card border border-border px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={signInWithEmail}
            disabled={loading || !email}
            className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            メールでログイン
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={signInAsGuest}
          disabled={loading}
          className="w-full rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          ゲストとして使う
        </button>

        {message && (
          <p className="text-center text-sm text-accent">{message}</p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          ゲストは個人記録のみ。環境統計・投票への参加にはログインが必要です。
        </p>
      </div>
    </div>
  );
}
