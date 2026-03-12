import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudioSpotsManager } from "@/components/studio/StudioSpotsManager";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe("StudioSpotsManager", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    vi.restoreAllMocks();
  });

  it("switches between edit and create form values", () => {
    const { rerender } = render(
      <StudioSpotsManager
        items={[]}
        total={0}
        page={1}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        genres={[{ id: 1, name: "歴史" }]}
        editingSpot={{
          id: 7,
          name: "盛岡城跡公園",
          description: "説明",
          city_id: 1,
          genre_id: 1,
          lat: 39.7,
          lng: 141.1,
          image_thumb_path: null,
          image_path: null,
          model_path: null,
          reference_url: null,
        }}
      />
    );

    expect(screen.getByDisplayValue("盛岡城跡公園")).toBeInTheDocument();

    rerender(
      <StudioSpotsManager
        items={[]}
        total={0}
        page={1}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        genres={[{ id: 1, name: "歴史" }]}
        editingSpot={null}
      />
    );

    expect(screen.getByLabelText("名称")).toHaveValue("");
  });

  it("disables submit while saving and surfaces API errors", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    render(
      <StudioSpotsManager
        items={[]}
        total={0}
        page={1}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        genres={[{ id: 1, name: "歴史" }]}
        editingSpot={null}
      />
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("名称"), "新規スポット");
    await user.type(screen.getByLabelText("説明"), "説明");
    await user.selectOptions(screen.getByLabelText("市区町村"), "1");
    await user.selectOptions(screen.getByLabelText("ジャンル"), "1");
    await user.type(screen.getByLabelText("緯度"), "39.7");
    await user.type(screen.getByLabelText("経度"), "141.1");
    await user.click(screen.getByRole("button", { name: "作成する" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "作成する" })).toBeDisabled();
    });

    if (!resolveFetch) {
      throw new Error("fetch resolver was not captured");
    }
    const capturedResolve: (value: Response) => void = resolveFetch;

    capturedResolve(
      new Response(JSON.stringify({ error: "保存に失敗しました。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(await screen.findByText("保存に失敗しました。")).toBeInTheDocument();
  });

  it("deletes a spot after confirmation and refreshes the current page", async () => {
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
      <StudioSpotsManager
        items={[
          {
            id: 9,
            name: "盛岡城跡公園",
            description: "説明",
            city_id: 1,
            genre_id: 1,
            lat: 39.7,
            lng: 141.1,
            image_thumb_path: null,
            image_path: null,
            model_path: null,
            reference_url: null,
            city: { id: 1, name: "盛岡市" },
            genre: { id: 1, name: "歴史" },
          },
        ]}
        total={1}
        page={2}
        pageSize={20}
        hasNext={false}
        cities={[{ id: 1, name: "盛岡市" }]}
        genres={[{ id: 1, name: "歴史" }]}
        editingSpot={null}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/studio/spots?page=2");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
