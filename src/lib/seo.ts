import type { Metadata } from "next";
import type { Event, Spot } from "@/lib/types";
import {
  APP_DESCRIPTION,
  APP_OG_DESCRIPTION,
  APP_TITLE,
  MAP_PATH,
  SITE_URL,
  SPOTS_INDEX_PATH,
} from "@/lib/config";
import { buildSpotSlug } from "@/lib/spotRoutes";

type MetadataOverrides = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
};

/**
 * 公開 URL を絶対 URL へ変換する。
 *
 * @param path - 相対パス
 * @returns 絶対 URL
 * @example
 * buildAbsoluteUrl("/spots");
 */
export function buildAbsoluteUrl(path = "/"): URL {
  return new URL(path, SITE_URL);
}

/**
 * ページ共通 metadata を生成する。
 *
 * @param overrides - 上書き設定
 * @returns Next.js metadata
 * @example
 * buildPageMetadata({ title: "Map" });
 */
export function buildPageMetadata(overrides: MetadataOverrides = {}): Metadata {
  const title = overrides.title ? `${overrides.title} | ${APP_TITLE}` : `${APP_TITLE} | Iwate Travel App`;
  const description = overrides.description ?? APP_DESCRIPTION;
  const canonical = buildAbsoluteUrl(overrides.path ?? "/");
  const image = overrides.image ?? "/og/voja-iwate-default.png";

  return {
    metadataBase: buildAbsoluteUrl(),
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: overrides.description ?? APP_OG_DESCRIPTION,
      url: canonical,
      siteName: APP_TITLE,
      locale: "ja_JP",
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: overrides.noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : undefined,
  };
}

/**
 * Spot 詳細ページ用 metadata を生成する。
 *
 * @param spot - スポット
 * @param image - OGP 画像
 * @returns metadata
 * @example
 * buildSpotMetadata(spot, "/images/spot.jpg");
 */
export function buildSpotMetadata(spot: Spot, image?: string | null): Metadata {
  return buildPageMetadata({
    title: `${spot.name} | Spots`,
    description: spot.description,
    path: `${SPOTS_INDEX_PATH}/${buildSpotSlug(spot)}`,
    image: image ?? undefined,
  });
}

/**
 * Home 用の JSON-LD を返す。
 *
 * @param events - 表示中イベント
 * @returns JSON-LD オブジェクト
 * @example
 * buildHomeJsonLd(events);
 */
export function buildHomeJsonLd(events: Event[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_TITLE,
    description: APP_DESCRIPTION,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?keyword={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
    subjectOf: events.slice(0, 3).map((event) => ({
      "@type": "Event",
      name: event.title,
      location: event.location ?? "Iwate, Japan",
      startDate: event.start_date ?? undefined,
      endDate: event.end_date ?? undefined,
    })),
  };
}

/**
 * Spot 詳細ページ用 JSON-LD を返す。
 *
 * @param spot - スポット
 * @returns JSON-LD オブジェクト
 * @example
 * buildSpotJsonLd(spot);
 */
export function buildSpotJsonLd(spot: Spot): Record<string, unknown> {
  const url = buildAbsoluteUrl(`${SPOTS_INDEX_PATH}/${buildSpotSlug(spot)}`).toString();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        name: spot.name,
        description: spot.description,
        url,
      },
      {
        "@type": "Place",
        name: spot.name,
        geo: {
          "@type": "GeoCoordinates",
          latitude: spot.lat,
          longitude: spot.lng,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Map",
            item: buildAbsoluteUrl(MAP_PATH).toString(),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: spot.name,
            item: url,
          },
        ],
      },
    ],
  };
}
