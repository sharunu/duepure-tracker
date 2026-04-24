import { NextResponse } from "next/server";

/**
 * 旧 refresh-guilds API。discord_connections を game_title なしで取得していたため、
 * 複数ゲーム連携時にゲーム混線リスクがあった。一般公開前のセキュリティハードニングで閉塞。
 * 現行は /api/discord/refresh-guilds（新方式、game_title 絞り付き）を使用。
 */
export function POST() {
  return NextResponse.json(
    { error: "gone", message: "This endpoint has been deprecated. Use /api/discord/refresh-guilds." },
    { status: 410 },
  );
}
