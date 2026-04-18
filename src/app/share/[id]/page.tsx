import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

async function resolveAppUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (host) {
    const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: share } = await supabase
    .from("shares")
    .select("share_type, share_data, image_url")
    .eq("id", id)
    .single();

  if (!share) {
    return { title: "デュエプレトラッカー" };
  }

  const appUrl = await resolveAppUrl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageUrl = (share as any).image_url as string | null | undefined;
  const ogImageUrl = imageUrl ?? `${appUrl}/api/og/${id}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = share.share_data as any;
  let title: string;
  let description: string;

  if (share.share_type === "stats") {
    title = `勝率 ${d.winRate}% - 戦績サマリー`;
    description = `${d.totalWins}勝${d.totalLosses}敗 | ${d.period}`;
  } else if (share.share_type === "deck") {
    title = `${d.deckName} 勝率 ${d.winRate}%`;
    description = `${d.totalWins}勝${d.totalLosses}敗 | ${d.period}`;
  } else {
    title = `vs ${d.deckName} 勝率 ${d.winRate}%`;
    description = `${d.totalWins}勝${d.totalLosses}敗 | ${d.period}`;
  }

  return {
    title: `${title} | デュエプレトラッカー`,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SharePage() {
  redirect("/auth");
}
