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
            <span className={"inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium " + (
              isSnsLogin
                ? "bg-[#1a2744] text-[#5b8def]"
                : "bg-[#2a1f44] text-[#9b7bef]"
            )}>
              {provider === "google" ? "Google" : provider === "twitter" ? "X" : isGuest ? "ゲスト" : "メール"}
            </span>
          </div>
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
          </div>
        </div>

        {/* セキュリティセクション */}
        <div className="mt-5">
          <p className="text-[12px] text-gray-500 mb-2">セキュリティ</p>
          <div className={"bg-[#232640] rounded-[10px]" + (isGuest ? " opacity-50" : "")}>
            {/* パスワード変更行 */}
            <div className="px-4 py-[14px]">
              {isSnsLogin || isGuest ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px]">パスワード変更</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {isSnsLogin ? "SNSログイン中のため変更できません" : "ゲストアカウントではパスワードを設定できません"}
                    </p>
                  </div>
                  <span className="text-[10px] bg-[#1e2138] text-[#555577] px-2 py-0.5 rounded-full flex-shrink-0 ml-2">無効</span>
                </div>
              ) : (
                <div>
                  <p className="text-[14px] mb-3">パスワード変更</p>
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none"
                      style={{ border: "0.5px solid #333355" }}
                      placeholder="現在のパスワード"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none"
                      style={{ border: "0.5px solid #333355" }}
                      placeholder="新しいパスワード（8文字以上）"
                    />
                    <button
                      onClick={handleChangePassword}
                      disabled={passwordLoading || !currentPassword || !newPassword}
                      className="w-full bg-[#3d4070] text-white rounded-[6px] px-3 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      パスワードを変更
                    </button>
                  </div>
                  {passwordMessage && (
                    <p className="text-xs text-accent mt-2">{passwordMessage}</p>
                  )}
                </div>
              )}
            </div>
            {/* 区切り線 */}
            <div className="mx-4 border-t" style={{ borderColor: "rgba(100,100,150,0.2)", borderWidth: "0.5px" }} />
            {/* アカウント切替行 */}
            <div
              className={"px-4 py-[14px] flex items-center justify-between" + (isSnsLogin ? " cursor-pointer" : "")}
              onClick={isSnsLogin ? handleSwitchAccount : undefined}
            >
              <div>
                <p className="text-[14px]">アカウント切替</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {isSnsLogin
                    ? (provider === "google" ? "別のGoogleアカウントに切り替え" : "別のXアカウントに切り替え")
                    : isGuest
                      ? "ゲストアカウントでは切替できません"
                      : "ログアウトして別のアカウントでログインしてください"}
                </p>
              </div>
              <span className="text-gray-500 text-[18px] ml-2 flex-shrink-0">&rsaquo;</span>
            </div>
            {switchMessage && (
              <p className="text-xs text-accent px-4 pb-3">{switchMessage}</p>
            )}
          </div>
        </div>

        {/* その他セクション */}
        <div className="mt-5">
          <p className="text-[12px] text-gray-500 mb-2">その他</p>
          <div className="space-y-3">
            {/* ログアウト */}
            <div
              className="bg-[#232640] rounded-[10px] px-4 py-[14px] flex items-center justify-between cursor-pointer"
              onClick={handleLogout}
            >
              <p className="text-[14px]">ログアウト</p>
              <span className="text-gray-500 text-[18px]">&rsaquo;</span>
            </div>

                        {/* アカウント削除 */}
            {deleteStep === 0 && isEmailLogin && (
              <div
                className="rounded-[10px] px-4 py-[14px] flex items-center justify-between cursor-pointer"
                style={{
                  backgroundColor: "rgba(232,93,117,0.06)",
                  border: "0.5px solid rgba(232,93,117,0.2)",
                }}
                onClick={() => { if (window.confirm('本当にアカウントを削除しますか？')) setDeleteStep(1); }}
              >
                <div>
                  <p className="text-[14px] text-[#e85d75]">アカウントを削除</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">すべてのデータが完全に削除されます</p>
                </div>
                <span className="text-[#e85d75] text-[18px] flex-shrink-0">&rsaquo;</span>
              </div>
            )}

            {deleteStep === 1 && isEmailLogin && (
              <div className="bg-[#232640] rounded-[10px] px-4 py-[14px] space-y-3" style={{ border: "0.5px solid rgba(232,93,117,0.4)" }}>
                <p className="text-[14px] font-medium text-[#e85d75]">アカウント削除の確認</p>
                <p className="text-[11px] text-gray-500">この操作は取り消せません。確認のためパスワードを入力してください。</p>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-[#1a1d2e] rounded-[6px] px-3 py-2 text-[14px] focus:outline-none"
                  style={{ border: "0.5px solid #333355" }}
                  placeholder="パスワードを入力"
                />
                {deleteMessage && (
                  <p className="text-xs text-[#e85d75]">{deleteMessage}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteStep(0); setDeletePassword(""); setDeleteMessage(""); }}
                    className="flex-1 bg-[#1a1d2e] text-gray-400 rounded-[6px] px-3 py-2 text-[13px] hover:opacity-80"
                    style={{ border: "0.5px solid #333355" }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || !deletePassword}
                    className="flex-1 bg-[#e85d75] text-white rounded-[6px] px-3 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {deleteLoading ? "削除中..." : "削除する"}
                  </button>
                </div>
              </div>
            )}




          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
