import { NextResponse } from "next/server";

/**
 * 旧 Discord OAuth callback。state に Supabase access_token を埋め込む設計だったため、
 * 一般公開前のセキュリティハードニングで閉塞。現行は /api/discord/callback（新方式）を使用。
 * 古い redirect URL や手動 authorize URL 経由で到達した場合は 410 Gone を返す。
 */
export function GET() {
  return NextResponse.json(
    { error: "gone", message: "This endpoint has been deprecated. Use /api/discord/callback." },
    { status: 410 },
  );
}
