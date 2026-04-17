"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-[28px] font-medium">エラーが発生しました</h1>
          <p className="text-sm text-gray-400">
            一時的な問題が発生しました。しばらく経ってから再度お試しください。
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="rounded-[10px] px-5 py-3 text-sm font-medium bg-[#6366f1] hover:bg-[#5558e6] transition-colors"
          >
            再読み込み
          </button>
          <Link
            href="/home"
            className="rounded-[10px] px-5 py-3 text-sm font-medium bg-[#1a1d2e] hover:bg-[#232640] transition-colors"
            style={{ border: "0.5px solid #333355" }}
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
