import { describe, expect, it } from "vitest";
import { buildPagedResult, normalizePage, normalizePageSize } from "./paging";

describe("共通ページング", () => {
  it.each([[undefined, 1], [NaN, 1], [Infinity, 1], [-Infinity, 1], [0, 1], [-5, 1], [2.7, 2]])("ページ番号 %s を正規化する", (input, expected) => {
    expect(normalizePage(input)).toBe(expected);
  });
  it.each([20, 50])("呼び出し元の既定件数 %s と上下限を維持する", defaultSize => {
    for (const input of [undefined, NaN, Infinity]) expect(normalizePageSize(input, defaultSize, 100)).toBe(defaultSize);
    expect(normalizePageSize(0, defaultSize, 100)).toBe(1);
    expect(normalizePageSize(2.7, defaultSize, 100)).toBe(2);
    expect(normalizePageSize(500, defaultSize, 100)).toBe(100);
  });
  it("最終ページの境界と結果を維持する", () => {
    const items = [{ id: 2 }];
    expect(buildPagedResult(items, 40, 2, 20)).toEqual({ items, total: 40, page: 2, pageSize: 20, hasNext: false });
    expect(buildPagedResult(items, 41, 2, 20).hasNext).toBe(true);
    expect(buildPagedResult([], 0, 1, 20).hasNext).toBe(false);
    expect(buildPagedResult(items, 40, 2, 20).items).toBe(items);
  });
});
