"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");

  const supabase = createClient();

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

  const signInWithPassword = async () => {
    if (!email || !password) return;
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage("ログインに失敗しました。メールアドレスまたはパスワードを確認してください。");
    } else {
      window.location.href = "/battle";
    }
  };

  const signUp = async () => {
    if (!email || !password) return;
    if (password.length < 8) {
      setMessage("パスワードは8文字以上にしてください");
      return;
    }
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: userName || undefined },
      },
    });
    setLoading(false);
    if (error) {
      setMessage("アカウント作成に失敗しました。もう一度お試しください。");
    } else if (data.user?.identities?.length === 0) {
      setMessage("このメールアドレスは既に登録されています");
    } else {
      window.location.href = "/battle";
    }
  };

  const signInAsGuest = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (error) {
      setMessage("認証に失敗しました。もう一度お試しください。");
    } else {
      window.location.href = "/battle";
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage("メールアドレスを入力してください");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    setLoading(false);
    if (error) {
      setMessage("リセットメールの送信に失敗しました。もう一度お試しください。");
    } else {
      setMessage("リセットメールを送信しました。メールを確認してください。");
    }
  };

  const handleSubmit = () => {
    if (mode === "login") {
      signInWithPassword();
    } else if (mode === "signup") {
      signUp();
    } else {
      handleResetPassword();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-[24px] font-bold text-white">
            デュエプレトラッカー
          </h1>
          <p className="text-[13px] text-gray-400 mt-2">
            対戦記録・環境分析ツール
          </p>
        </div>

        {mode !== "reset" && (
          <>
            <div className="space-y-3">
              <button
                onClick={() => signInWithOAuth("google")}
                className="w-full rounded-[10px] bg-[#232640] px-4 py-3 text-[14px] font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-3"
                style={{ border: "0.5px solid rgba(100,100,150,0.2)" }}
              >
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Googleでログイン
              </button>
              <button
                onClick={() => signInWithOAuth("twitter")}
                className="w-full rounded-[10px] bg-[#232640] px-4 py-3 text-[14px] font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-3"
                style={{ border: "0.5px solid rgba(100,100,150,0.2)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X (Twitter) でログイン
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(100,100,150,0.2)" }} />
              <span className="text-[12px] text-gray-500">or</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(100,100,150,0.2)" }} />
            </div>
          </>
        )}

        <div className="space-y-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[6px] bg-[#1a1d2e] px-4 py-3 text-[14px] placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            style={{ border: "0.5px solid #333355" }}
          />
          {mode === "signup" && (
            <input
              type="text"
              placeholder="ユーザー名（任意）"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full rounded-[6px] bg-[#1a1d2e] px-4 py-3 text-[14px] placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
              style={{ border: "0.5px solid #333355" }}
            />
          )}
          {mode !== "reset" && (
            <input
              type="password"
              placeholder="パスワード（8文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSubmit();
              }}
              className="w-full rounded-[6px] bg-[#1a1d2e] px-4 py-3 text-[14px] placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
              style={{ border: "0.5px solid #333355" }}
            />
          )}
          {mode === "reset" && (
            <p className="text-[12px] text-gray-500">
              登録済みのメールアドレスを入力してください。パスワードリセット用のメールを送信します。
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || !email || (mode !== "reset" && !password)}
            className="w-full rounded-[10px] bg-[#6366f1] text-white px-4 py-3 text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mode === "login" ? "ログイン" : mode === "signup" ? "アカウント作成" : "リセットメールを送信"}
          </button>

          {mode === "login" && (
            <button
              onClick={() => { setMode("reset"); setMessage(""); }}
              className="w-full text-center text-[12px] text-gray-500 hover:text-gray-400"
            >
              パスワードをお忘れですか？
            </button>
          )}

          <button
            onClick={() => {
              if (mode === "reset") {
                setMode("login");
              } else {
                setMode(mode === "login" ? "signup" : "login");
              }
              setMessage("");
            }}
            className="w-full text-center text-[12px] text-[#818cf8] hover:underline"
          >
            {mode === "reset" ? "ログインに戻る" : mode === "login" ? "アカウント新規作成はこちら" : "ログインに戻る"}
          </button>
        </div>

        {mode !== "reset" && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(100,100,150,0.2)" }} />
              <span className="text-[12px] text-gray-500">or</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(100,100,150,0.2)" }} />
            </div>

            <button
              onClick={signInAsGuest}
              disabled={loading}
              className="w-full rounded-[10px] bg-[#232640] px-4 py-3 text-[13px] text-gray-400 hover:opacity-90 transition-opacity"
              style={{ border: "0.5px solid rgba(100,100,150,0.2)" }}
            >
              ゲストとして使う
            </button>
          </>
        )}

        {message && (
          <p className={"text-center text-[13px] " + (message.includes("送信しました") ? "text-[#818cf8]" : "text-[#ef4444]")}>
            {message}
          </p>
        )}

        <p className="text-center text-[11px] text-gray-500">
          {mode === "reset"
            ? "メールが届かない場合は、迷惑メールフォルダをご確認ください。"
            : "ゲストは個人記録のみ。環境統計・投票への参加にはログインが必要です。"}
        </p>

        <div className="flex justify-center gap-4 pt-2">
          <Link href="/terms" className="text-[11px] text-gray-500 hover:text-gray-400">
            利用規約
          </Link>
          <Link href="/privacy" className="text-[11px] text-gray-500 hover:text-gray-400">
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </div>
  );
}
