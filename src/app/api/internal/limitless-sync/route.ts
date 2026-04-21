import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/cf-env";
import { runLimitlessSync } from "@/lib/pokepoke/limitless-sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const internalKey = request.headers.get("X-Internal-Key");
  const expectedKey = await getServerEnv("INTERNAL_API_KEY");

  if (!expectedKey || internalKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runLimitlessSync({ force: true });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
