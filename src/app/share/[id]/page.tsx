import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGameMetaBySlug } from "@/lib/games/server";
import { APP_BRAND } from "@/lib/games";

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
    .select("share_type, share_data, image_url, game_title")
    .eq("id", id)
    .single();

  if (!share) {
    return { title: APP_BRAND.name };
  }

  const appUrl = await resolveAppUrl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageUrl = (share as any).image_url as string | null | undefined;
  const ogImageUrl = imageUrl ?? `${appUrl}/api/og/${id}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = share.share_data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameTitle = (share as any).game_title as string | null | undefined;
  const gameMeta = getGameMetaBySlug(gameTitle);
  let title: string;
  let description: string;

  const dGame = (d.game as string | undefined) ?? gameTitle ?? "dm";
  const drawSuffix = dGame === "pokepoke" ? `${(d.totalDraws as number) ?? 0}分` : "";
  const wlText = `${d.totalWins}勝${d.totalLosses}敗${drawSuffix}`;
  const winRateText = d.winRate === null || d.winRate === undefined ? "--" : d.winRate;
  if (share.share_type === "stats") {
    title = `勝率 ${winRateText}% - 戦績サマリー`;
    description = `${wlText} | ${d.period}`;
  } else if (share.share_type === "deck") {
    title = `${d.deckName} 勝率 ${winRateText}%`;
    description = `${wlText} | ${d.period}`;
  } else {
    title = `vs ${d.deckName} 勝率 ${winRateText}%`;
    description = `${wlText} | ${d.period}`;
  }

  return {
    title: `${title} | ${gameMeta.trackerName}`,
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
