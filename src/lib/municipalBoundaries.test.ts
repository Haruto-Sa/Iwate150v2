import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { locateMunicipality, type MunicipalBoundaryData, type BoundaryPoint } from "./municipalBoundaries";
import reference from "./testData/municipal-boundary-cases.json";
import manifest from "../../data/municipalities/manifest.json";

const outer: BoundaryPoint[] = [[140, 39], [142, 39], [142, 41], [140, 41], [140, 39]];
const hole: BoundaryPoint[] = [[140.5, 39.5], [141, 39.5], [141, 40], [140.5, 40], [140.5, 39.5]];
const synthetic: MunicipalBoundaryData = { version: 1, municipalities: [{ code: "a", name: "A", polygons: [{ bounds: [140, 39, 142, 41], rings: [outer, hole] }] }] };

describe("municipal polygon semantics", () => {
  it("excludes holes while retaining their boundary", () => {
    expect(locateMunicipality({ lng: 140.75, lat: 39.75 }, synthetic)).toEqual({ status: "outside" });
    expect(locateMunicipality({ lng: 140.5, lat: 39.75 }, synthetic)).toEqual({ status: "boundary", codes: ["a"] });
    const inside = locateMunicipality({ lng: 141.001, lat: 39.75 }, synthetic);
    expect(inside.status).toBe("inside");
    if (inside.status === "inside") expect(inside.boundaryDistanceMeters).toBeGreaterThan(80);
    if (inside.status === "inside") expect(inside.boundaryDistanceMeters).toBeLessThan(90);
  });
  it("does not depend on ring winding", () => {
    const reversed = structuredClone(synthetic);
    reversed.municipalities[0].polygons[0].rings.forEach(ring => ring.reverse());
    for (const point of [{ lng: 141.5, lat: 40.5 }, { lng: 140.75, lat: 39.75 }, { lng: 140, lat: 40 }]) {
      expect(locateMunicipality(point, reversed)).toEqual(locateMunicipality(point, synthetic));
    }
  });
  it("reports overlapping municipalities instead of picking the first", () => {
    const overlap = structuredClone(synthetic);
    overlap.municipalities.push({ ...overlap.municipalities[0], code: "b" });
    expect(locateMunicipality({ lng: 141.5, lat: 40.5 }, overlap)).toEqual({ status: "ambiguous", codes: ["a", "b"] });
  });
  it.each([{ lat: NaN, lng: 141 }, { lat: 39, lng: Infinity }, { lat: 91, lng: 141 }, { lat: 39, lng: -181 }])("rejects invalid coordinates %j", point => {
    expect(locateMunicipality(point, synthetic)).toEqual({ status: "invalid" });
  });
});

const compressed = readFileSync("data/municipalities/iwate-2026.json.gz");
const realData = JSON.parse(gunzipSync(compressed).toString("utf8")) as MunicipalBoundaryData;
describe("2026 Iwate boundaries against independent GEOS reference", () => {
  it("pins source, compressed data and all 33 municipality identities", () => {
    expect(createHash("sha256").update(compressed).digest("hex")).toBe(manifest.dataSha256);
    expect(reference.sourceSha256).toBe(manifest.archiveSha256);
    expect(realData.municipalities.map(({ code, name }) => ({ code, name }))).toEqual(manifest.municipalities.map(({ code, name }) => ({ code, name })));
    expect(realData.municipalities).toHaveLength(33);
    expect(realData.municipalities.flatMap(city => city.polygons)).toHaveLength(manifest.featureCount);
    expect(realData.municipalities.flatMap(city => city.polygons).reduce((sum, polygon) => sum + polygon.rings.reduce((count, ring) => count + ring.length, 0), 0)).toBe(manifest.vertexCount);
  });
  it.each(reference.cases)("$label", ({ lat, lng, status, codes }) => {
    const result = locateMunicipality({ lat, lng }, realData);
    expect(result.status).toBe(status);
    if (result.status === "inside") {
      expect([result.code]).toEqual(codes);
      expect(result.boundaryDistanceMeters).toBeGreaterThan(0);
      expect(Number.isFinite(result.boundaryDistanceMeters)).toBe(true);
    } else if (result.status === "boundary" || result.status === "ambiguous") expect(result.codes).toEqual(codes);
  });
});
