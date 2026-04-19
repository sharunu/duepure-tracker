import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_GAME, isGameSlug } from "@/lib/games";

// 旧URL（ゲーム導入前）をスラッグ付きパスへ 308 リダイレクト対象
const LEGACY_ROOTS = ["/home", "/battle", "/battles", "/decks", "/stats"];

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

  // 2) 旧URLを /{game}/... へ 308 リダイレクト
  const pathname = request.nextUrl.pathname;
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
