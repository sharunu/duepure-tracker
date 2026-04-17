import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-[28px] font-medium">ページが見つかりません</h1>
          <p className="text-sm text-gray-400">
            お探しのページは削除されたか、URLが間違っている可能性があります。
          </p>
        </div>
        <Link
          href="/home"
          className="inline-block rounded-[10px] px-5 py-3 text-sm font-medium bg-[#6366f1] hover:bg-[#5558e6] transition-colors"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
