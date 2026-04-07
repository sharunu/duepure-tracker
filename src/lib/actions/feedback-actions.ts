import { createClient } from "@/lib/supabase/client";

export async function submitFeedback(
  category: "bug" | "feature" | "other",
  message: string
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { error } = await supabase
    .from("feedback")
    .insert({ user_id: user.id, category, message });

  if (error) throw error;
}
