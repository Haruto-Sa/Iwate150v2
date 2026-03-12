import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudioEventsManager } from "@/components/studio/StudioEventsManager";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe("StudioEventsManager", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    vi.restoreAllMocks();
  });

  it("switches between edit and create form values", () => {
    const { rerender } = render(
      <StudioEventsManager
        items={[]}
        total={0}
        page={1}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        editingEvent={{
          id: 5,
          title: "盛岡週末ナイトマーケット",
          location: "盛岡市中央通",
          start_date: "2026-03-12",
          end_date: "2026-03-13",
          city_id: 1,
        }}
      />
    );

    expect(screen.getByDisplayValue("盛岡週末ナイトマーケット")).toBeInTheDocument();

    rerender(
      <StudioEventsManager
        items={[]}
        total={0}
        page={1}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        editingEvent={null}
      />
    );

    expect(screen.getByLabelText("タイトル")).toHaveValue("");
  });

  it("shows an API error when saving fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "end_date must be on or after start_date." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(
      <StudioEventsManager
        items={[]}
        total={0}
        page={1}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        editingEvent={null}
      />
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("タイトル"), "盛岡週末ナイトマーケット");
    await user.type(screen.getByLabelText("場所"), "盛岡市");
    await user.type(screen.getByLabelText("開始日"), "2026-03-13");
    await user.type(screen.getByLabelText("終了日"), "2026-03-12");
    await user.click(screen.getByRole("button", { name: "作成する" }));

    expect(await screen.findByText("end_date must be on or after start_date.")).toBeInTheDocument();
  });

  it("deletes an event after confirmation and refreshes the current page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
        })
      )
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <StudioEventsManager
        items={[
          {
            id: 4,
            title: "盛岡週末ナイトマーケット",
            location: "盛岡市",
            start_date: "2026-03-12",
            end_date: "2026-03-13",
            city_id: 1,
            city: { id: 1, name: "盛岡市" },
          },
        ]}
        total={1}
        page={3}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        editingEvent={null}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/studio/events?page=3");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

