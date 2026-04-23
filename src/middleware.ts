import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_GAME, isGameSlug } from "@/lib/games";

// 旧URL（ゲーム導入前）をスラッグ付きパスへ 308 リダイレクト対象
const LEGACY_ROOTS = ["/home", "/battle", "/decks", "/stats"];

export async function middleware(request: NextRequest) {
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
