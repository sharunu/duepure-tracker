import { createClient } from "@/lib/supabase/client";

export async function getEmail(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "";
  return user.email ?? "";
}

export async function getDisplayName(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "";

  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return data?.display_name ?? "";
}

export async function updateDisplayName(name: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);

  if (error) throw error;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("Not authenticated");

  // 現在のパスワードを検証
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) throw new Error("現在のパスワードが正しくありません");

  // 新パスワードを設定
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getAuthProvider(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "unknown";

  // 匿名ユーザーを確実に検出
  if (user.is_anonymous) return "anonymous";

  return user.app_metadata?.provider ?? "email";
}

export async function deleteAccount(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw error;
}

// --- X連携関連 ---

export async function getXConnectionStatus(): Promise<{
  isConnected: boolean;
  xUsername: string | null;
  source: "login" | "linked" | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isConnected: false, xUsername: null, source: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("x_user_id, x_username")
    .eq("id", user.id)
    .single();

  if (profile?.x_username) {
    // 実際のidentitiesを確認: Twitterが唯一のidentityの場合のみ "login"
    const identities = user.identities ?? [];
    const isTwitterOnly = identities.length > 0 && identities.every(i => i.provider === "twitter");
    const source = isTwitterOnly ? "login" : "linked";
    return { isConnected: true, xUsername: profile.x_username, source };
  }

  return { isConnected: false, xUsername: null, source: null };
}

export async function syncXAccountFromAuth(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  console.log("[syncX] identities:", user.identities?.map(i => i.provider));

  const twitterIdentity = user.identities?.find(i => i.provider === "twitter");
  if (!twitterIdentity) {
    console.log("[syncX] no twitter identity found");
    return false;
  }

  console.log("[syncX] identity_data keys:", Object.keys(twitterIdentity.identity_data ?? {}));

  const xUsername = twitterIdentity.identity_data?.user_name
    ?? twitterIdentity.identity_data?.preferred_username;
  const xUserId = twitterIdentity.identity_data?.provider_id
    ?? twitterIdentity.id;

  if (!xUsername) {
    console.log("[syncX] no xUsername in identity_data");
    return false;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ x_user_id: xUserId, x_username: xUsername })
    .eq("id", user.id);

  if (error) {
    console.log("[syncX] update error:", error);
    return false;
  }

  console.log("[syncX] success:", xUsername);
  return true;
}

export async function unlinkXAccount(): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "not_authenticated" };

  // Auth層からTwitter identityを削除
  const twitterIdentity = user.identities?.find(i => i.provider === "twitter");
  if (twitterIdentity) {
    // 唯一のidentityの場合は解除不可（ログインできなくなる）
    if (user.identities && user.identities.length <= 1) {
      return { success: false, error: "only_identity" };
    }
    const { error } = await supabase.auth.unlinkIdentity(twitterIdentity);
    if (error) return { success: false, error: error.message };
  }

  // DB更新
  await supabase
    .from("profiles")
    .update({ x_user_id: null, x_username: null })
    .eq("id", user.id);

  return { success: true };
}

export async function getUserStage(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 2;
  const { data } = await supabase
    .from("profiles").select("stage").eq("id", user.id).single();
  return data?.stage ?? 2;
}

export async function getMyQualityScore(): Promise<{
  totalScore: number;
  breakdown: Record<string, number>;
} | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("quality_score_snapshots")
    .select("total_score, breakdown")
    .eq("user_id", user.id)
    .single();
  if (!data) return null;
  return { totalScore: data.total_score, breakdown: data.breakdown as Record<string, number> };
}
