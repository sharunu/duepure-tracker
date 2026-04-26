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

type RateLimitDiagnostic = {
  binding: "present" | "missing";
  result: "success" | "blocked" | "error";
  errorMsg?: string;
  ip: string;
};

async function checkRateLimit(
  request: NextRequest
): Promise<{ response: NextResponse | null; diagnostic: RateLimitDiagnostic }> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const limiter = await getRateLimiter();
  if (!limiter) {
    return { response: null, diagnostic: { binding: "missing", result: "success", ip } };
  }
  try {
    const { success } = await limiter.limit({ key: ip });
    if (!success) {
      return {
        response: new NextResponse("Too Many Requests", {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-Ratelimit-Binding": "present",
            "X-Ratelimit-Result": "blocked",
            "X-Ratelimit-Ip": ip,
          },
        }),
        diagnostic: { binding: "present", result: "blocked", ip },
      };
    }
    return { response: null, diagnostic: { binding: "present", result: "success", ip } };
  } catch (err) {
    // limit 呼び出しが何かの理由で失敗した場合、本番障害を引き起こさないよう素通し
    const msg = err instanceof Error ? err.message : "unknown";
    return {
      response: null,
      diagnostic: { binding: "present", result: "error", errorMsg: msg.slice(0, 80), ip },
    };
  }
}

// 一時的な診断ヘッダ。原因切り分け後に削除する
function applyDiagnosticHeaders(response: NextResponse, diagnostic: RateLimitDiagnostic): NextResponse {
  response.headers.set("X-Ratelimit-Binding", diagnostic.binding);
  response.headers.set("X-Ratelimit-Result", diagnostic.result);
  response.headers.set("X-Ratelimit-Ip", diagnostic.ip);
  if (diagnostic.errorMsg) response.headers.set("X-Ratelimit-Error", diagnostic.errorMsg);
  return response;
}

export async function middleware(request: NextRequest) {
  // 0) Rate limit (Next.js App Router DoS GHSA-q4gf-8mx6-v5v3 暫定緩和)
  //    Cloudflare Workers Rate Limiting binding 経由で IP 単位の per-minute 制限
  const { response: rateLimitResponse, diagnostic } = await checkRateLimit(request);
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
    return applyDiagnosticHeaders(NextResponse.redirect(newUrl, 308), diagnostic);
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
    return applyDiagnosticHeaders(NextResponse.redirect(newUrl, 308), diagnostic);
  }

  return applyDiagnosticHeaders(supabaseResponse, diagnostic);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
