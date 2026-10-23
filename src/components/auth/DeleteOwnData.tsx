"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { Button } from "@/components/ui/Button";

/**
 * 現在の本人に削除操作を限定する。利用者変更時は処理画面を作り直す。
 * @returns 認証状態に応じた削除操作
 * @example <DeleteOwnData />
 */
export function DeleteOwnData() {
  const { user, status, signOut } = useAuthSession();
  if (status === "loading") return <p role="status">読み込んでいます。</p>;
  if (status !== "authenticated" || !user?.id) return <Link href="/login?next=%2Faccount" className="action-link">ログイン</Link>;
  return <DeleteDataForm key={user.id} identity={user.id} signOut={signOut} />;
}

/**
 * 削除範囲を確認して本人APIを呼び、成功後だけログアウトする。
 * @param props.identity - 表示時の本人識別子
 * @param props.signOut - アプリのログアウト処理
 * @returns 削除・失敗時の再試行操作
 * @example <DeleteDataForm identity="oauth:google:123" signOut={signOut} />
 */
function DeleteDataForm({ identity, signOut }: { identity: string; signOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  /**
   * 削除後のログアウトを再試行可能にする。
   * @returns 操作完了
   * @example await removeData();
   */
  async function removeData(): Promise<void> {
    if (pending.current) return;
    if (!deleted && !window.confirm("スタンプ・お気に入り・このアプリの登録情報を削除します。元に戻せません。\n端末に残る以前のお気に入りは削除されません。\n管理権限がある場合、その権限も失われます。")) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    let deletionConfirmed = deleted;
    try {
      if (!deleted) {
        const response = await fetch("/api/me", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-session-user": identity },
          body: JSON.stringify({ confirmation: "delete" }),
          signal: AbortSignal.timeout(15_000),
        });
        const result: unknown = await response.json();
        if (!response.ok || !result || typeof result !== "object" || !("success" in result) || result.success !== true) {
          throw new Error("Deletion not confirmed");
        }
        deletionConfirmed = true;
        if (!active.current) return;
        setDeleted(true);
      }
      if (active.current) await signOut();
    } catch {
      if (active.current) setError(deletionConfirmed
        ? "データは削除しました。ログアウトを再試行してください。"
        : "削除結果を確認できません。再試行してください。");
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-red-200 p-5">
      <h2 className="font-display text-xl">保存データを削除</h2>
      <p className="text-sm">スタンプ・お気に入りを削除すると元に戻せません。</p>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <Button variant="outline" disabled={busy} onClick={() => { void removeData(); }}>
        {busy ? "処理中…" : deleted ? "ログアウトを再試行" : "削除してログアウト"}
      </Button>
    </section>
  );
}
