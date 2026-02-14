"use client";
/* eslint-disable react-compiler/react-compiler */
"use no memo";

import { useEffect, useMemo, useState } from "react";
import { characterModelCatalog, characters } from "@/lib/characters";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Sparkles, Smile, Image as ImageIcon, Box } from "lucide-react";
import Image from "next/image";
import { CharacterViewer } from "@/components/character/CharacterViewer";
import { getImageUrl, getModelUrl } from "@/lib/storage";
import { resolveClientStorageUrl } from "@/lib/storageSignedClient";

/** Storage URL 解決のタイムアウト（ミリ秒）。ハング防止用 */
const STORAGE_RESOLVE_TIMEOUT_MS = 8_000;

/**
 * 候補URL配列を重複なく組み立てる。
 *
 * @param values - URL候補
 * @returns 重複除去済みURL配列
 * @example
 * const urls = buildUniqueCandidates([signedUrl, publicUrl, localUrl]);
 */
function buildUniqueCandidates(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * Storage相対パスからローカルpublic参照URLを作成する。
 *
 * @param path - `models/...` 形式のパス
 * @returns `/models/...` 形式のURL
 * @example
 * const local = toLocalAssetUrl("models/goshodon.obj");
 */
function toLocalAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

export default function CharacterPage() {
  const [selectedId, setSelectedId] = useState<string | null>(characters[0]?.id ?? null);
  const selected = useMemo(
    () => characters.find((ch) => ch.id === selectedId) ?? characters[0] ?? null,
    [selectedId]
  );
  const modelById = useMemo(
    () => new Map(characterModelCatalog.map((m) => [m.id, m])),
    []
  );

  const selectedModel = selected ? modelById.get(selected.id) : null;
  const modelPath = selectedModel?.model_path ?? selected?.model_path ?? null;
  const mtlPath = selectedModel?.mtl_path ?? selected?.mtl_path ?? null;
  const renderProfile = selectedModel?.renderProfile ?? selected?.renderProfile;
  const thumbnailPath = selected?.thumbnail ?? null;
  const [resolvedModelUrl, setResolvedModelUrl] = useState<string | null>(null);
  const [resolvedMtlUrl, setResolvedMtlUrl] = useState<string | null>(null);
  const [resolvedThumbnailUrl, setResolvedThumbnailUrl] = useState<string | null>(null);
  /** URL 解決が完了したかどうか。false の間は CharacterViewer を描画しない */
  const [urlsReady, setUrlsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // キャラ切り替え時に前キャラの URL が残らないよう即座にリセット
    setResolvedModelUrl(null);
    setResolvedMtlUrl(null);
    setResolvedThumbnailUrl(null);
    setUrlsReady(false);

    /**
     * タイムアウト付きで Storage URL を解決する。
     * ハング防止のため STORAGE_RESOLVE_TIMEOUT_MS 経過後は null にフォールバック。
     */
    const resolveWithTimeout = (
      path: string | null | undefined,
      type: "model" | "image",
    ): Promise<string | null> => {
      if (!path) return Promise.resolve(null);
      return Promise.race([
        resolveClientStorageUrl(path, type),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            console.warn(`[character] storage resolve timeout for ${path}`);
            resolve(null);
          }, STORAGE_RESOLVE_TIMEOUT_MS),
        ),
      ]);
    };

    const resolve = async () => {
      const [modelUrl, mtlUrl, thumbnailUrl] = await Promise.all([
        resolveWithTimeout(modelPath, "model"),
        resolveWithTimeout(mtlPath, "model"),
        resolveWithTimeout(thumbnailPath, "image"),
      ]);
      if (cancelled) return;
      setResolvedModelUrl(modelUrl);
      setResolvedMtlUrl(mtlUrl);
      setResolvedThumbnailUrl(thumbnailUrl);
      setUrlsReady(true);
    };
    resolve().catch((error) => {
      console.warn("[character] storage url resolve failed", error);
      if (cancelled) return;
      setResolvedModelUrl(null);
      setResolvedMtlUrl(null);
      setResolvedThumbnailUrl(null);
      // エラー時もフォールバック URL（public / local）で表示可能にする
      setUrlsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [modelPath, mtlPath, thumbnailPath]);

  const modelCandidates = useMemo(
    () =>
      buildUniqueCandidates([
        // ローカルファイルを最優先（確実に配信される）
        toLocalAssetUrl(modelPath),
        resolvedModelUrl,
        getModelUrl(modelPath),
      ]),
    [modelPath, resolvedModelUrl]
  );
  const mtlCandidates = useMemo(
    () =>
      buildUniqueCandidates([
        // ローカルファイルを最優先
        toLocalAssetUrl(mtlPath),
        resolvedMtlUrl,
        getModelUrl(mtlPath),
      ]),
    [mtlPath, resolvedMtlUrl]
  );
  const thumbnailUrl = resolvedThumbnailUrl ?? getImageUrl(thumbnailPath);

  if (!selected) {
    return (
      <div className="space-y-8">
        <SectionTitle label="ゆるキャラ" description="モデル情報がありません。" icon={Sparkles} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        label="ゆるキャラ"
        description="カメラ画面と同様に、選択したモデルを大きく表示して操作できます。"
        icon={Sparkles}
      />

      <div className="rounded-3xl border border-emerald-900/10 bg-white p-3 shadow-2xl ring-1 ring-emerald-900/10 sm:p-5">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div className="flex items-center gap-2 text-emerald-900">
            <Smile className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold">{selected.name}</p>
              <p className="text-xs text-emerald-900/70">{selected.region}</p>
            </div>
          </div>
          {selectedModel?.model_path && (
            <p className="hidden text-xs text-emerald-900/60 sm:block">モデル: {selectedModel?.model_path ?? selected.model_path}</p>
          )}
        </div>

        <div className="relative h-[min(62vh,34rem)] min-h-[19rem] overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-b from-[#f0f2ef] to-emerald-50">
          {urlsReady && modelCandidates.length > 0 ? (
            <CharacterViewer
              key={selected.id}
              characterId={selected.id}
              modelCandidates={modelCandidates}
              mtlCandidates={mtlCandidates}
              renderProfile={renderProfile}
              controlsPlacement="bottom"
              className="h-full min-h-0"
            />
          ) : modelPath ? (
            <div className="grid h-full place-items-center text-emerald-900/60">
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="h-5 w-5 animate-pulse text-emerald-600" />
                <p className="text-xs">モデルを準備中…</p>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-emerald-900/60">3Dモデル未登録</div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl border border-emerald-900/10 bg-white p-3 ring-1 ring-emerald-900/10">
        <div className="mb-2 flex items-center gap-2 text-sm text-emerald-900/80">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          モデル選択
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {characters.map((ch) => {
            const active = ch.id === selected.id;
            return (
              <Button
                key={ch.id}
                variant={active ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedId(ch.id)}
                className="text-left"
              >
                <div>
                  <p className="text-sm font-semibold">{ch.name}</p>
                  <p className="text-xs opacity-70">{ch.region}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      <GlassCard title={`${selected.name} の情報`} icon={ImageIcon} badge={selected.region}>
        <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
          <div className="flex items-start gap-3">
            {thumbnailUrl ? (
              <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-emerald-900/10 bg-white">
                <Image src={thumbnailUrl} alt={selected.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-lg border border-emerald-900/10 bg-emerald-50 text-emerald-700">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-950">{selected.name}</p>
              <p className="text-xs text-emerald-900/70">{selected.region}</p>
              <div className="flex items-center gap-1 text-xs text-emerald-900/65">
                <Box className="h-3.5 w-3.5" />
                {selected.model_path ?? "未登録"}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-emerald-900/80">{selected.description}</p>
            <div className="flex flex-wrap gap-2">
              {(selected.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
