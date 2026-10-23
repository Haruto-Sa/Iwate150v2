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
      <PageHeading title="カメラ" actions={<PageShortcut target="character" />} />

      <CameraCapture />
    </div>
  );
}
