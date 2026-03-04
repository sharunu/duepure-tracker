"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getPendingVoteForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("get_pending_vote_for_user");
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  return Array.isArray(data) ? data[0] : data;
}

export async function submitVote(candidateId: string, vote: "same" | "different") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_normalization_vote", {
    p_candidate_id: candidateId,
    p_vote: vote,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/battle");
  return data;
}
