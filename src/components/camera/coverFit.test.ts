import { describe, expect, it } from "vitest";
import { computeCoverCrop, computeCoverTransform } from "./coverFit";

describe("object-cover normalized transform", () => {
  it("crops the sides of landscape video in a portrait preview", () => {
    const result = computeCoverTransform(1280, 720, 360, 720);
    expect(result).toEqual({ scaleX: 32 / 9, scaleY: 1, offsetX: 23 / 64, offsetY: 0 });
    expect((0.5 - result.offsetX) * result.scaleX).toBe(0.5);
  });
  it("crops top and bottom of portrait video in a landscape preview", () => {
    expect(computeCoverTransform(720, 1280, 720, 360)).toEqual({ scaleX: 1, scaleY: 32 / 9, offsetX: 0, offsetY: 23 / 64 });
  });
  it("leaves matching aspect ratios unchanged", () => {
    expect(computeCoverTransform(1280, 720, 640, 360)).toEqual({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 });
  });
});

describe("object-cover pixel crop", () => {
  it.each([
    [1280, 720, 360, 720, { sx: 460, sy: 0, sw: 360, sh: 720 }],
    [720, 1280, 720, 360, { sx: 0, sy: 460, sw: 720, sh: 360 }],
    [1280, 720, 640, 360, { sx: 0, sy: 0, sw: 1280, sh: 720 }],
    [1279, 721, 390, 844, { sx: 473, sy: 0, sw: 333, sh: 721 }],
    [721, 1279, 844, 390, { sx: 0, sy: 473, sw: 721, sh: 333 }],
  ] as const)("crops %sx%s into %sx%s with integer rounding", (sw, sh, pw, ph, expected) => {
    expect(computeCoverCrop(sw, sh, pw, ph)).toEqual(expected);
  });
});
