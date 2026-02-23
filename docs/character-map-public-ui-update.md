# Character単一表示復帰 + Mapルート自動選択 + 公開向け文言調整

## 機能概要

- `/character` を単一キャラクター選択表示に戻し、選択中キャラクターのみ3Dモデルを読み込む構成へ変更。
- `/spot` のルート検索は内部で自動選択（OpenRouteService優先、利用不可時はOpenStreetMap/Google Mapsへ自動フォールバック）。
- 画面上の文言を公開向けに統一し、内部運用語（無料/有料、デバッグ、環境変数名、技術メモ）を非表示化。

## 技術的な設計判断と理由

- Characterページは全キャラ同時ロードをやめ、`selectedId` で単一キャラのみURL解決を行う。
  - 理由: 同時リクエスト数とThree.js初期化数を削減し、読み込み失敗率を抑えるため。
- CharacterViewerのエラー表示から候補URL表示を削除。
  - 理由: 失敗時に内部パスや配信構成を画面に出さないため。
- ORS外部地図URLは `lng,lat` 順で生成し、クエリをエンコードして生成。
  - 理由: ORS側の受け取り形式との整合性を上げ、遷移後にルートが復元されやすい形式に寄せるため。
- ルート検索UIはモード選択を廃止し、自動選択の単一体験に統一。
  - 理由: ユーザーの操作負荷を減らし、内部仕様の露出を避けるため。

## 使用しているSupabaseテーブル

- 既存テーブルの追加・変更はなし。
- 参照対象（既存）:
  - `spots`
  - `cities`
  - `genres`
  - `events`（ホーム表示側で既存利用）

## 関連ファイルパス一覧

- `src/app/character/page.tsx`
- `src/components/character/CharacterViewer.tsx`
- `src/lib/routeProviders.ts`
- `src/components/spot/SpotSurface.tsx`
- `src/app/login/page.tsx`
- `src/components/auth/AuthGate.tsx`
- `src/app/ar/page.tsx`
- `src/components/home/HomeCalendarSwitcher.tsx`
- `src/components/home/LegacyCalendarBoard.tsx`
- `src/app/search/page.tsx`
- `src/app/layout.tsx`

## セットアップ手順

1. `.env.local` とデプロイ環境に必要な環境変数を設定する。
2. 依存関係をインストールする: `bun install`
3. 型チェックを実行する: `bunx tsc --noEmit`
4. 開発サーバー起動: `bun run dev`
5. 動作確認:
   - `/character`: 初期表示で1キャラのみ表示、切替時に対象のみ再読込
   - `/spot`: ルート検索で外部地図が開き、利用不可時は自動フォールバック表示
   - `/login`, `/ar`, `/search`, `/`: 公開向け文言になっていること
