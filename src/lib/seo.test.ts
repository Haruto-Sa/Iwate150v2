import { buildPageMetadata, buildSpotJsonLd } from "@/lib/seo";
import { describe, expect, it } from "vitest";

describe("seo helpers", () => {
  it("builds metadata with canonical and noindex", () => {
    const metadata = buildPageMetadata({
      title: "Login",
      path: "/login",
      noIndex: true,
    });

    expect(metadata.title).toBe("Login | VOJA IWATE");
    expect(metadata.alternates?.canonical?.toString()).toContain("/login");
    expect(metadata.robots).toEqual(
      expect.objectContaining({
        index: false,
        follow: false,
      })
    );
  });

  it("creates spot json-ld graph", () => {
    const jsonLd = buildSpotJsonLd({
      id: 1,
      name: "Morioka Castle Park",
      description: "Historic park in Morioka.",
      city_id: 1,
      genre_id: 1,
      lat: 39.7,
      lng: 141.15,
    });

    expect(Array.isArray(jsonLd["@graph"])).toBe(true);
    expect(JSON.stringify(jsonLd)).toContain("TouristAttraction");
    expect(JSON.stringify(jsonLd)).toContain("BreadcrumbList");
  });
});
