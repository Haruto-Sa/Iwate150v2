import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarBoard } from "./CalendarBoard";

afterEach(() => vi.useRealTimers());

describe("イベントカレンダー", () => {
  it("日付をキーボードで選ぶと複数日にまたがる予定を直下に表示し、月移動で選択を解除する", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const user = userEvent.setup();
    render(
      <CalendarBoard
        events={[
          {
            id: 1,
            title: "秋の市",
            start_date: "2026-10-15",
            end_date: "2026-10-17",
            location: "盛岡市",
          },
        ]}
      />,
    );
    const today = screen.getByRole("button", {
      name: "2026年10月16日、イベント1件",
    });
    expect(today).toHaveAttribute("aria-current", "date");
    today.focus();
    await user.keyboard("{Enter}");
    expect(today).toHaveAttribute("aria-pressed", "true");
    expect(today).toHaveFocus();
    expect(screen.getByText("秋の市")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "次の月" }));
    expect(screen.queryByText("秋の市")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "2026年11月1日、イベント0件" }),
    );
    expect(
      screen.getByText("この日に登録されたイベントはありません。"),
    ).toBeVisible();
  });
});
