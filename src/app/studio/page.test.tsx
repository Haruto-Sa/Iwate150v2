import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StudioPage from "./page";

const state = vi.hoisted(() => ({ signedIn: true, role: "admin", stats: vi.fn(), users: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => state.signedIn ? { user: { id: "A", role: "admin" } } : null }));
vi.mock("@/lib/authServer", () => ({ fetchAppUserByIdentity: async () => ({ id: 1, role: state.role, email: null, display_name: "Traveler" }) }));
vi.mock("@/lib/adminDashboard", () => ({ fetchAdminDashboardStats: state.stats, fetchManageableUsers: state.users }));
vi.mock("@/components/studio/StudioNav", () => ({ StudioNav: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("not-found"); },
  redirect: () => { throw new Error("denied"); },
}));

beforeEach(() => {
  state.signedIn = true; state.role = "admin";
  state.stats.mockReset().mockResolvedValue({ totalUsers: null, totalAdmins: null, totalSpots: 0, totalEvents: 4 });
  state.users.mockReset().mockResolvedValue([]);
});

describe("管理ダッシュボードの認可と表示", () => {
  it("未認証では集計を取得しない", async () => {
    state.signedIn = false;
    await expect(StudioPage()).rejects.toThrow("not-found");
    expect(state.stats).not.toHaveBeenCalled();
    expect(state.users).not.toHaveBeenCalled();
  });
  it("JWTがadminでもDBで降格済みなら集計を取得しない", async () => {
    state.role = "user";
    await expect(StudioPage()).rejects.toThrow("denied");
    expect(state.stats).not.toHaveBeenCalled();
    expect(state.users).not.toHaveBeenCalled();
  });
  it("管理者には不明・0件・実件数を区別して表示する", async () => {
    render(await StudioPage());
    expect(screen.getAllByText("取得できません")).toHaveLength(2);
    expect(screen.getByText("0")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByRole("heading", { name: "管理", exact: true })).toBeVisible();
  });
});
