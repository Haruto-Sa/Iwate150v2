import { PageHeading } from "@/components/ui/PageHeading";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { buildPageMetadata } from "@/lib/seo";
import { PageShortcut } from "@/components/ui/PageShortcut";

export const metadata = buildPageMetadata({
  title: "Camera",
  description: "旅の思い出を楽しく残せる、VOJA IWATE のカメラ体験です。",
  path: "/camera",
});

/**
 * カメラ体験とキャラクター閲覧への導線を表示する。
 * @returns Cameraページ
 * @example <CameraPage />
 */
export default function CameraPage() {
  return (
    <div className="space-y-8">
      <PageHeading eyebrow="TRAVEL MOMENTS" title="旅の一枚を、いっしょに。" description="はじめてでも大丈夫です。カメラを許可すると、旅のガイドキャラクターと一緒に写真を撮れます。" actions={<PageShortcut target="character" />} />

      <CameraCapture />
    </div>
  );
}
