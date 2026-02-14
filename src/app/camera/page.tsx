import { CameraCapture } from "@/components/camera/CameraCapture";

export default function CameraPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 text-sm text-emerald-900/80 ring-1 ring-emerald-900/10 shadow-sm">
        カメラを許可するとすぐに撮影できます。撮影後は自動で編集画面へ移動します。
      </div>

      <CameraCapture />
    </div>
  );
}
