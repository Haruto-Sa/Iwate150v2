# データ処理の配置

公開データ取得は `supabaseClient.ts`、同一オリジンの本人APIと公開カタログの呼び出しは `privateUserClient.ts` に置きます。本人APIではサーバーが所有者を決定し、既存のセッション検証・件数上限・タイムアウト・失敗応答を維持します。移動したAPI関数は旧ファイルから再公開しません。

検索と管理一覧は `paging.ts` の関数と結果型を共有します。検索の既定50件、管理一覧の既定20件、上限100件は呼び出し元で指定します。既存の公開型 `PagedResult` と `AdminListPage` は維持します。

StorageのURL変換・設定解決は `storage.ts`、サーバー署名とメモリキャッシュは `storageServer.ts`、ブラウザー署名は `storageSignedClient.ts` に置きます。`storageServer.ts` と `adminServer.ts` は `server-only` を明示します。サーバー署名の設定はモジュール読み込み時に評価し、既存キャッシュとフォールバックを維持します。

テーブル・環境変数・データ形式の変更はありません。関連する `spots`、`events`、`favorites`、`stamps` 等の読み書き先は従来どおりです。

検証コマンド:

```sh
bun run test:unit --maxWorkers=2
bun run typecheck
bun run lint
bun run build
```

検証結果: 全単体656件と、追加した検索・管理一覧のページ送り2件が成功。型検査・本番ビルド成功、lintはエラー0・既存警告7。Chromium/WebKit・iPhone/Androidプロファイルで関連E2E63件が成功しました。本人APIやカタログのE2Eはモックを用い、実DB・実OAuth・実機での検証とは区別します。
