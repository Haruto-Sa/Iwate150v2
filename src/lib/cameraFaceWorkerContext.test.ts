import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const scope: { initializeFaceWorkerContext?: (module: unknown, canvas: unknown) => unknown } = {};
runInNewContext(readFileSync("public/mediapipe/face_mesh/worker-context.js", "utf8"), { self: scope, DOMException });
const initialize = scope.initializeFaceWorkerContext!;

describe("FaceMesh worker GL registration", () => {
  it.each([1, 2])("registers the actual WebGL %i context without relying on constructor globals", (version) => {
    const context = { VERSION: 0x1f02, getParameter: vi.fn().mockReturnValue(`WebGL ${version}.0`) };
    const canvas = { getContext: vi.fn((type: string) => type === "webgl2" && version === 1 ? null : context) };
    const GL = { registerContext: vi.fn().mockReturnValue(7), makeContextCurrent: vi.fn().mockReturnValue(true) };
    expect(initialize({ GL }, canvas)).toBe(context);
    expect(GL.registerContext).toHaveBeenCalledWith(context, { majorVersion: version, antialias: false, alpha: false });
    expect(GL.makeContextCurrent).toHaveBeenCalledWith(7);
    expect(context.getParameter).toHaveBeenCalledWith(context.VERSION);
    if (version === 1) expect(canvas.getContext).toHaveBeenNthCalledWith(2, "webgl", { antialias: false, alpha: false });
  });

  it("reports unsupported Worker WebGL without registering a missing context", () => {
    const GL = { registerContext: vi.fn(), makeContextCurrent: vi.fn() };
    expect(() => initialize({ GL }, { getContext: () => null })).toThrowError(expect.objectContaining({ name: "NotSupportedError" }));
    expect(GL.registerContext).not.toHaveBeenCalled();
    expect(GL.makeContextCurrent).not.toHaveBeenCalled();
  });

  it("does not pretend an activation failure is an unsupported feature", () => {
    const context = { VERSION: 0x1f02, getParameter: () => "WebGL 2.0" };
    const GL = { registerContext: () => 7, makeContextCurrent: () => false };
    expect(() => initialize({ GL }, { getContext: () => context })).toThrow("could not be activated");
  });
});
