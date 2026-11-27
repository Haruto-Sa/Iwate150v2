import { expect, it } from "vitest";
import { buildObservedHeaderPolicy } from "./headerPolicy";

it("公開URLのオリジンだけを使い、資格情報・パス・トークンをヘッダーへ含めない", () => {
  const policy = buildObservedHeaderPolicy({ supabaseUrl: "https://user:password@db.example:8443/path?token=secret", faceMeshAssetBase: "https://cdn.example/assets" });
  expect(policy).toContain("https://db.example:8443");
  expect(policy).toContain("https://cdn.example");
  expect(policy).not.toMatch(/password|token|secret|\/path|\/assets/);
});

it("相対アセット・不正URL・非HTTPスキームを通信先に追加しない", () => {
  const policy = buildObservedHeaderPolicy({ supabaseUrl: "javascript:alert(1)", faceMeshAssetBase: "/mediapipe/face_mesh" });
  expect(policy).toBe(buildObservedHeaderPolicy({ supabaseUrl: "invalid" }));
  expect(policy).toContain("'wasm-unsafe-eval'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toContain("report-uri");
});
