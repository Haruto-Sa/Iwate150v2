import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth/AuthGate";

const mockState = {
  user: null as { id: string; email?: string | null; name?: string | null; role: "user" | "admin" | "super_admin" } | null,
  status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated",
};

vi.mock("@/components/auth/SessionProvider", () => ({
  useAuthSession: () => ({
    user: mockState.user,
    status: mockState.status,
  }),
}));

describe("AuthGate", () => {
  it("shows prompt when user is logged out", () => {
    mockState.user = null;
    mockState.status = "unauthenticated";

    render(
      <AuthGate title="Favorites" description="Save spots later.">
        <div>private area</div>
      </AuthGate>
    );

    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.queryByText("private area")).not.toBeInTheDocument();
  });

  it("renders children for authenticated users", () => {
    mockState.user = {
      id: "user_1",
      email: "demo@example.com",
      name: "Demo",
      role: "user",
    };
    mockState.status = "authenticated";

    render(
      <AuthGate title="Favorites" description="Save spots later.">
        <div>private area</div>
      </AuthGate>
    );

    expect(screen.getByText("private area")).toBeInTheDocument();
  });
});
