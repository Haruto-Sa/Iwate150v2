import { buildSpotSlug, extractSpotIdFromSlug, getSpotHref, slugifySpotName } from "@/lib/spotRoutes";
import { describe, expect, it } from "vitest";

describe("spotRoutes", () => {
  it("builds readable spot slugs", () => {
    expect(slugifySpotName("Morioka Castle Park")).toBe("morioka-castle-park");
    expect(buildSpotSlug({ id: 12, name: "Morioka Castle Park" })).toBe("12-morioka-castle-park");
    expect(getSpotHref({ id: 12, name: "Morioka Castle Park" })).toBe("/spots/12-morioka-castle-park");
  });

  it("extracts spot ids safely", () => {
    expect(extractSpotIdFromSlug("12-morioka-castle-park")).toBe(12);
    expect(extractSpotIdFromSlug("hello")).toBeNull();
  });
});
