import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runLimitlessSync } from "@/lib/pokepoke/limitless-sync";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", reason: "no_session" },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
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
