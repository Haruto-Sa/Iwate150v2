# 開発者向けガイド

VOJA IWATE のローカル開発・運用に関する技術情報です。
ユーザ向けの概要は [README.md](../README.md) を参照してください。

## Stack

- Next.js 16 (App Router)
- React 19 / TypeScript
- Supabase
- NextAuth
- Leaflet / OpenStreetMap
- MediaPipe（顔認識）
- Three.js（3D表示）
- bun

公開用構成のため、環境変数が未設定でもサンプル / モックデータで主要画面を確認できます。

## Public Routes

| パス | 機能 |
|------|------|
| `/` | Home |
| `/map` | Map |
| `/search` | Search |
| `/guide` | Character / Guide |
| `/camera` | Camera |
| `/spots/[slug]` | Spot details |
| `/stamps` | Stamps |
| `/favorites` | Favorites |
| `/login` | Login |

旧ルートの一部は互換用に残しつつ、新ルートへ順次移行しています。

## Private Workspace

| パス | 機能 |
|------|------|
| `/studio/access` | Studio 入口 |
| `/studio` | 管理ダッシュボード |
| `/studio/spots` | スポット CRUD |
| `/studio/events` | イベント CRUD |

`/admin` と `/admin/login` は互換リダイレクトとして残っていますが、運用上は `/studio` を使用します。

## Setup

### 1. Install

```bash
bun install
```

### 2. Start

```bash
bun run dev
```

### 3. Optional environment variables

最低限、環境変数がなくてもモックデータで動作します。実運用で Supabase / NextAuth を有効にする場合のみ設定してください。

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_EMAIL_FROM`
- `AUTH_EMAIL_SERVER_HOST`
- `AUTH_EMAIL_SERVER_PORT`
- `AUTH_EMAIL_SERVER_SECURE`
- `AUTH_EMAIL_SERVER_USER`
- `AUTH_EMAIL_SERVER_PASSWORD`
- `ADMIN_BOOTSTRAP_EMAILS`

## Commands

```bash
bun run dev        # 開発サーバー起動
bun run lint       # ESLint
bun run typecheck  # 型チェック
bun run test       # ユニットテスト (vitest)
bun run test:e2e   # E2E テスト (playwright)
bun run build      # プロダクションビルド
```

## Authentication Policy

- Home / Map / Search / Spot details / Camera は未ログインでも利用できます。
- Favorites や進捗保存機能は、必要になったタイミングでログインを促します。
- Secret workspace は一般ナビゲーションに出さず、サーバ側の role 判定で保護します。
- Studio で管理操作を行う場合は `SUPABASE_SERVICE_ROLE_KEY` と `ADMIN_BOOTSTRAP_EMAILS` の設定が必要です。

## Data Policy

- 公開リポジトリには価値の高い SQL、内部データ定義、運用データを含めません。
- 実データの投入手順や内部管理方法は公開ドキュメントには記載しません。
- 公開版はモックデータ中心で確認できる構成です。

## スクリーンショットの更新

README 用の画面キャプチャは Playwright で撮影しています。

```bash
bun run dev                                  # 別ターミナルで起動
bunx playwright test e2e/screenshots.spec.ts # docs/screenshots/ に出力
```
