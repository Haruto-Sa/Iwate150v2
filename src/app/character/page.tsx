"use client";
/* eslint-disable react-compiler/react-compiler */
"use no memo";

import { useEffect, useMemo, useState } from "react";
import { characters } from "@/lib/characters";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sparkles, Image as ImageIcon, MapPin, Box } from "lucide-react";
import Image from "next/image";
import { CharacterViewer } from "@/components/character/CharacterViewer";
import { getImageUrl, getModelUrl } from "@/lib/storage";
import { resolveClientStorageUrl } from "@/lib/storageSignedClient";

/** Storage URL 解決のタイムアウト（ミリ秒）。ハング防止用 */
const STORAGE_RESOLVE_TIMEOUT_MS = 8_000;

type CharacterResolvedAsset = {
  modelUrl: string | null;
  mtlUrl: string | null;
  thumbnailUrl: string | null;
};

type CharacterResolvedAssetMap = Record<string, CharacterResolvedAsset>;

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

/**
 * タイムアウト付きで Storage URL を解決する。
 *
 * @param path - Storage path
 * @param type - asset type
 * @returns 解決済みURL。失敗/タイムアウト時は null
 * @example
 * const modelUrl = await resolveWithTimeout("models/wanko1.obj", "model");
 */
function resolveWithTimeout(
  path: string | null | undefined,
  type: "model" | "image",
): Promise<string | null> {
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
}

/**
 * キャラクターIDごとの解決済みURL保持用Mapを初期化する。
 *
 * @returns 全キャラクター分を `null` で初期化したMap
 * @example
 * const initialMap = createInitialResolvedAssetMap();
 */
function createInitialResolvedAssetMap(): CharacterResolvedAssetMap {
  return Object.fromEntries(
    characters.map((character) => [
      character.id,
      { modelUrl: null, mtlUrl: null, thumbnailUrl: null } satisfies CharacterResolvedAsset,
    ]),
  );
}

/**
 * キャラクター一覧ページ。
 *
 * legacy の character 実装に合わせ、キャラクターごとに独立した Three.js ビューを表示する。
 *
 * @returns キャラクター画面
 * @example
 * return <CharacterPage />;
 */
export default function CharacterPage() {
  const [resolvedAssetsById, setResolvedAssetsById] =
    useState<CharacterResolvedAssetMap>(() => createInitialResolvedAssetMap());

  useEffect(() => {
    let cancelled = false;

    setResolvedAssetsById(createInitialResolvedAssetMap());

    Promise.all(
      characters.map(async (character) => {
        const [modelUrl, mtlUrl, thumbnailUrl] = await Promise.all([
          resolveWithTimeout(character.model_path, "model"),
          resolveWithTimeout(character.mtl_path, "model"),
          resolveWithTimeout(character.thumbnail, "image"),
        ]);

        return [
          character.id,
          {
            modelUrl,
            mtlUrl,
            thumbnailUrl,
          } satisfies CharacterResolvedAsset,
        ] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setResolvedAssetsById((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      })
      .catch((error) => {
        console.warn("[character] storage url resolve failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const modelCandidatesById = useMemo(() => {
    const entries = characters.map((character) => {
      const resolved = resolvedAssetsById[character.id];
      return [
        character.id,
        buildUniqueCandidates([
          // ローカルファイルを最優先（legacy互換の安定表示）
          toLocalAssetUrl(character.model_path),
          resolved?.modelUrl,
          getModelUrl(character.model_path),
        ]),
      ] as const;
    });

    return Object.fromEntries(entries) as Record<string, string[]>;
  }, [resolvedAssetsById]);

  const mtlCandidatesById = useMemo(() => {
    const entries = characters.map((character) => {
      const resolved = resolvedAssetsById[character.id];
      return [
        character.id,
        buildUniqueCandidates([
          // ローカルファイルを最優先（legacy互換の安定表示）
          toLocalAssetUrl(character.mtl_path),
          resolved?.mtlUrl,
          getModelUrl(character.mtl_path),
        ]),
      ] as const;
    });

    return Object.fromEntries(entries) as Record<string, string[]>;
  }, [resolvedAssetsById]);

  const thumbnailById = useMemo(() => {
    const entries = characters.map((character) => {
      const resolved = resolvedAssetsById[character.id];
      return [character.id, resolved?.thumbnailUrl ?? getImageUrl(character.thumbnail)] as const;
    });

    return Object.fromEntries(entries) as Record<string, string | null>;
  }, [resolvedAssetsById]);

  return (
    <div className="space-y-6">
      <SectionTitle
        label="ゆるキャラ"
        description="legacy の character 画面に合わせて、キャラクターごとに独立した3D表示と説明を並べています。"
        icon={Sparkles}
      />

      <div className="space-y-6">
        {characters.map((character) => {
          const modelCandidates = modelCandidatesById[character.id] ?? [];
          const mtlCandidates = mtlCandidatesById[character.id] ?? [];
          const thumbnailUrl = thumbnailById[character.id];

          return (
            <section
              key={character.id}
              className="rounded-3xl border border-emerald-900/10 bg-white p-4 shadow-xl ring-1 ring-emerald-900/10 sm:p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem),1fr] lg:items-start">
                <div className="space-y-3">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-b from-[#eef3f1] to-emerald-50">
                    {modelCandidates.length > 0 ? (
                      <CharacterViewer
                        characterId={character.id}
                        modelCandidates={modelCandidates}
                        mtlCandidates={mtlCandidates}
                        renderProfile={character.renderProfile}
                        controlsPlacement="bottom"
                        className="h-full min-h-0"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-emerald-900/65">
                        3Dモデル未登録
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-emerald-900/65">
                    拡大・縮小・回転は各キャラクターのビュー内ボタンで操作できます。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    {thumbnailUrl ? (
                      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-emerald-900/10 bg-white">
                        <Image src={thumbnailUrl} alt={character.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-lg border border-emerald-900/10 bg-emerald-50 text-emerald-700">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-base font-semibold text-emerald-950">{character.name}</p>
                      <p className="inline-flex items-center gap-1 text-xs text-emerald-900/70">
                        <MapPin className="h-3.5 w-3.5" />
                        {character.region}
                      </p>
                      <p className="inline-flex items-center gap-1 break-all text-xs text-emerald-900/65">
                        <Box className="h-3.5 w-3.5" />
                        {character.model_path ?? "未登録"}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-emerald-900/85">{character.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {(character.tags ?? []).map((tag) => (
                      <span
                        key={`${character.id}-${tag}`}
                        className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
