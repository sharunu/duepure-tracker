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
    const source = user.app_metadata?.provider === "twitter" ? "login" : "linked";
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

export async function unlinkXAccount(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ x_user_id: null, x_username: null })
    .eq("id", user.id);
}

export async function getUserStage(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 2;
  const { data } = await supabase
    .from("profiles").select("stage").eq("id", user.id).single();
  return data?.stage ?? 2;
}
