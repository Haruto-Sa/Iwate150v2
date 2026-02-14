# マップ ルート検索機能（無料/有料切替）

## 機能概要

`/spot` 地図ページにおいて、各スポットへのルート検索を実行できる機能。
ルートプロバイダを **無料 (OSRM)** と **有料 (OpenRouteService)** で切り替え可能。

初期スコープでは **外部地図アプリへの遷移** のみ。アプリ内への Polyline 描画は将来拡張として想定。

## 技術的な設計判断とその理由

### プロバイダ分離

- ルートURL生成ロジックを `src/lib/routeProviders.ts` に集約し、UIコンポーネントから分離。
- UI側は `buildRouteUrl()` を呼ぶだけで済むため、プロバイダ追加時にUI変更が不要。

### 無料/有料切替

| モード | プロバイダ | 特徴 |
|--------|------------|------|
| `free` | OSRM Public API | APIキー不要。レート制限あり |
| `paid` | OpenRouteService | APIキー必要 (`NEXT_PUBLIC_ORS_API_KEY`) |

### フォールバック戦略

- 有料モードが選択されていても、APIキーが未設定の場合は自動的に無料 (OSRM) にフォールバック。
- フォールバック発生時は画面上にバナーで理由を通知。
- 現在地が取得できない場合は Google Maps に委ね、端末側で現在地を補完。

## 使用している Supabase テーブル

この機能単体では新しい Supabase テーブルは使用しない。
既存の `spots` テーブルの `lat` / `lng` カラムを利用する。

## 関連ファイルパス一覧

| ファイル | 役割 |
|----------|------|
| `src/lib/routeProviders.ts` | ルートURL生成ユーティリティ・型定義 |
| `src/lib/config.ts` | `ROUTE_CONFIG` 定数（デフォルトモード・APIキー設定） |
| `src/components/spot/SpotSurface.tsx` | 切替UI・ルート検索ボタン・通知バナー |
| `src/components/map/LeafletMap.tsx` | Popup 内ルート検索ボタン |
| `docs/map-route-switch.md` | 本ドキュメント |

## セットアップ手順

### 無料モードのみ（デフォルト）

追加設定は不要。そのまま動作する。

### 有料モード (OpenRouteService) を有効にする

1. [OpenRouteService](https://openrouteservice.org/) でアカウントを作成し、APIキーを取得する。
2. `.env.local` に以下を追加:

```
NEXT_PUBLIC_ORS_API_KEY=your_api_key_here
```

3. 開発サーバーを再起動する。
4. `/spot` ページのルート切替セレクトで「有料 (ORS)」を選択できるようになる。

## 型定義

```typescript
type RouteMode = "free" | "paid";
type RouteProvider = "osrm" | "openrouteservice";
type LatLng = { lat: number; lng: number };

type RouteUrlResult =
  | { ok: true; url: string; provider: RouteProvider; fellBack: false }
  | { ok: true; url: string; provider: RouteProvider; fellBack: true; reason: string }
  | { ok: false; error: string };
```

## 将来の拡張

- アプリ内 Polyline 描画（OSRM / ORS API の JSON レスポンスをデコード）
- 徒歩/自動車/自転車のプロファイル切替
- ルート所要時間・距離の表示
- スポット詳細ページ (`/spots/[id]`) からのルート開始
