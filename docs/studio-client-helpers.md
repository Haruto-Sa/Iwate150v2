# 管理画面の共通処理

スポット・イベントの管理画面は `src/components/studio/studioClient.ts` の2関数を共有します。

- `buildStudioPageHref`: 一覧ページ番号と編集対象IDからURLを作成。
- `readStudioErrorMessage`: APIのエラー文字列を取得し、取得できない場合は既存のステータス付き文を返却。

元の2実装はURLのパス以外が一致することを確認して移動しました。フォーム項目、日付・座標の整形、保存・削除処理、画面文言は各管理画面で維持します。データベースや認証処理は変更しません。

ダッシュボードは既に `adminDashboard.ts` から管理用サーバークライアントを利用しています。接続や取得に失敗した件数は不明として扱い、0件には置き換えません。

検証:

```sh
bun run test:unit src/components/studio src/lib/adminDashboard.test.ts src/app/studio/page.test.tsx --maxWorkers=2
bun run typecheck
bun run lint
bun run build
```

検証結果: 全単体658件/60ファイル成功、型検査・本番ビルド成功、lintエラー0・既存警告7。Chromium・iPhone(WebKit)・Androidプロファイルで未認証アクセス制限3件成功。実DB・実管理者ログインによるCRUDの通し確認は未実施です。
