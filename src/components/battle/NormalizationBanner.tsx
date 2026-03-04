"use client";

import { useState } from "react";
import { submitVote } from "@/lib/actions/vote-actions";

type Props = {
  vote: {
    candidate_id: string;
    raw_name: string;
    compare_to: string;
    same_count: number;
    diff_count: number;
  };
};

export function NormalizationBanner({ vote }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (submitted) return null;

  const handleVote = async (answer: "same" | "different") => {
    setLoading(true);
    try {
      await submitVote(vote.candidate_id, answer);
      setSubmitted(true);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-accent/10 border border-accent/30 p-4 space-y-3">
      <p className="text-sm">
        <span className="font-medium text-accent">「{vote.raw_name}」</span>
        と
        <span className="font-medium text-accent">「{vote.compare_to}」</span>
        は同じデッキですか？
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handleVote("same")}
          disabled={loading}
          className="flex-1 rounded-lg border border-success/50 bg-success/10 text-success py-2 text-sm font-medium hover:bg-success/20 min-h-[44px] disabled:opacity-50"
        >
          同じ
        </button>
        <button
          onClick={() => handleVote("different")}
          disabled={loading}
          className="flex-1 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive py-2 text-sm font-medium hover:bg-destructive/20 min-h-[44px] disabled:opacity-50"
        >
          違う
        </button>
      </div>
    </div>
  );
}
