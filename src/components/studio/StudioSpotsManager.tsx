"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { MapPinned, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AdminSpotListItem, City, Genre, Spot } from "@/lib/types";

type SpotFormValues = {
  name: string;
  description: string;
  city_id: string;
  genre_id: string;
  lat: string;
  lng: string;
  image_thumb_path: string;
  image_path: string;
  model_path: string;
  reference_url: string;
};

type Props = {
  items: AdminSpotListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  cities: City[];
  genres: Genre[];
  editingSpot: Spot | null;
};

/**
 * 空のスポットフォーム値を返す。
 *
 * @returns 初期フォーム値
 * @example
 * createEmptySpotForm();
 */
function createEmptySpotForm(): SpotFormValues {
  return {
    name: "",
    description: "",
    city_id: "",
    genre_id: "",
    lat: "",
    lng: "",
    image_thumb_path: "",
    image_path: "",
    model_path: "",
    reference_url: "",
  };
}

/**
 * スポットからフォーム値を生成する。
 *
 * @param spot - 編集対象スポット
 * @returns フォーム値
 * @example
 * createSpotFormValues(spot);
 */
function createSpotFormValues(spot: Spot): SpotFormValues {
  return {
    name: spot.name,
    description: spot.description,
    city_id: String(spot.city_id),
    genre_id: String(spot.genre_id),
    lat: String(spot.lat),
    lng: String(spot.lng),
    image_thumb_path: spot.image_thumb_path ?? "",
    image_path: spot.image_path ?? "",
    model_path: spot.model_path ?? "",
    reference_url: spot.reference_url ?? "",
  };
}

/**
 * スポット管理画面の URL を構築する。
 *
 * @param page - 現在ページ
 * @param editId - 編集対象 ID
 * @returns href
 * @example
 * buildSpotsPageHref(2, 15);
 */
function buildSpotsPageHref(page: number, editId?: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (editId) params.set("edit", String(editId));
  const query = params.toString();
  return query ? `/studio/spots?${query}` : "/studio/spots";
}

/**
 * API エラーメッセージを抽出する。
 *
 * @param response - fetch response
 * @returns エラーメッセージ
 * @example
 * const message = await readErrorMessage(response);
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    return `Request failed with status ${response.status}.`;
  }
  return `Request failed with status ${response.status}.`;
}

/**
 * 緯度経度表示を整形する。
 *
 * @param value - 座標
 * @returns 小数第4位固定の文字列
 * @example
 * formatCoordinate(39.7021);
 */
function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

/**
 * Studio のスポット CRUD 管理 UI。
 *
 * @param props - 管理画面 props
 * @returns スポット管理 UI
 * @example
 * <StudioSpotsManager {...props} />
 */
export function StudioSpotsManager({
  items,
  total,
  page,
  pageSize,
  hasNext,
  cities,
  genres,
  editingSpot,
}: Props) {
  const router = useRouter();
  const [formValues, setFormValues] = useState<SpotFormValues>(
    editingSpot ? createSpotFormValues(editingSpot) : createEmptySpotForm()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isMutating || isPending;

  useEffect(() => {
    setFormValues(editingSpot ? createSpotFormValues(editingSpot) : createEmptySpotForm());
    setErrorMessage(null);
  }, [editingSpot]);

  /**
   * 単一フィールドを更新する。
   *
   * @param field - 対象フィールド
   * @param value - 新しい値
   * @returns void
   * @example
   * updateField("name", "盛岡城跡公園");
   */
  function updateField(field: keyof SpotFormValues, value: string): void {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /**
   * フォーム送信を処理する。
   *
   * @param event - フォームイベント
   * @returns void
   * @example
   * <form onSubmit={handleSubmit} />
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setErrorMessage(null);

    const payload = {
      ...formValues,
      city_id: formValues.city_id,
      genre_id: formValues.genre_id,
      lat: formValues.lat,
      lng: formValues.lng,
    };

    void (async () => {
      setIsMutating(true);
      const endpoint = editingSpot ? `/api/studio/spots/${editingSpot.id}` : "/api/studio/spots";
      const method = editingSpot ? "PATCH" : "POST";
      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          setErrorMessage(await readErrorMessage(response));
          return;
        }

        if (!editingSpot) {
          setFormValues(createEmptySpotForm());
        }

        startTransition(() => {
          router.push(buildSpotsPageHref(page));
          router.refresh();
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "スポット保存に失敗しました。");
      } finally {
        setIsMutating(false);
      }
    })();
  }

  /**
   * スポット削除を実行する。
   *
   * @param spotId - 削除対象 ID
   * @returns void
   * @example
   * handleDelete(12);
   */
  function handleDelete(spotId: number): void {
    if (!window.confirm("このスポットを削除します。元に戻せません。")) {
      return;
    }

    setErrorMessage(null);
    void (async () => {
      setIsMutating(true);
      try {
        const response = await fetch(`/api/studio/spots/${spotId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          setErrorMessage(await readErrorMessage(response));
          return;
        }

        startTransition(() => {
          router.push(buildSpotsPageHref(page));
          router.refresh();
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "スポット削除に失敗しました。");
      } finally {
        setIsMutating(false);
      }
    })();
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-[30px] border border-emerald-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              {editingSpot ? "Edit spot" : "New spot"}
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-zinc-950">
              {editingSpot ? <PencilLine className="h-5 w-5 text-emerald-700" /> : <Plus className="h-5 w-5 text-emerald-700" />}
              {editingSpot ? `スポット #${editingSpot.id} を編集` : "スポットを追加"}
            </h2>
          </div>
          {editingSpot ? (
            <Link
              href={buildSpotsPageHref(page)}
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              編集をやめる
            </Link>
          ) : null}
        </div>

        <p className="mt-3 text-sm leading-6 text-zinc-600">
          画像アップロード UI はまだ入れていないため、Storage パスは手入力します。
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm text-zinc-700">
            <span className="font-medium">名称</span>
            <input
              value={formValues.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
              placeholder="盛岡城跡公園"
              disabled={isBusy}
            />
          </label>

          <label className="block space-y-2 text-sm text-zinc-700">
            <span className="font-medium">説明</span>
            <textarea
              value={formValues.description}
              onChange={(event) => updateField("description", event.target.value)}
              className="min-h-32 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
              placeholder="見どころや補足情報"
              disabled={isBusy}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">市区町村</span>
              <select
                value={formValues.city_id}
                onChange={(event) => updateField("city_id", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                disabled={isBusy}
              >
                <option value="">選択してください</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">ジャンル</span>
              <select
                value={formValues.genre_id}
                onChange={(event) => updateField("genre_id", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                disabled={isBusy}
              >
                <option value="">選択してください</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">緯度</span>
              <input
                value={formValues.lat}
                onChange={(event) => updateField("lat", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                inputMode="decimal"
                placeholder="39.7021"
                disabled={isBusy}
              />
            </label>

            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">経度</span>
              <input
                value={formValues.lng}
                onChange={(event) => updateField("lng", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                inputMode="decimal"
                placeholder="141.1527"
                disabled={isBusy}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">サムネイル画像パス</span>
              <input
                value={formValues.image_thumb_path}
                onChange={(event) => updateField("image_thumb_path", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                placeholder="images/spots/thumb.jpg"
                disabled={isBusy}
              />
            </label>

            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">画像パス</span>
              <input
                value={formValues.image_path}
                onChange={(event) => updateField("image_path", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                placeholder="images/spots/main.jpg"
                disabled={isBusy}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">3D モデルパス</span>
              <input
                value={formValues.model_path}
                onChange={(event) => updateField("model_path", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                placeholder="models/spot.glb"
                disabled={isBusy}
              />
            </label>

            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">参照 URL</span>
              <input
                value={formValues.reference_url}
                onChange={(event) => updateField("reference_url", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                placeholder="https://example.com"
                disabled={isBusy}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="min-w-40 justify-center" disabled={isBusy}>
              {editingSpot ? "更新する" : "作成する"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-w-32 justify-center"
              disabled={isBusy}
              onClick={() =>
                setFormValues(editingSpot ? createSpotFormValues(editingSpot) : createEmptySpotForm())
              }
            >
              リセット
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-[30px] border border-emerald-900/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Spot records</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-zinc-950">
              <MapPinned className="h-5 w-5 text-emerald-700" />
              登録スポット一覧
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {from} - {to} / {total}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {items.length > 0 ? (
            items.map((spot) => {
              const isActive = editingSpot?.id === spot.id;
              return (
                <article
                  key={spot.id}
                  className={`rounded-[24px] border p-4 transition ${
                    isActive
                      ? "border-emerald-400 bg-emerald-50/70"
                      : "border-zinc-200 bg-zinc-50/70 hover:border-emerald-200"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-lg font-semibold text-zinc-950">{spot.name}</p>
                        <p className="mt-1 text-sm text-zinc-600">
                          {spot.city?.name ?? "市区町村未設定"} / {spot.genre?.name ?? "ジャンル未設定"}
                        </p>
                      </div>
                      <dl className="grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-zinc-800">緯度</dt>
                          <dd>{formatCoordinate(spot.lat)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-zinc-800">経度</dt>
                          <dd>{formatCoordinate(spot.lng)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={buildSpotsPageHref(page, spot.id)}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-900/10 transition hover:bg-emerald-50"
                      >
                        <PencilLine className="h-4 w-4" />
                        編集
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(spot.id)}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-50"
                        disabled={isBusy}
                      >
                        <Trash2 className="h-4 w-4" />
                        削除
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
              表示できるスポットがありません。
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-5">
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildSpotsPageHref(page - 1)}
                className="inline-flex rounded-full px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
              >
                前へ
              </Link>
            ) : (
              <span className="inline-flex rounded-full px-4 py-2 text-sm font-medium text-zinc-400 ring-1 ring-zinc-100">
                前へ
              </span>
            )}
            {hasNext ? (
              <Link
                href={buildSpotsPageHref(page + 1)}
                className="inline-flex rounded-full px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
              >
                次へ
              </Link>
            ) : (
              <span className="inline-flex rounded-full px-4 py-2 text-sm font-medium text-zinc-400 ring-1 ring-zinc-100">
                次へ
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">固定 {pageSize} 件 / ページ</p>
        </div>
      </section>
    </div>
  );
}
