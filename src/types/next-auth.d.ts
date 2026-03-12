import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "user" | "admin" | "super_admin";
    };
  }

  interface User {
    role?: "user" | "admin" | "super_admin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "user" | "admin" | "super_admin";
    displayName?: string;
  }
}
