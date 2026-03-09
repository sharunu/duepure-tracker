"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDisplayName, updateDisplayName, changePassword, getAuthProvider, getEmail, deleteAccount } from "@/lib/actions/account-actions";
import { BottomNav } from "@/components/layout/BottomNav";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [pageLoading, setPageLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nameMessage, setNameMessage] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [provider, setProvider] = useState("");
  const [switchMessage, setSwitchMessage] = useState("");

  // 削除関連
  const [deleteStep, setDeleteStep] = useState(0); // 0: none, 1: first confirm, 2: second confirm (SNS), or password input (email)
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [name, prov, mail] = await Promise.all([getDisplayName(), getAuthProvider(), getEmail()]);
      setDisplayName(name);
      setProvider(prov);
      setEmail(mail);
      setPageLoading(false);
    };
    load();
  }, []);

  const handleUpdateName = async () => {
    if (!displayName.trim()) return;
    setNameLoading(true);
    setNameMessage("");
    try {
      await updateDisplayName(displayName.trim());
      setNameMessage("ユーザー名を更新しました");
    } catch (e: any) {
      setNameMessage(e.message || "更新に失敗しました");
    }
    setNameLoading(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 8) {
      setPasswordMessage("新しいパスワードは8文字以上にしてください");
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage("");
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage("パスワードを変更しました");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e: any) {
      setPasswordMessage(e.message || "変更に失敗しました");
    }
    setPasswordLoading(false);
  };

  const handleSwitchAccount = async () => {
    setSwitchMessage("");
    if (provider === "google") {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
    } else if (provider === "twitter") {
      await supabase.auth.signInWithOAuth({
        provider: "twitter",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteMessage("");
    try {
      // メールログインの場合はパスワード検証
      if (isEmailLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: deletePassword,
        });
        if (signInError) {
          setDeleteMessage("パスワードが正しくありません");
          setDeleteLoading(false);
          return;
        }
      }
      await deleteAccount();
      await supabase.auth.signOut();
      router.push("/auth");
    } catch (e: any) {
      setDeleteMessage(e.message || "削除に失敗しました");
    }
    setDeleteLoading(false);
  };

  const isSnsLogin = provider === "google" || provider === "twitter";
  const isGuest = provider === "anonymous" || provider === "unknown";
  const isEmailLogin = !isSnsLogin && !isGuest;

  if (pageLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">アカウント設定</h1>

        {/* メールアドレス */}
        <section className={"bg-card border border-border rounded-lg p-4 mb-4" + (isGuest ? " opacity-50" : "")}>
          <h2 className="text-sm font-medium mb-3">メールアドレス</h2>
          <div className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-muted-foreground">
            {isGuest ? "ゲストアカウント" : (email || "未設定")}
          </div>
        </section>

        {/* ユーザー名変更 */}
        <section className={"bg-card border border-border rounded-lg p-4 mb-4" + (isGuest ? " opacity-50" : "")}>
          <h2 className="text-sm font-medium mb-3">ユーザー名</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isGuest}
              className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder="ユーザー名"
            />
            <button
              onClick={handleUpdateName}
              disabled={nameLoading || isGuest}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              保存
            </button>
          </div>
          {nameMessage && (
            <p className="text-xs text-accent mt-2">{nameMessage}</p>
          )}
        </section>

        {/* パスワード変更 */}
        <section className={"bg-card border border-border rounded-lg p-4 mb-4" + (isGuest ? " opacity-50" : "")}>
          <h2 className="text-sm font-medium mb-3">パスワード変更</h2>
          {isSnsLogin || isGuest ? (
            <p className="text-xs text-muted-foreground">
              {isSnsLogin ? "SNSログイン中のため変更できません" : "ゲストアカウントではパスワードを設定できません"}
            </p>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="現在のパスワード"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="新しいパスワード（8文字以上）"
              />
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading || !currentPassword || !newPassword}
                className="w-full rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                パスワードを変更
              </button>
            </div>
          )}
          {passwordMessage && (
            <p className="text-xs text-accent mt-2">{passwordMessage}</p>
          )}
        </section>

        {/* アカウント切替 */}
        <section className={"bg-card border border-border rounded-lg p-4 mb-4" + (isGuest ? " opacity-50" : "")}>
          <h2 className="text-sm font-medium mb-3">アカウント切替</h2>
          {isSnsLogin ? (
            <button
              onClick={handleSwitchAccount}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {provider === "google" ? "別のGoogleアカウントに切替" : "別のXアカウントに切替"}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isGuest ? "ゲストアカウントでは切替できません" : "ログアウトして別のアカウントでログインしてください"}
            </p>
          )}
          {switchMessage && (
            <p className="text-xs text-accent mt-2">{switchMessage}</p>
          )}
        </section>

        {/* ログアウト */}
        <section className="mt-8">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-red-500 text-red-500 px-4 py-3 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            ログアウト
          </button>
        </section>

        {/* アカウント削除 */}
        <section className={"mt-4 mb-8" + (isGuest ? " opacity-50" : "")}>
          {deleteStep === 0 && (
            <button
              onClick={() => { if (!isGuest) setDeleteStep(1); }}
              disabled={isGuest}
              className="w-full rounded-lg bg-red-500 text-white px-4 py-3 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              アカウントを削除
            </button>
          )}

          {deleteStep === 1 && isEmailLogin && (
            <div className="bg-card border border-red-500 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-red-500">アカウント削除の確認</p>
              <p className="text-xs text-muted-foreground">この操作は取り消せません。確認のためパスワードを入力してください。</p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="パスワードを入力"
              />
              {deleteMessage && (
                <p className="text-xs text-red-500">{deleteMessage}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteStep(0); setDeletePassword(""); setDeleteMessage(""); }}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || !deletePassword}
                  className="flex-1 rounded-lg bg-red-500 text-white px-3 py-2 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? "削除中..." : "削除する"}
                </button>
              </div>
            </div>
          )}

          {deleteStep === 1 && isSnsLogin && (
            <div className="bg-card border border-red-500 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-red-500">アカウント削除の確認</p>
              <p className="text-xs text-muted-foreground">本当にアカウントを削除しますか？この操作は取り消せません。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteStep(0); setDeleteMessage(""); }}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => setDeleteStep(2)}
                  className="flex-1 rounded-lg bg-red-500 text-white px-3 py-2 text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  削除する
                </button>
              </div>
            </div>
          )}

          {deleteStep === 2 && isSnsLogin && (
            <div className="bg-card border border-red-500 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-red-500">最終確認</p>
              <p className="text-xs text-muted-foreground">全てのデータが完全に削除されます。本当に削除しますか？</p>
              {deleteMessage && (
                <p className="text-xs text-red-500">{deleteMessage}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteStep(0); setDeleteMessage(""); }}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="flex-1 rounded-lg bg-red-500 text-white px-3 py-2 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? "削除中..." : "完全に削除する"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <BottomNav />
    </>
  );
}
