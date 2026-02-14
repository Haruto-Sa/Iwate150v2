# Vercel デプロイ手順

## 機能概要
`Iwate150v2`（Next.js App Router）を Vercel にデプロイし、Supabase 連携を有効化する手順をまとめる。

## 技術的な設計判断とその理由
- Vercel を採用: Next.js の App Router と相性が良く、ビルド・配信の設定が最小で済むため。
- 環境変数は Vercel 側で管理: リポジトリに秘密情報を置かずに運用するため。
- `NEXT_PUBLIC_SUPABASE_*` と `SUPABASE_SERVICE_ROLE_KEY` を分離: クライアント公開値とサーバー専用秘密値を明確に分けるため。

## 使用している Supabase テーブル
- `cities`
- `genres`
- `spots`
- `events`
- `users`
- `stamps`

## 関連ファイルパス一覧
- `README.md`
- `.gitignore`
- `src/lib/supabaseClient.ts`
- `src/lib/storage.ts`
- `src/lib/storageSignedClient.ts`
- `supabase/schema.sql`
- `docs/repository-publish-policy.md`

## セットアップ手順
1. GitHub リポジトリに最新コードを push する。
2. Vercel ダッシュボードで `Add New...` → `Project` を選択し、対象 GitHub リポジトリを Import する。
3. Framework Preset は `Next.js` を選択（通常は自動検出）。
4. `Environment Variables` に以下を設定する。
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_SUPABASE_STORAGE_MODE`（例: `public` または `signed`）
   - `NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN`（例: `21600`）
   - `SUPABASE_SERVICE_ROLE_KEY`（Server 用。Preview/Production のみ推奨）
   - `SUPABASE_STORAGE_BUCKET`
5. `Deploy` を実行し、ビルド完了後に発行 URL で動作確認する。
6. 問題なければカスタムドメインを設定する（任意）。

## デプロイ後チェック
1. `/`（ホーム）が表示されること。
2. `/search` でスポット一覧取得ができること。
3. `/spot` で地図表示されること。
4. `NEXT_PUBLIC_SUPABASE_STORAGE_MODE=signed` を使う場合、画像 URL が 403 にならないこと。
5. Vercel `Runtime Logs` に秘密値を含むログ出力がないこと。
