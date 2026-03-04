import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  console.log("Auth callback params:", Object.fromEntries(searchParams.entries()));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("Code exchange result:", error ? error.message : "success");
    if (!error) {
      return NextResponse.redirect(`${origin}/battle`);
    }
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error.message)}`);
  }

  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (error) {
    console.log("Auth error:", error, errorDescription);
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(errorDescription || error)}`);
  }

  return NextResponse.redirect(`${origin}/battle`);
}
