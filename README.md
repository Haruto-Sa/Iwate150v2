# Iwate150 (Next.js + Supabase + Leaflet)

岩手県の観光スポットを紹介する「Iwate150」を、Next.js + Supabase + Leaflet + OSM で再構築したバージョンです。Vercel デプロイ前提、App Router + TypeScript + Tailwind 構成。既存の Flask/MySQL 実装は `legacy/` に退避してあります。

- 日本語 README（本ファイル）
- 英語ダイジェスト: `docs/README.en.md`
- Supabase 移行手順: `docs/supabase.md`

## ディレクトリ構成（抜粋）
```
.
├── src/
│   ├── app/                 # App Router pages
│   │   ├── page.tsx         # Home
│   │   ├── map/page.tsx     # Leaflet + OSM
│   │   ├── spots/page.tsx   # 一覧・検索
│   │   ├── spots/[id]/page.tsx
│   │   └── ar/page.tsx      # AR/3D プレースホルダ
│   ├── components/          # UI/レイアウト/マップ/スポットカード
│   └── lib/                 # supabaseClient（モックfallback）、types、config
├── public/
│   ├── images/spots/        # 観光スポット画像（legacy から移動）
│   ├── images/cities/       # 市町村アイコン
│   ├── images/other/        # その他アイコン
│   └── models/              # 3Dモデル（.obj など）
├── supabase/
│   ├── schema.sql           # スキーマ
│   ├── seed.sql             # サンプルデータ
│   └── data/                # legacy CSV を整形した一括インポート用データ
└── legacy/                  # 旧 Flask/MySQL 実装・DB CSV
```

## セットアップ
### 1. 依存インストール
```bash
bun install   # bun 推奨（なければ npm/pnpm/yarn でも可）
```

### 2. 開発サーバ
```bash
bun dev
# または npm run dev
```

### 3. 環境変数
`.env.local`（または Vercel 環境変数）に以下を設定:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

未設定の場合はモックデータで表示されます（map/spots/AR が動作するフェイルセーフ）。

## Supabase へのスキーマ/シード適用
`supabase/schema.sql` → `supabase/seed.sql` の順に適用してください。
- Supabase Dashboard の SQL Editor でコピペ実行
- もしくは Supabase CLI: `supabase db push --file supabase/schema.sql` / `supabase db push --file supabase/seed.sql`

### legacy CSV を Supabase へ移す場合
- 既に整形済み CSV を `supabase/data/` に用意（city / genre / spot / event）。
- 変換スクリプト: `python scripts/convert_legacy_to_supabase.py`（再生成可）。
- Supabase Dashboard の「Table editor > Import data」で CSV をインポートするとフルデータを投入できます。

詳細手順は `docs/supabase.md` を参照。

## ページ概要
- `/` : Iwate150 コンセプト。Map/Spots/AR/Events への導線。
- `/map` : Leaflet + OSM。Supabase から取得したスポットをマーカー表示。
- `/spots` : 一覧 + キーワード検索 + ジャンル/市町村フィルタ（初期はフロントフィルタ）。
- `/spots/[id]` : スポット詳細（画像/緯度経度/model_path を表示）。
- `/ar` : model_path を持つスポットのプレースホルダ一覧。将来の AR.js / three.js 連携を想定。
- `/login` : Supabase Auth (メール+パスワード) 用。環境変数未設定時はモックのみ。

## 画像・3Dモデル
- `legacy/flask_app/static/images/*` を `public/images/*` へ整理済み。
- `legacy/flask_app/static/models/*` を `public/models/` へコピー済み。
- Next.js は `public/` を直接参照するため、ランタイムで legacy に依存しません。

## Vercel デプロイのメモ
- App Router 構成のため、Vercel は自動検出でデプロイ可能。
- 環境変数を Vercel に設定すれば Supabase へ接続。
- SSR + クライアントコンポーネント混在のため、Leaflet 部分はクライアントコンポーネントで dynamic import 済み。

## ライセンス / クレジット
- 地図タイル: OpenStreetMap
- フレームワーク: Next.js, Leaflet, Supabase

## 今後の拡張メモ
- Supabase Storage への画像/モデル移行
- スタンプラリー（`stamps` テーブルを利用）
- three.js / AR.js / locAR.js との連携
- 検索を Supabase 側クエリに寄せる（フロントフィルタから移行）
