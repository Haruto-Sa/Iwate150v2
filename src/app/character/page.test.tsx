import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CharacterPage from "./page";

const viewer = vi.hoisted(() => vi.fn());
const sign = vi.hoisted(() => vi.fn());
vi.mock("@/components/character/CharacterViewer", () => ({
  CharacterViewer: (props: unknown) => { viewer(props); return <div data-testid="viewer" />; },
}));
vi.mock("@/lib/storageSignedClient", () => ({ resolveClientSignedStorageUrl: sign, resolveClientStorageUrl: async (path: string) => path }));
// eslint-disable-next-line @next/next/no-img-element -- Next画像最適化を使わないDOM検証用スタブ
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

const pending = new Map<string, (value: string) => void>();
beforeEach(() => {
  vi.clearAllMocks(); pending.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_MODE", "signed");
  sign.mockImplementation((path: string) => new Promise<string>(resolve => pending.set(path, resolve)));
});
afterEach(() => vi.unstubAllEnvs());

/**
 * 署名URL応答を、実際の非同期更新として完了する。
 * @param path - 保留中の素材パス
 * @returns なし
 * @example await resolveAsset("models/wanko1.obj");
 */
async function resolveAsset(path: string): Promise<void> {
  await act(async () => { pending.get(path)?.(`https://assets.example/${path}`); });
}

describe("キャラクター名と素材の一致", () => {
  it("切り替え直後も前の署名URLや別キャラクターを候補に含めない", async () => {
    render(<CharacterPage />);
    await resolveAsset("models/wanko1.obj");
    await resolveAsset("models/wanko1.mtl");
    await waitFor(() => expect(viewer.mock.lastCall?.[0].modelCandidates).toContain("https://assets.example/models/wanko1.obj"));
    viewer.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "カリンちゃん 遠野" }));
    expect(viewer).toHaveBeenCalled();
    for (const [props] of viewer.mock.calls) {
      expect(props.characterId).toBe("karin");
      expect(props.modelCandidates).toEqual(["/assets/characters/karin/karin.obj"]);
      expect(props.mtlCandidates).toEqual(["/assets/characters/karin/karin.mtl"]);
    }
    expect(screen.getByRole("img", { name: "カリンちゃん" })).toHaveAttribute("src", "/assets/characters/previews/karin.png");
  });

  it("遅れて返った以前の選択の応答で現在のモデルを上書きしない", async () => {
    render(<CharacterPage />);
    fireEvent.click(screen.getByRole("button", { name: "カリンちゃん 遠野" }));
    fireEvent.click(screen.getByRole("button", { name: "ケロ平 平泉" }));
    await resolveAsset("/assets/characters/karin/karin.obj");
    await resolveAsset("/assets/characters/karin/karin.mtl");
    expect(viewer.mock.lastCall?.[0]).toMatchObject({ characterId: "kerohira", modelCandidates: ["/models/kerohira1.obj"] });
    expect(screen.getByRole("img", { name: "ケロ平" })).toHaveAttribute("src", "/assets/characters/previews/kerohira.png");
  });
});
