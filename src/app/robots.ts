import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * robots.txt を生成する。
 *
 * @returns robots config
 * @example
 * robots();
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/map", "/search", "/character", "/camera", "/spots"],
        disallow: ["/login", "/favorites", "/studio", "/admin", "/camera/edit", "/auth/callback"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
