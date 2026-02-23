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
import { resolveClientSignedStorageUrl, resolveClientStorageUrl } from "@/lib/storageSignedClient";

/** サムネイル Storage URL 解決のタイムアウト（ミリ秒） */
const STORAGE_RESOLVE_TIMEOUT_MS = 20_000;
/** Character の signed URL 解決タイムアウト（ミリ秒） */
const CHARACTER_SIGNED_RESOLVE_TIMEOUT_MS = 5_000;
/** 個別モデル読み込み失敗時に使う既定ローカルOBJ */
const DEFAULT_FALLBACK_MODEL_PATH = "models/wanko1.obj";
/** 個別モデル読み込み失敗時に使う既定ローカルMTL */
const DEFAULT_FALLBACK_MTL_PATH = "models/wanko1.mtl";

type SignedCharacterAssets = {
  modelUrl: string | null;
  mtlUrl: string | null;
};

/**
 * URL/パスから拡張子なしファイル名（小文字）を取り出す。
 *
 * @param url - URL またはパス
 * @returns ファイル名（拡張子なし）
 * @example
 * const stem = extractFileStem("/models/wanko1.obj?token=abc");
 */
function extractFileStem(url: string): string | null {
  const stripped = url.split("?")[0]?.split("#")[0] ?? url;
  const segment = stripped.split("/").pop();
  if (!segment) return null;
  const decoded = decodeURIComponent(segment);
  const dotIndex = decoded.lastIndexOf(".");
  const stem = dotIndex > 0 ? decoded.slice(0, dotIndex) : decoded;
  return stem.toLowerCase();
}

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
 * Character 用の signed URL をタイムアウト付きで解決する。
 *
 * @param characterId - ログ用キャラクターID
 * @param path - Storage path
 * @param label - ログ用ラベル
 * @returns signed URL。失敗/タイムアウト時は null
 * @example
 * const modelUrl = await resolveCharacterSignedAssetWithTimeout("sobacchi", "models/wanko1.obj", "model");
 */
async function resolveCharacterSignedAssetWithTimeout(
  characterId: string,
  path: string | null | undefined,
  label: "model" | "mtl",
): Promise<string | null> {
  if (!path) return null;
  if (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_MODE !== "signed") return null;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  const result = await Promise.race([
    resolveClientSignedStorageUrl(path, "model"),
    new Promise<string | null>((resolve) => {
      timerId = setTimeout(() => {
        console.warn(`[character] signed ${label} resolve timeout`, {
          characterId,
          path,
          timeoutMs: CHARACTER_SIGNED_RESOLVE_TIMEOUT_MS,
        });
        resolve(null);
      }, CHARACTER_SIGNED_RESOLVE_TIMEOUT_MS);
    }),
  ]);
  if (timerId !== null) clearTimeout(timerId);

  if (result) {
    console.info(`[character] signed ${label} resolved`, { characterId, path });
  } else {
    console.warn(`[character] signed ${label} unavailable, fallback to local public`, {
      characterId,
      path,
    });
  }
  return result;
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
  const [signedAssets, setSignedAssets] = useState<SignedCharacterAssets>({
    modelUrl: null,
    mtlUrl: null,
  });

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

  useEffect(() => {
    let cancelled = false;
    if (!selected) return;

    setSignedAssets({ modelUrl: null, mtlUrl: null });

    Promise.all([
      resolveCharacterSignedAssetWithTimeout(selected.id, selected.model_path, "model"),
      resolveCharacterSignedAssetWithTimeout(selected.id, selected.mtl_path, "mtl"),
    ])
      .then(([modelUrl, mtlUrl]) => {
        if (cancelled) return;
        setSignedAssets({ modelUrl, mtlUrl });
      })
      .catch((error) => {
        console.warn("[character] signed asset resolve failed", { characterId: selected.id, error });
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const modelCandidates = useMemo(
    () => {
      if (!selected) return [];
      return buildUniqueCandidates([
        signedAssets.modelUrl,
        toLocalAssetUrl(selected.model_path),
        toLocalAssetUrl(DEFAULT_FALLBACK_MODEL_PATH),
      ]);
    },
    [selected, signedAssets.modelUrl],
  );
  const mtlCandidates = useMemo(
    () => {
      if (!selected) return [];
      return buildUniqueCandidates([
        signedAssets.mtlUrl,
        toLocalAssetUrl(selected.mtl_path),
        toLocalAssetUrl(DEFAULT_FALLBACK_MTL_PATH),
      ]);
    },
    [selected, signedAssets.mtlUrl],
  );
  const thumbnailUrl = selected
    ? resolvedThumbnailUrl ?? getImageUrl(selected.thumbnail)
    : null;

  useEffect(() => {
    if (!selected) return;
    const matchedMtlByModel = modelCandidates.map((modelUrl) => {
      const modelStem = extractFileStem(modelUrl);
      const matchedMtlCandidates =
        modelStem === null
          ? []
          : mtlCandidates.filter((mtlUrl) => extractFileStem(mtlUrl) === modelStem);
      return {
        modelUrl,
        matchedMtlCandidates,
      };
    });

    console.info("[character] candidate priority", {
      characterId: selected.id,
      modelFirst: modelCandidates[0] ?? null,
      mtlFirst: mtlCandidates[0] ?? null,
      modelCandidates,
      mtlCandidates,
      matchedMtlByModel,
    });
  }, [selected, modelCandidates, mtlCandidates]);

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

  return (
    <div className="space-y-6">
      <SectionTitle
        label="ゆるキャラ"
        description="お気に入りのキャラクターを選んで、3Dモデルをじっくり操作できます。"
        icon={Sparkles}
      />

      <section className="rounded-3xl border border-emerald-900/10 bg-white p-4 shadow-xl ring-1 ring-emerald-900/10 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem),1fr] lg:items-start">
          <div className="mx-auto w-full max-w-sm space-y-3 lg:mx-0">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-b from-[#eef3f1] to-emerald-50">
              <CharacterViewer
                characterId={selected.id}
                modelCandidates={modelCandidates}
                mtlCandidates={mtlCandidates}
                renderProfile={selected.renderProfile}
                disableProfilePositionOffset
                controlsPlacement="bottom"
                candidateRetryCount={2}
                autoRetryCount={1}
                className="h-full min-h-0"
              />
            </div>
            <p className="text-center text-xs leading-relaxed text-emerald-900/65 lg:text-left">
              画面下のボタンで拡大・縮小・回転・リセットを操作できます。
            </p>
          </div>

          <div className="min-w-0 space-y-4">
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
                <p className="break-words text-base font-semibold leading-tight text-emerald-950">
                  {selected.name}
                </p>
                <p className="inline-flex items-center gap-1 text-xs text-emerald-900/70">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="break-words">{selected.region}</span>
                </p>
              </div>
            </div>

            <p className="break-words text-sm leading-relaxed text-emerald-900/85">
              {selected.description}
            </p>

            <div className="flex flex-wrap gap-2">
              {(selected.tags ?? []).map((tag) => (
                <span
                  key={`${selected.id}-${tag}`}
                  className="break-words rounded-full bg-emerald-50 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/60"
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
                className="h-full min-h-14 text-left"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-tight">{character.name}</p>
                  <p className="break-words text-xs opacity-70">{character.region}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
