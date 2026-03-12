import type { ReactNode } from "react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Character",
  description: "岩手の旅をもっと楽しくするキャラクターを 3D で見られるページです。",
  path: "/character",
});

export default function CharacterLayout({ children }: { children: ReactNode }) {
  return children;
}
