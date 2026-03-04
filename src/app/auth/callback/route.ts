import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/battle`);
    }
  }

  // OAuth 1.0a (Twitter Deprecated) はハッシュフラグメントでセッションが設定される
  // code がなくてもエラーパラメータがなければ成功の可能性がある
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=${error}`);
  }

  return NextResponse.redirect(`${origin}/battle`);
}
