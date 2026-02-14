# LiftKit Button Migration

## 機能概要

[Chainlift LiftKit](https://www.chainlift.io/liftkit) のボタンコンポーネントを採用し、全ページのボタン UI を統一した。
LiftKit はゴールデンレシオ（φ = 1.618）に基づくスペーシングと光学補正パディングを提供するフレームワークで、ボタンのアイコン配置・パディング・サイズ比率が数学的に最適化される。

## 技術的な設計判断

### なぜ LiftKit を採用したか

- ボタンのパディングがアイコンの有無に応じて自動補正される（optical symmetry）
- golden ratio に基づくサイズスケール（sm / md / lg）が一貫したプロポーションを提供する
- StateLayer による hover / active / focus のフィードバックが統一される

### 統合アプローチ: ラッパー方式

LiftKit の `Button` コンポーネントを直接利用するのではなく、既存の `src/components/ui/Button.tsx` を LiftKit のデータ属性 CSS ベースで再構築した。

理由:
1. **既存 API 互換の維持** — `children` ベース・`variant` / `size` / `className` の props をそのまま維持
2. **Tailwind CSS との共存** — LiftKit の CSS 変数（`liftkitvars.css`）と Tailwind CSS を並行使用
3. **段階的な移行** — 各ページの生 `<button>` を共通 Button に置換する形で移行

### CSS 読み込み戦略

LiftKit の `liftkit-core.css` はグローバルリセット（`* { margin: 0; padding: 0; }`、全 `<button>` へのスタイル適用）を含むため、**直接インポートしない**。

代わりに以下のみをインポート:
- `liftkitvars.css` — CSS カスタムプロパティ（スペーシング・カラートークン）のみ
- `background-colors.css` — `.bg-primary` 等のユーティリティクラス
- `button.css` / `state-layer.css` — コンポーネントレベルで自動インポート（`[data-lk-component]` でスコープ済み）

### カラーカスタマイズ

LiftKit のデフォルト primary カラー（`#0051e0`）をプロジェクトの emerald テーマ（`#10b981`）にオーバーライド:

```css
:root {
  --light__primary_lkv: #10b981;
  --light__onprimary_lkv: #ffffff;
  --lk-primary: #10b981;
  --lk-onprimary: #ffffff;
}
```

## バリアントマッピング

| プロジェクト variant | LiftKit variant | 用途 |
|---|---|---|
| `primary` | `fill` | メインアクション（保存・ログイン等） |
| `ghost` | `text` | 軽いアクション（キャンセル・ナビゲーション等） |
| `glass` | `text` + 半透明背景 | ダーク背景上のボタン |
| `outline` | `outline` | サブアクション（OAuth ボタン・外枠ボタン等） |

## アクセシビリティ

- `focus-visible` アウトラインを全ボタンに統一（emerald-500, offset 2px）
- `disabled` 状態で `pointer-events-none` + `opacity-50` を適用
- `type` 属性のデフォルトを `"button"` に設定（フォーム内での意図しない submit を防止）
- `aria-label` が既存で付与されていた箇所はそのまま維持

## 使用している Supabase テーブル

なし（UI コンポーネント変更のみ）

## 関連ファイルパス一覧

### 設定・依存
- `package.json` — `@chainlift/liftkit` devDependency 追加
- `components.json` — LiftKit CLI が生成した設定ファイル
- `src/app/globals.css` — LiftKit CSS 変数の読み込み + primary カラーオーバーライド

### 共通ボタンコンポーネント
- `src/components/ui/Button.tsx` — LiftKit ベースに再実装

### LiftKit 生成ファイル（自動生成）
- `src/components/button/` — LiftKit Button コンポーネント・CSS
- `src/components/state-layer/` — StateLayer コンポーネント・CSS
- `src/components/icon/` — Icon コンポーネント・CSS
- `src/lib/css/` — LiftKit CSS 変数・ユーティリティクラス
- `src/lib/types/lk-*.d.ts` — LiftKit 型定義
- `src/lib/colorUtils.ts`, `src/lib/utilities.ts` 等 — LiftKit ユーティリティ

### 移行対象ページ・コンポーネント
- `src/app/login/page.tsx` — 全ボタン (7個) を Button に統一
- `src/app/camera/edit/page.tsx` — 主要ボタン (SNS共有・ツールバー・テキスト追加等) を Button に統一
- `src/app/character/page.tsx` — モデル選択ボタンを Button に統一
- `src/app/stamp/page.tsx` — 既存 Button 利用（変更不要）
- `src/components/search/SearchSurface.tsx` — タブボタンを Button に統一
- `src/components/home/CalendarBoard.tsx` — クローズボタンを Button に統一
- `src/components/home/LegacyCalendarBoard.tsx` — 既存 Button 利用（変更不要）
- `src/components/home/HomeCalendarSwitcher.tsx` — ビュー切替ボタンを Button に統一
- `src/components/auth/AuthGate.tsx` — ゲストボタンを Button に統一
- `src/components/layout/Header.tsx` — ログアウトボタンを Button に統一
- `src/components/spot/SpotSurface.tsx` — 現在地更新・ルート検索ボタンを Button に統一
- `src/components/map/LeafletMap.tsx` — ルート検索ボタンを Button に統一
- `src/components/character/CharacterViewer.tsx` — 拡大/縮小/回転ボタンを Button に統一
- `src/components/camera/CameraCapture.tsx` — キャラクター選択ボタンを Button に統一

### 意図的に生 `<button>` を維持した箇所
- カレンダー日セル（`CalendarBoard.tsx`）— グリッド UI として特殊なスタイリングが必要
- カメラシャッターボタン（`CameraCapture.tsx`）— 円形の撮影 UI
- スタンプ絵文字パレット（`camera/edit/page.tsx`）— グリッド状の絵文字選択 UI
- カメラ内/外カメ切替（`CameraCapture.tsx`）— 小型の円形オーバーレイ UI
