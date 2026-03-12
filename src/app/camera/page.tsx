import { CameraCapture } from "@/components/camera/CameraCapture";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Camera",
  description: "旅の思い出を楽しく残せる、VOJA IWATE のカメラ体験です。",
  path: "/camera",
});

export default function CameraPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 text-sm text-emerald-900/80 ring-1 ring-emerald-900/10 shadow-sm">
        はじめてでも大丈夫です。カメラを許可すると、旅のガイドキャラクターと一緒に写真を撮れます。
      </div>

      <CameraCapture />
    </div>
  );
}
