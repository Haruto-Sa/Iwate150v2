import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpotLocation } from "./SpotLocation";
import { mockSpots } from "@/lib/mockData";

vi.mock("@/components/map/LeafletMap", () => ({
  LeafletMap: () => <div data-testid="location-map" />,
}));

describe("SpotLocation", () => {
  it("所在地と地図・ルートへの操作を表示する", () => {
    render(<SpotLocation spot={mockSpots[0]} />);
    expect(screen.getByTestId("location-map")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "地図を広げる" })).toHaveAttribute("href", "/map?focus=1");
    expect(screen.getByRole("button", { name: "ルート検索" })).toBeInTheDocument();
  });

  it.each([NaN, Infinity, 91, null, undefined])("不正緯度 %s では地図を作らず関連サイトを残す", (lat) => {
    const spot = { ...mockSpots[0], lat, reference_url: "https://example.com" };
    render(<SpotLocation spot={spot as typeof mockSpots[number]} />);
    expect(screen.queryByTestId("location-map")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ルート検索" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("所在地を確認できません");
    expect(screen.getByRole("button", { name: "関連サイトを見る" })).toBeInTheDocument();
  });
});
