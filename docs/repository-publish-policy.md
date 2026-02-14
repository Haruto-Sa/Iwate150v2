# GitHub 公開ポリシー

## 機能概要
このドキュメントは、`Iwate150v2` を GitHub 公開する際に「公開しない方がよいデータ」を除外する運用ルールを定義する。

## 技術的な設計判断とその理由
- `.env*` を除外: Supabase の URL・キーなど環境依存値をリポジトリへ含めないため。
- `supabase/data/` と `supabase/seed.sql` を除外: 開発用シードデータや運用データの誤公開を防ぐため。
- `supabase/config.toml` と `supabase/.env` を除外: ローカル Supabase 設定や秘密値の混入を防ぐため。
- `supabase/schema.sql` は管理対象: DB 構造はアプリ開発に必要なため、機密データと分離してバージョン管理する。

## 使用している Supabase テーブル
- `cities`
- `genres`
- `spots`
- `events`
- `users`
- `stamps`

## 関連ファイルパス一覧
- `.gitignore`
- `supabase/schema.sql`
- `supabase/seed.sql`（`.gitignore` で除外）
- `supabase/data/`（`.gitignore` で除外）
- `.env.local`（`.gitignore` で除外）

## セットアップ手順
1. `git status --short` で追跡対象を確認する。
2. `git check-ignore -v .env.local supabase/seed.sql supabase/data/spots.csv` で除外設定が効いていることを確認する。
3. `git add .` 前に `git status --short` を再確認し、意図しない機密ファイルが含まれていないことを確認する。
4. 問題なければ `git commit` と `git push` を実行する。
