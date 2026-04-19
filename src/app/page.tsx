import { cookies } from "next/headers";
import { redirect, permanentRedirect } from "next/navigation";
import { DEFAULT_GAME, isGameSlug } from "@/lib/games";

export default async function Home() {
  const cookieStore = await cookies();
  const saved = cookieStore.get("selectedGame")?.value;
  const game = isGameSlug(saved) ? saved : DEFAULT_GAME;
  // 308 permanent で /{game}/home に遷移
  permanentRedirect(`/${game}/home`);
  // (permanentRedirect throws, fallback never hit)
  redirect(`/${game}/home`);
}
