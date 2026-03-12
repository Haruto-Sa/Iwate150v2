import type { ReactNode } from "react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Stamps",
  description: "旧 Stamps ルートです。最新の公開導線は /stamps を利用してください。",
  path: "/stamp",
  noIndex: true,
});

export default function StampLayout({ children }: { children: ReactNode }) {
  return children;
}
