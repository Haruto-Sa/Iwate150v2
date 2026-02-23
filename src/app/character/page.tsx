"use client";
/* eslint-disable react-compiler/react-compiler */
"use no memo";

import { useEffect, useMemo, useState } from "react";
import { characters } from "@/lib/characters";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Button } from "@/components/ui/Button";
import { Sparkles, Image as ImageIcon, MapPin } from "lucide-react";
import Image from "next/image";
import { CharacterViewer } from "@/components/character/CharacterViewer";
import { getImageUrl } from "@/lib/storage";
import { resolveClientStorageUrl } from "@/lib/storageSignedClient";

/** サムネイル Storage URL 解決のタイムアウト（ミリ秒） */
const STORAGE_RESOLVE_TIMEOUT_MS = 20_000;

/**
 * 候補URL配列を重複なく組み立てる。
 *
 * @param values - URL候補
 * @returns 重複除去済みURL配列
 * @example
 * const urls = buildUniqueCandidates([localUrl]);
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

/**
 * サムネイル画像のみタイムアウト付きで Storage URL を解決する。
 *
 * @param path - Storage path
 * @returns 解決済みURL。失敗/タイムアウト時は null
 * @example
 * const url = await resolveThumbnailWithTimeout("images/other/wanko.png");
 */
function resolveThumbnailWithTimeout(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return Promise.resolve(null);
  return Promise.race([
    resolveClientStorageUrl(path, "image"),
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[character] thumbnail resolve timeout for ${path}`);
        resolve(null);
      }, STORAGE_RESOLVE_TIMEOUT_MS),
    ),
  ]);
}

/**
 * キャラクターページ。
 *
 * 選択中キャラクターを大きく表示し、切り替えボタンで表示対象を変更できる。
 *
 * @returns CharacterPage コンポーネント
 * @example
 * return <CharacterPage />;
 */
export default function CharacterPage() {
  const [selectedId, setSelectedId] = useState<string | null>(characters[0]?.id ?? null);
  const [resolvedThumbnailUrl, setResolvedThumbnailUrl] = useState<string | null>(null);

  const selected = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? characters[0] ?? null,
    [selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!selected) return;

    setResolvedThumbnailUrl(null);

    resolveThumbnailWithTimeout(selected.thumbnail)
      .then((url) => {
        if (cancelled) return;
        setResolvedThumbnailUrl(url);
      })
      .catch((error) => {
        console.warn("[character] thumbnail resolve failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!selected) {
    return (
      <div className="space-y-6">
        <SectionTitle
          label="ゆるキャラ"
          description="キャラクター情報を準備中です。"
          icon={Sparkles}
        />
      </div>
    );
  }

  const modelCandidates = buildUniqueCandidates([
    toLocalAssetUrl(selected.model_path),
  ]);
  const mtlCandidates = buildUniqueCandidates([
    toLocalAssetUrl(selected.mtl_path),
  ]);
  const thumbnailUrl = resolvedThumbnailUrl ?? getImageUrl(selected.thumbnail);

  return (
    <div className="space-y-6">
      <SectionTitle
        label="ゆるキャラ"
        description="お気に入りのキャラクターを選んで、3Dモデルをじっくり操作できます。"
        icon={Sparkles}
      />

      <section className="rounded-3xl border border-emerald-900/10 bg-white p-4 shadow-xl ring-1 ring-emerald-900/10 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem),1fr] lg:items-start">
          <div className="space-y-3">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-b from-[#eef3f1] to-emerald-50">
              <CharacterViewer
                characterId={selected.id}
                modelCandidates={modelCandidates}
                mtlCandidates={mtlCandidates}
                renderProfile={selected.renderProfile}
                controlsPlacement="bottom"
                candidateRetryCount={2}
                autoRetryCount={1}
                className="h-full min-h-0"
              />
            </div>
            <p className="text-xs text-emerald-900/65">
              画面下のボタンで拡大・縮小・回転を操作できます。
            </p>
          </div>

          <div className="space-y-4">
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
                <p className="text-base font-semibold text-emerald-950">{selected.name}</p>
                <p className="inline-flex items-center gap-1 text-xs text-emerald-900/70">
                  <MapPin className="h-3.5 w-3.5" />
                  {selected.region}
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-emerald-900/85">{selected.description}</p>

            <div className="flex flex-wrap gap-2">
              {(selected.tags ?? []).map((tag) => (
                <span
                  key={`${selected.id}-${tag}`}
                  className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-900/10 bg-white p-3 ring-1 ring-emerald-900/10">
        <p className="mb-2 text-sm text-emerald-900/80">キャラクターを選ぶ</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {characters.map((character) => {
            const active = character.id === selected.id;
            return (
              <Button
                key={character.id}
                variant={active ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedId(character.id)}
                className="text-left"
              >
                <div>
                  <p className="text-sm font-semibold">{character.name}</p>
                  <p className="text-xs opacity-70">{character.region}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
