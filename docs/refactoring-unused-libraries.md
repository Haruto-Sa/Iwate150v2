# 未使用の認証・管理ヘルパーの整理

Issue #33 のR1として、参照されていない古い入口を削除しました。公開画面や保存方法は変えません。

| 削除対象 | 現在使われる実装 |
| --- | --- |
| `src/lib/auth.ts`、`fetchCurrentAppUser` | `src/auth.ts`、`authServer.ts` |
| `createAdminSpot`、`createAdminEvent`、`updateUserRole`、`uploadAdminAsset` | Studio APIと`adminServer.ts` |
| `src/lib/componentUtils.ts` | 未使用のコメントのみ。代替不要 |
| `src/lib/fs.ts` | 未使用のLiftKitディレクトリヘルパー。代替不要 |

旧関数専用の型import、バケット変数、書き込みクライアント取得、ファイル名整形も削除しています。共有型は残しています。管理集計は先行PRでサーバーへ移設済みのため、旧クライアントヘルパーの利用者もありません。

変更前に実装・テスト・スクリプトからの参照がないことを検索し、変更後には型検査で依存切れがないことを確認します。`supabaseClient.ts` の残存43宣言はTypeScript構文解析で変更前と一致し、923行から680行になっています。クライアント初期化、Storage用認証オプション、公開データのモックフォールバック、本人APIの処理は維持します。

R2以降の設定集約・責務分割や、認証サービス・DB設定の変更は別の作業です。

検証: 単体621件、Chromium/WebKit/iPhone/Androidプロファイルの関連E2E63件が成功。本番ビルド・型検査成功、lintはエラー0・既存警告7です。
