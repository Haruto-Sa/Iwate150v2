import type { ReactNode } from "react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Camera Edit",
  description: "撮影後の編集画面です。",
  path: "/camera/edit",
  noIndex: true,
});

export default function CameraEditLayout({ children }: { children: ReactNode }) {
  return children;
}
