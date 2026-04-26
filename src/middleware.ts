import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_GAME, isGameSlug } from "@/lib/games";

// 旧URL（ゲーム導入前）をスラッグ付きパスへ 308 リダイレクト対象
const LEGACY_ROOTS = ["/home", "/battle", "/decks", "/stats"];

// Cloudflare Workers Rate Limiting binding (wrangler.jsonc の ratelimits.name と一致)
type RateLimitBinding = {
  limit: (opts: { key: string }) => Promise<{ success: boolean }>;
};

// Cloudflare Workers の env binding を OpenNext 経由で取得。
// ローカル dev (next dev) や `@opennextjs/cloudflare` 未ロード環境では undefined を返し、rate limit を素通し。
async function getRateLimiter(): Promise<RateLimitBinding | undefined> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = mod.getCloudflareContext?.();
    const env = ctx?.env as Record<string, unknown> | undefined;
    return env?.NEXTJS_DOS_LIMITER as RateLimitBinding | undefined;
  } catch {
    return undefined;
  }
}

async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const limiter = await getRateLimiter();
  if (!limiter) return null;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    const { success } = await limiter.limit({ key: ip });
    if (!success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
    return null;
  } catch {
    // limit 呼び出しが何かの理由で失敗した場合、本番障害を引き起こさないよう素通し
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // 0) Rate limit (Next.js App Router DoS GHSA-q4gf-8mx6-v5v3 暫定緩和)
  //    Cloudflare Workers Rate Limiting binding 経由で IP 単位の per-minute 制限。
  //    Cloudflare の rate limiter は best-effort (approximate) なので短期バーストは多少素通りするが、
  //    持続攻撃 (DoS の本命) には効く。完全な fix は T5 (Next.js 16.2.3+ 取り込み) 完了まで保留。
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // 1) Supabase セッション更新（既存処理を維持）
  let supabaseResponse = NextResponse.next({ request });

  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // 2) /battles 系（旧タブ）を /{game}/battle?tab=history に 308 リダイレクト
  //    /battles（スラッグ無） と /{game}/battles（統合前の履歴ページ）の両方を捕捉
  const segments = pathname.split("/").filter(Boolean);
  const isBattlesLegacy =
    (segments.length === 1 && segments[0] === "battles") ||
    (segments.length === 2 &&
      isGameSlug(segments[0]) &&
      segments[1] === "battles");
  if (isBattlesLegacy) {
    const slugFromPath =
      segments.length === 2 && isGameSlug(segments[0]) ? segments[0] : null;
    const saved = request.cookies.get("selectedGame")?.value;
    const game = slugFromPath ?? (isGameSlug(saved) ? saved : DEFAULT_GAME);
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/${game}/battle`;
    newUrl.searchParams.set("tab", "history");
    return NextResponse.redirect(newUrl, 308);
  }

  // 3) 旧URLを /{game}/... へ 308 リダイレクト
  const isLegacy = LEGACY_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(root + "/")
  );
  if (isLegacy) {
    const saved = request.cookies.get("selectedGame")?.value;
    const game = isGameSlug(saved) ? saved : DEFAULT_GAME;
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/${game}${pathname}`;
    // searchParams は nextUrl.clone() で自動的に保持される
    return NextResponse.redirect(newUrl, 308);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
