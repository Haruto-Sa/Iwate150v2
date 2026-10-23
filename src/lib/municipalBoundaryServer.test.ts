import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
vi.mock("node:fs/promises", () => {
  const readFile = vi.fn();
  return { readFile, default: { readFile } };
});
const archive = readFileSync("data/municipalities/iwate-2026.json.gz");
afterEach(() => { vi.resetModules(); vi.resetAllMocks(); });

it("shares one verified dataset across concurrent calls", async () => {
  vi.mocked(readFile).mockResolvedValue(archive);
  const { loadMunicipalBoundaries } = await import("./municipalBoundaryServer");
  const [first, second] = await Promise.all([loadMunicipalBoundaries(), loadMunicipalBoundaries()]);
  expect(first).toBe(second);
  expect(first.municipalities).toHaveLength(33);
  expect(readFile).toHaveBeenCalledTimes(1);
});

it("rejects corrupt data and retries after a valid file is restored", async () => {
  vi.mocked(readFile).mockResolvedValueOnce(Buffer.from("corrupt")).mockResolvedValueOnce(archive);
  const { loadMunicipalBoundaries } = await import("./municipalBoundaryServer");
  await expect(loadMunicipalBoundaries()).rejects.toThrow("integrity check failed");
  expect((await loadMunicipalBoundaries()).municipalities).toHaveLength(33);
});

it("returns file failures to the caller instead of claiming outside the region", async () => {
  vi.mocked(readFile).mockRejectedValue(new Error("file unavailable"));
  const { locateIwateMunicipality } = await import("./municipalBoundaryServer");
  await expect(locateIwateMunicipality({ lat: 39.7, lng: 141.15 })).rejects.toThrow("file unavailable");
});
