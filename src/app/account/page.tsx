"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getDisplayName, updateDisplayName, getAuthProvider, getEmail, getXConnectionStatus, unlinkXAccount, getUserStage, hasGoogleIdentity } from "@/lib/actions/account-actions";
import { submitFeedback } from "@/lib/actions/feedback-actions";
import { checkIsAdmin, getPremiumUiVisible } from "@/lib/actions/admin-actions";
import { BottomNav } from "@/components/layout/BottomNav";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [pageLoading, setPageLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nameMessage, setNameMessage] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  const [provider, setProvider] = useState("");
  const [hasGoogle, setHasGoogle] = useState(false);

  // フィードバック関連
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<"bug" | "feature" | "other">("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userStage, setUserStage] = useState<number>(2);

  // X連携関連
  const [xConnected, setXConnected] = useState(false);
  const [xLinkError, setXLinkError] = useState<string | null>(null);
  const [xUsername, setXUsername] = useState<string | null>(null);
  const [xSource, setXSource] = useState<"login" | "linked" | null>(null);
  const [xLoading, setXLoading] = useState(false);
  const [premiumUiVisible, setPremiumUiVisible] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [name, prov, mail, admin, xStatus, stage, puiVisible, googleLinked] = await Promise.all([getDisplayName(), getAuthProvider(), getEmail(), checkIsAdmin(), getXConnectionStatus(), getUserStage(), getPremiumUiVisible(), hasGoogleIdentity()]);
        setDisplayName(name);
        setProvider(prov);
        setEmail(mail);
        setIsAdmin(admin);
        setUserStage(stage);
        setPremiumUiVisible(puiVisible);
        setXConnected(xStatus.isConnected);
        setXUsername(xStatus.xUsername);
        setXSource(xStatus.source);
        setHasGoogle(googleLinked);
      } catch {
        console.error("Failed to load account data");
      } finally {
        setPageLoading(false);
      }
    };
    load();

    // リカバリモード検出時はセキュリティページへリダイレクト
    const params = new URLSearchParams(window.location.search);
    if (params.get("recovery") === "true") {
      router.replace("/account/security?recovery=true");
      return;
    }
    // X連携エラー検知
    if (params.get("x_link_error") === "conflict") {
      setXLinkError("このXアカウントはすでに別のユーザーで使用されています");
      window.history.replaceState({}, "", "/account");
    }

    // リカバリーセッション検知
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/account/security?recovery=true");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const handleUpdateName = async () => {
    if (!displayName.trim()) return;
    setNameLoading(true);
    setNameMessage("");
    try {
      await updateDisplayName(displayName.trim());
      setNameMessage("ユーザー名を更新しました");
    } catch {
      setNameMessage("ユーザー名の更��に失敗しました");
    }
    setNameLoading(false);
  };

  const handleSwitchAccount = async () => {
    if (hasGoogle) {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) return;
    setFeedbackLoading(true);
    try {
      await submitFeedback(feedbackCategory, feedbackMessage.trim());
      setFeedbackOpen(false);
      setFeedbackMessage("");
      setFeedbackCategory("bug");
      setFeedbackToast("送信しました。ご意見ありがとうございます！");
      setTimeout(() => setFeedbackToast(""), 3000);
    } catch {
      setFeedbackToast("送信に失敗しました");
      setTimeout(() => setFeedbackToast(""), 3000);
    }
    setFeedbackLoading(false);
  };

  const handleLinkX = async () => {
    setXLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        localStorage.setItem("x_link_pending", currentUser.id);
      }
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "twitter",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?link_x=true`,
        },
      });
      if (error) {
        console.error("X linking error:", error);
        alert("X連携に失敗しました: " + error.message);
        setXLoading(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("X linking error:", err);
      alert("X連携に失敗しました。もう一度お試しください。");
      setXLoading(false);
    }
  };

  const handleUnlinkX = async () => {
    setXLoading(true);
    try {
      const result = await unlinkXAccount();
      if (result.success) {
        setXConnected(false);
        setXUsername(null);
        setXSource(null);
      } else if (result.error === "only_identity") {
        alert("X連携はこのアカウントの唯一のログイン方法のため解除できません");
      } else {
        alert("X連携の解除に失敗しました");
      }
    } catch {
      alert("X連携の解除に失敗しました");
    }
    setXLoading(false);
  };

  const isSnsLogin = provider === "google" || provider === "twitter";
  const isGuest = provider === "anonymous" || provider === "unknown";

  if (pageLoading) {
    return (
      <>
        <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
          <div className="animate-pulse rounded-[8px] bg-[#232640] h-6 w-32 mb-5" />
          <div className="animate-pulse rounded-[10px] bg-[#232640] h-[76px] mb-5" />
          <div className="animate-pulse rounded-[8px] bg-[#232640] h-4 w-20 mb-2" />
          <div className="animate-pulse rounded-[10px] bg-[#232640] h-[140px] mb-5" />
          <div className="animate-pulse rounded-[8px] bg-[#232640] h-4 w-16 mb-2" />
          <div className="animate-pulse rounded-[10px] bg-[#232640] h-[60px]" />
        </div>
        <BottomNav />
      </>
    );
  }

  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <h1 className="text-[20px] font-medium mb-5">アカウント設定</h1>

        {/* プロフィールカード */}
        <div className="bg-[#232640] rounded-[10px] px-4 py-[14px] flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5b8def] to-[#7c5bf0] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[15px] font-medium">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium truncate">{displayName || "未設定"}</p>
            <p className="text-[12px] text-gray-500 truncate">{isGuest ? "ゲストアカウント" : (email || "未設定")}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={"inline-block text-[10px] px-2 py-0.5 rounded-full font-medium " + (
                isSnsLogin
                  ? "bg-[#1a2744] text-[#5b8def]"
                  : "bg-[#2a1f44] text-[#9b7bef]"
              )}>
                {provider === "google" ? "Google" : provider === "twitter" ? "X" : isGuest ? "ゲスト" : "メール"}
              </span>
              {userStage === 1 && premiumUiVisible && (
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium bg-yellow-600/20 text-yellow-400">
                  優良ユーザー
                </span>
              )}
            </div>
          </div>
          {hasGoogle && (
            <button
              onClick={handleSwitchAccount}
              className="flex-shrink-0 bg-[#1e2138] text-[#818cf8] text-[11px] px-3 py-1.5 rounded-[6px] hover:opacity-80 transition-opacity"
              style={{ border: "0.5px solid rgba(129,140,248,0.3)" }}
            >
              アカウント切替
            </button>
          )}
        </div>

        {/* プロフィールセクション */}
        <div className="mt-5">
          <p className="text-[12px] text-gray-500 mb-2">プロフィール</p>
          <div className={"bg-[#232640] rounded-[10px]" + (isGuest ? " opacity-50" : "")}>
            {/* メールアドレス行 */}
            <div className="px-4 py-[14px] flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-500">メールアドレス</p>
                <p className="text-[14px] truncate">{isGuest ? "ゲストアカウント" : (email || "未設定")}</p>
              </div>
              {isSnsLogin && (
                <span className="text-[10px] bg-[#1e2138] text-[#555577] px-2 py-0.5 rounded-full flex-shrink-0 ml-2">変更不可</span>
              )}
            </div>
            {/* 区切り線 */}
            <div className="mx-4 border-t" style={{ borderColor: "rgba(100,100,150,0.2)", borderWidth: "0.5px" }} />
            {/* ユーザー名行 */}
            <div className="px-4 py-[14px]">
              <p className="text-[11px] text-gray-500 mb-2">ユーザー名</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isGuest}
                  className="flex-1 bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none disabled:opacity-50"
                  style={{ border: "0.5px solid #333355" }}
                  placeholder="ユーザー名"
                />
                <button
                  onClick={handleUpdateName}
                  disabled={nameLoading || isGuest}
                  className="bg-[#3d4070] text-white rounded-[6px] px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
              {nameMessage && (
                <p className="text-xs text-accent mt-2">{nameMessage}</p>
              )}
            </div>
            {/* 区切り線 */}
            <div className="mx-4 border-t" style={{ borderColor: "rgba(100,100,150,0.2)", borderWidth: "0.5px" }} />
            {/* セキュリティ行 */}
            <div
              className="px-4 py-[14px] flex items-center justify-between cursor-pointer"
              onClick={() => router.push("/account/security")}
            >
              <div>
                <p className="text-[14px]">セキュリティ</p>
                <p className="text-[11px] text-gray-500 mt-0.5">パスワード変更・アカウント削除</p>
              </div>
              <span className="text-gray-500 text-[18px] ml-2 flex-shrink-0">&rsaquo;</span>
            </div>
          </div>
        </div>

        {/* X連携セクション（ゲスト以外に表示） */}
        {!isGuest && (
          <div className="mt-5">
            <p className="text-[12px] text-gray-500 mb-2">X連携</p>
            <div className="bg-[#232640] rounded-[10px] px-4 py-[14px]">
              {xSource === "login" && xConnected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px]">
                      {xUsername ? `@${xUsername}` : "X"} で連携済み
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">ログイン連携</p>
                  </div>
                  <span className="text-[10px] bg-[#1e2138] text-[#555577] px-2 py-0.5 rounded-full flex-shrink-0 ml-2">自動連携</span>
                </div>
              ) : xConnected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px]">@{xUsername} で連携済み</p>
                  </div>
                  <button
                    onClick={handleUnlinkX}
                    disabled={xLoading}
                    className="text-[12px] text-[#e85d75] hover:opacity-80 disabled:opacity-50 flex-shrink-0 ml-2"
                  >
                    連携解除
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] text-gray-400 mb-3">
                    {premiumUiVisible
                      ? "X連携すると、優良ユーザーとして認定されやすくなり、分析タブのシェア機能も利用可能になります。"
                      : "X連携すると、分析タブのシェア機能が利用可能になります。"}
                  </p>
                  <button
                    onClick={handleLinkX}
                    disabled={xLoading}
                    className="w-full bg-[#232640] text-white rounded-[6px] px-4 py-2.5 text-[13px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ border: "0.5px solid rgba(100,100,150,0.3)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Xアカウントを連携
                  </button>
                  {xLinkError && (
                    <p className="text-[11px] text-[#e85d75] mt-2">{xLinkError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* その他セクション */}
        <div className="mt-5">
          <p className="text-[12px] text-gray-500 mb-2">その他</p>
          <div className="space-y-3">
            {isAdmin && (
              <div
                className="bg-[#232640] rounded-[10px] px-4 py-[14px] flex items-center justify-between cursor-pointer"
                onClick={() => router.push("/admin")}
              >
                <div>
                  <p className="text-[14px]">管理者画面</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">ユーザー閲覧・フィードバック確認</p>
                </div>
                <span className="text-gray-500 text-[18px]">&rsaquo;</span>
              </div>
            )}
            {/* ご意見・バグ報告 */}
            <div
              className={"bg-[#232640] rounded-[10px] px-4 py-[14px] flex items-center justify-between " + (isGuest ? "opacity-50 cursor-not-allowed" : "cursor-pointer")}
              onClick={() => !isGuest && setFeedbackOpen(true)}
            >
              <div>
                <p className="text-[14px]">ご意見・バグ報告</p>
                {isGuest && <p className="text-[11px] text-gray-500 mt-0.5">アカウント登録するとご利用いただけます</p>}
              </div>
              {!isGuest && <span className="text-gray-500 text-[18px]">&rsaquo;</span>}
            </div>

            {/* 利用規約 */}
            <Link href="/terms">
              <div className="bg-[#232640] rounded-[10px] px-4 py-[14px] flex items-center justify-between cursor-pointer">
                <p className="text-[14px]">利用規約</p>
                <span className="text-gray-500 text-[18px]">&rsaquo;</span>
              </div>
            </Link>

            {/* プライバシーポリシー */}
            <Link href="/privacy">
              <div className="bg-[#232640] rounded-[10px] px-4 py-[14px] flex items-center justify-between cursor-pointer mt-3">
                <p className="text-[14px]">プライバシーポリシー</p>
                <span className="text-gray-500 text-[18px]">&rsaquo;</span>
              </div>
            </Link>

            {/* ログアウト */}
            <div
              className="rounded-[10px] px-4 py-[14px] flex items-center justify-between cursor-pointer mt-3"
              style={{
                backgroundColor: "rgba(232,93,117,0.06)",
                border: "0.5px solid rgba(232,93,117,0.15)",
              }}
              onClick={handleLogout}
            >
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e85d75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <p className="text-[14px] text-[#e85d75]">ログアウト</p>
              </div>
              <span className="text-[#e85d75] text-[18px]">&rsaquo;</span>
            </div>
          </div>
        </div>
      </div>

      {/* フィードバックモーダル */}
      {feedbackOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setFeedbackOpen(false); }}
        >
          <div
            className="w-full max-w-lg rounded-t-[16px] px-5 pt-5 pb-8"
            style={{ backgroundColor: "#1a1d2e" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-medium">ご意見・バグ報告</h2>
              <button
                onClick={() => setFeedbackOpen(false)}
                className="text-gray-500 text-[20px] leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-[12px] text-gray-500 mb-3">カテゴリ</p>
            <div className="flex gap-2 mb-4">
              {([
                { value: "bug" as const, label: "バグ報告" },
                { value: "feature" as const, label: "機能要望" },
                { value: "other" as const, label: "その他" },
              ]).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFeedbackCategory(item.value)}
                  className={"flex-1 rounded-[6px] py-2 text-[13px] font-medium transition-colors " + (
                    feedbackCategory === item.value
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#232640] text-gray-400"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="text-[12px] text-gray-500 mb-2">メッセージ</p>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              className="w-full bg-[#232640] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none resize-none"
              style={{ border: "0.5px solid #333355", minHeight: 120 }}
              placeholder="内容を入力してください"
            />

            <button
              onClick={handleSubmitFeedback}
              disabled={feedbackLoading || !feedbackMessage.trim()}
              className="w-full mt-4 bg-[#6366f1] text-white rounded-[10px] px-4 py-3 text-[14px] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {feedbackLoading ? "送信中..." : "送信"}
            </button>
          </div>
        </div>
      )}

      {/* フィードバックトースト */}
      {feedbackToast && (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#232640",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 10,
            fontSize: 13,
            zIndex: 9999,
            border: "0.5px solid rgba(100,100,150,0.3)",
          }}
        >
          {feedbackToast}
        </div>
      )}

      <BottomNav />
    </>
  );
}
