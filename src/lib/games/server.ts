/**
 * Server component から game スラッグ→メタを取得するヘルパー。
 * /share/[id] や /api/og/[id] など、URL 上にゲームスラッグが無いパスで使う。
 */

import { GAMES, DEFAULT_GAME, isGameSlug, type GameSlug, type GameMeta } from "./index";

export function getGameMetaBySlug(slug: string | null | undefined): GameMeta {
  if (isGameSlug(slug)) return GAMES[slug];
  return GAMES[DEFAULT_GAME];
}

export function normalizeGameTitle(value: string | null | undefined): GameSlug {
  return isGameSlug(value) ? value : DEFAULT_GAME;
}
