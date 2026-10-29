"use client";

import Image from "next/image";
import { useState } from "react";
import { Mountain } from "lucide-react";

/**
 * 未登録・取得失敗の画像を静かなプレースホルダーに切り替える。
 * @param props - 画像URL、代替テキスト、レスポンシブサイズ
 * @returns 親の比率に合わせた画像
 * @example <div className="relative aspect-[3/2]"><TravelImage src={url} alt="龍泉洞" /></div>
 */
export function TravelImage({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, 33vw",
}: {
  src?: string | null;
  alt: string;
  sizes?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || src === failedSrc) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#e9edde] text-emerald-700">
        <Mountain className="h-9 w-9" strokeWidth={1} aria-hidden="true" />
        <span className="text-[11px] tracking-wider">写真準備中</span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className="object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}
