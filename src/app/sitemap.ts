import type { MetadataRoute } from "next";
import { GAME_SLUGS } from "@/lib/games";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const now = new Date();

  const legalPages: MetadataRoute.Sitemap = [
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  const gameHomes: MetadataRoute.Sitemap = GAME_SLUGS.map((slug) => ({
    url: `${base}/${slug}/home`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...gameHomes, ...legalPages];
}
