import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * `/studio` 配下共通のルートレイアウト。
 *
 * `/studio/access` を維持するため、この階層では認証判定を行わない。
 *
 * @param props - レイアウト props
 * @returns children
 * @example
 * <StudioRootLayout><div /></StudioRootLayout>
 */
export default function StudioRootLayout({ children }: Props) {
  return children;
}

