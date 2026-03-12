"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { CalendarDays, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AdminEventListItem, City, Event } from "@/lib/types";

type EventFormValues = {
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  city_id: string;
};

type Props = {
  items: AdminEventListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  cities: City[];
  editingEvent: Event | null;
};

/**
 * 空のイベントフォーム値を返す。
 *
 * @returns 初期フォーム値
 * @example
 * createEmptyEventForm();
 */
function createEmptyEventForm(): EventFormValues {
  return {
    title: "",
    location: "",
    start_date: "",
    end_date: "",
    city_id: "",
  };
}

/**
 * イベントからフォーム値を生成する。
 *
 * @param event - 編集対象イベント
 * @returns フォーム値
 * @example
 * createEventFormValues(event);
 */
function createEventFormValues(event: Event): EventFormValues {
  return {
    title: event.title,
    location: event.location ?? "",
    start_date: event.start_date ?? "",
    end_date: event.end_date ?? "",
    city_id: event.city_id ? String(event.city_id) : "",
  };
}

/**
 * イベント管理画面の URL を構築する。
 *
 * @param page - 現在ページ
 * @param editId - 編集対象 ID
 * @returns href
 * @example
 * buildEventsPageHref(2, 9);
 */
function buildEventsPageHref(page: number, editId?: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (editId) params.set("edit", String(editId));
  const query = params.toString();
  return query ? `/studio/events?${query}` : "/studio/events";
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
 * 日付表示を整形する。
 *
 * @param value - 日付文字列
 * @returns 表示用テキスト
 * @example
 * formatDateLabel("2026-03-12");
 */
function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "未設定";
  return value;
}

/**
 * Studio のイベント CRUD 管理 UI。
 *
 * @param props - 管理画面 props
 * @returns イベント管理 UI
 * @example
 * <StudioEventsManager {...props} />
 */
export function StudioEventsManager({
  items,
  total,
  page,
  pageSize,
  hasNext,
  cities,
  editingEvent,
}: Props) {
  const router = useRouter();
  const [formValues, setFormValues] = useState<EventFormValues>(
    editingEvent ? createEventFormValues(editingEvent) : createEmptyEventForm()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isMutating || isPending;

  useEffect(() => {
    setFormValues(editingEvent ? createEventFormValues(editingEvent) : createEmptyEventForm());
    setErrorMessage(null);
  }, [editingEvent]);

  /**
   * 単一フィールドを更新する。
   *
   * @param field - 対象フィールド
   * @param value - 新しい値
   * @returns void
   * @example
   * updateField("title", "盛岡週末ナイトマーケット");
   */
  function updateField(field: keyof EventFormValues, value: string): void {
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
    };

    void (async () => {
      setIsMutating(true);
      const endpoint = editingEvent ? `/api/studio/events/${editingEvent.id}` : "/api/studio/events";
      const method = editingEvent ? "PATCH" : "POST";
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

        if (!editingEvent) {
          setFormValues(createEmptyEventForm());
        }

        startTransition(() => {
          router.push(buildEventsPageHref(page));
          router.refresh();
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "イベント保存に失敗しました。");
      } finally {
        setIsMutating(false);
      }
    })();
  }

  /**
   * イベント削除を実行する。
   *
   * @param eventId - 削除対象 ID
   * @returns void
   * @example
   * handleDelete(4);
   */
  function handleDelete(eventId: number): void {
    if (!window.confirm("このイベントを削除します。元に戻せません。")) {
      return;
    }

    setErrorMessage(null);
    void (async () => {
      setIsMutating(true);
      try {
        const response = await fetch(`/api/studio/events/${eventId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          setErrorMessage(await readErrorMessage(response));
          return;
        }

        startTransition(() => {
          router.push(buildEventsPageHref(page));
          router.refresh();
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "イベント削除に失敗しました。");
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
              {editingEvent ? "Edit event" : "New event"}
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-zinc-950">
              {editingEvent ? <PencilLine className="h-5 w-5 text-emerald-700" /> : <Plus className="h-5 w-5 text-emerald-700" />}
              {editingEvent ? `イベント #${editingEvent.id} を編集` : "イベントを追加"}
            </h2>
          </div>
          {editingEvent ? (
            <Link
              href={buildEventsPageHref(page)}
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              編集をやめる
            </Link>
          ) : null}
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm text-zinc-700">
            <span className="font-medium">タイトル</span>
            <input
              value={formValues.title}
              onChange={(event) => updateField("title", event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
              placeholder="盛岡週末ナイトマーケット"
              disabled={isBusy}
            />
          </label>

          <label className="block space-y-2 text-sm text-zinc-700">
            <span className="font-medium">場所</span>
            <input
              value={formValues.location}
              onChange={(event) => updateField("location", event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
              placeholder="盛岡市中央通"
              disabled={isBusy}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">開始日</span>
              <input
                type="date"
                value={formValues.start_date}
                onChange={(event) => updateField("start_date", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                disabled={isBusy}
              />
            </label>

            <label className="block space-y-2 text-sm text-zinc-700">
              <span className="font-medium">終了日</span>
              <input
                type="date"
                value={formValues.end_date}
                onChange={(event) => updateField("end_date", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
                disabled={isBusy}
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm text-zinc-700">
            <span className="font-medium">市区町村</span>
            <select
              value={formValues.city_id}
              onChange={(event) => updateField("city_id", event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500"
              disabled={isBusy}
            >
              <option value="">未設定</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="min-w-40 justify-center" disabled={isBusy}>
              {editingEvent ? "更新する" : "作成する"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-w-32 justify-center"
              disabled={isBusy}
              onClick={() =>
                setFormValues(editingEvent ? createEventFormValues(editingEvent) : createEmptyEventForm())
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Event records</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-zinc-950">
              <CalendarDays className="h-5 w-5 text-emerald-700" />
              登録イベント一覧
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {from} - {to} / {total}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {items.length > 0 ? (
            items.map((eventItem) => {
              const isActive = editingEvent?.id === eventItem.id;
              return (
                <article
                  key={eventItem.id}
                  className={`rounded-[24px] border p-4 transition ${
                    isActive
                      ? "border-emerald-400 bg-emerald-50/70"
                      : "border-zinc-200 bg-zinc-50/70 hover:border-emerald-200"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-lg font-semibold text-zinc-950">{eventItem.title}</p>
                        <p className="mt-1 text-sm text-zinc-600">
                          {eventItem.location ?? "場所未設定"} / {eventItem.city?.name ?? "市区町村未設定"}
                        </p>
                      </div>
                      <dl className="grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-zinc-800">開始日</dt>
                          <dd>{formatDateLabel(eventItem.start_date)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-zinc-800">終了日</dt>
                          <dd>{formatDateLabel(eventItem.end_date)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={buildEventsPageHref(page, eventItem.id)}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-900/10 transition hover:bg-emerald-50"
                      >
                        <PencilLine className="h-4 w-4" />
                        編集
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(eventItem.id)}
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
              表示できるイベントがありません。
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-5">
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildEventsPageHref(page - 1)}
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
                href={buildEventsPageHref(page + 1)}
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
