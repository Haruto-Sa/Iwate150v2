# Supabase Storage / Auth セットアップ手順

## 機能概要
- legacy / public にある画像・3Dモデルを Supabase Storage（`iwate150data` バケット）へ移行する。
- DB の `image_path` / `image_thumb_path` / `model_path` を Storage 相対パス（`images/...`, `models/...`）で管理する。
- 認証を Supabase Auth に統一し、`public.users`・`stamps` と連携する。
- 主要ページ（`/`, `/search`, `/spot`, `/camera`, `/character`, `/ar`）で資産リンクが成立しているか検証する。

## 技術的な設計判断とその理由
- Storage パスは **相対パス管理**（`images/...`）に統一。
  - 環境差分（ローカル/本番）で URL が変わっても DB 値を固定できるため。
- `src/lib/storage.ts` で `"/images/..."` 旧形式も吸収。
  - 既存データを即時破壊せずに移行可能にするため。
- `src/lib/storageSignedClient.ts` で signed URL を 6〜24時間キャッシュ再利用。
  - 同一セッション中の `createSignedUrl` 再生成を抑えて安定化するため。
- 一覧系は `image_thumb_path` を優先し、`image_path` にフォールバック。
  - 転送量を下げて初期表示を安定させるため。
- 認証は NextAuth を廃止し、Supabase Auth セッションを `SessionProvider` で一元管理。
  - `auth.users` と `public.users` の整合を取りやすく、Stamp 機能と直接つなげられるため。
- `supabase/schema.sql` で RLS/Storage policy/`auth.users` 同期トリガーを定義。
  - Auth と DB の運用漏れを防ぎ、初期セットアップだけで動く状態を作るため。

## 使用している Supabase テーブル
- `cities`（`image_thumb_path`, `image_path`）
- `genres`（`image_thumb_path`, `image_path`）
- `spots`（`image_thumb_path`, `image_path`, `model_path`）
- `events`
- `users`（`auth_id`, `display_name`）
- `stamps`（`user_id`, `spot_id`）
- `auth.users`（Supabase Auth 標準テーブル、`public.users` と同期）

## 関連ファイルパス一覧
- `src/lib/storage.ts`
- `src/lib/storageSignedClient.ts`
- `src/components/map/LeafletMap.tsx`
- `src/components/camera/CameraCapture.tsx`
- `src/app/character/page.tsx`
- `src/components/search/SearchSurface.tsx`
- `src/app/page.tsx`
- `src/app/ar/page.tsx`
- `src/components/auth/SessionProvider.tsx`
- `src/components/auth/AuthGate.tsx`
- `src/app/login/page.tsx`
- `src/app/stamp/page.tsx`
- `supabase/schema.sql`
- `supabase/seed.sql`
- `supabase/storage-path-migration.sql`
- `supabase/thumb-path-backfill.sql`
- `supabase/thumb-path-repair.sql`
- `scripts/migrate_storage_assets.ts`
- `scripts/verify_storage_links.ts`

## セットアップ手順
1. 必要な環境変数を設定
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=iwate150data
SUPABASE_STORAGE_BUCKET=iwate150data
NEXT_PUBLIC_SUPABASE_STORAGE_MODE=signed
NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN=21600
```

2. スキーマ適用（RLS / Storage policy / Auth連携含む）
```sql
-- supabase/schema.sql を SQL Editor で実行
```

3. 既存DBのパスを正規化（必要な場合）
```sql
-- supabase/storage-path-migration.sql を実行
```

4. サムネパスを backfill（thumb 運用する場合）
```sql
-- supabase/thumb-path-backfill.sql を実行
```

4.1 すでに `.webp` 固定で backfill 済みの場合（修復）
```sql
-- supabase/thumb-path-repair.sql を実行
```

5. 画像・モデルを Storage にアップロード
```bash
# 事前確認（dry-run）
bun run storage:migrate

# 実アップロード
bun run storage:migrate --run
```
- 一時的な API エラー（`Failed to parse JSON` など）で止まった場合は、そのまま同じコマンドを再実行する。
  - `scripts/migrate_storage_assets.ts` は既存オブジェクトを先に列挙してスキップするため、再実行時は未完了分だけ進む。

6. DB参照リンクを検証
```bash
bun run storage:verify
```

7. アプリ動作確認
```bash
bun run dev
```
- `/`（都市・スポット画像）
- `/search`（検索結果画像）
- `/spot`（地図ポップアップ画像）
- `/camera`（キャラモデル）
- `/character`（モデル + サムネイル）
- `/ar`（spotモデル参照）
- `/stamp`（ログイン済みでスタンプ登録）

## 補足
- `scripts/migrate_storage_assets.ts` は `legacy/flask_app/static` を優先し、欠損分は `public/` から補完する。
- 日本語ファイル名など非ASCIIキーは、移行時に ASCII セーフな `u<hex>` キーへ自動変換してアップロードする。
- `storage:migrate` は `images/...` から `images/thumb/...` への mirror も同時アップロードする（初期は同一画質コピー）。
- `storage:migrate` は既存キーのスキップ、transient error retry、`Failed to parse JSON` 時の存在確認フォールバックを実装している。
- signed URL キャッシュはメモリ + localStorage（`iwate150_signed_url_cache_v1`）で保持する。
- `next.config.ts` は Supabase Storage ドメインを `next/image` の許可先に追加済み。
  - `https://**.supabase.co/storage/v1/object/**` を許可し、signed URL（`/sign/...`）も表示できる。
- `src/lib/storage.ts` で旧パス形式も解決できるため、段階的移行が可能。
  - `next.config.ts` を変更した場合は `bun run dev` を再起動すること。
- Search/Map/Character の安定化更新内容は `docs/search-map-character-stability.md` を参照。
