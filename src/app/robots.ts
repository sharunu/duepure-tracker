import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api", "/auth"],
    },
    sitemap: "http://54.152.11.99:3000/sitemap.xml",
  };
}
