import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/cf-env";
import { runLimitlessSync } from "@/lib/pokepoke/limitless-sync";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const jwt = authHeader?.replace("Bearer ", "");
  if (!jwt) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "no_bearer" },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = await getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error", reason: "missing_env" },
      { status: 500 },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(jwt);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "invalid_jwt" },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json(
      { error: "Forbidden", reason: `profile_error:${profileError.message}` },
      { status: 403 },
    );
  }

  if (!profile?.is_admin) {
    return NextResponse.json(
      { error: "Forbidden", reason: "not_admin" },
      { status: 403 },
    );
  }

  const result = await runLimitlessSync({ force: false });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
