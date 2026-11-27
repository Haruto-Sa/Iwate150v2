import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readLimitedJson } from "./apiGuards";

afterEach(() => vi.useRealTimers());
describe("readLimitedJson", () => {
  it("UTF-8バイト境界まで受け付け、1バイト超過を拒否する", async () => {
    const body = JSON.stringify({ text: "あ" });
    const size = new TextEncoder().encode(body).length;
    const request = () => new Request("https://app.example", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    await expect(readLimitedJson(request(), ["text"], size)).resolves.toEqual({ text: "あ" });
    await expect(readLimitedJson(request(), ["text"], size - 1)).rejects.toMatchObject({ status: 413 });
  });
  it("終わらない本文を5秒で取消し408を返す", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const request = { headers: new Headers({ "content-type": "application/json" }), body } as Request;
    const result = expect(readLimitedJson(request, ["text"])).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(5000);
    await result;
    expect(cancel).toHaveBeenCalledOnce();
  });
});
