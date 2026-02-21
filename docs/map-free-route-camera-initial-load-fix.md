# 無料ルート遷移修正 + Camera初期モデル読み込み安定化

## 機能概要
- `無料 (OSRM)` のルート検索で JSON API が直接開いてしまう問題を修正し、OpenStreetMap の経路画面へ遷移するようにした。
- `camera` で初回にモデルが表示されない問題を修正し、選択したキャラを優先して読み込む方式へ変更した。
- `camera` のモデル読込状態を `idle/loading/ready/error` で個別管理し、失敗時の再選択リトライ導線を追加した。

## 技術的な設計判断とその理由
- OSRM の API URL (`/route/v1/...`) はブラウザで開くと JSON を返すため、UI用途では OpenStreetMap directions URL を利用する。
- カメラ起動時の全モデル先読みは、重いモデルの初回ロード失敗を誘発しやすいため廃止した。
- 選択モデルのみロードすることで、最初に見たいモデルの表示成功率と表示速度を優先した。
- モデルの正規化スケールに下限値を設定し、極端に大きいモデルが初回で極小表示になるリスクを抑制した。

## 使用している Supabase テーブル
- なし（本修正はルートURL生成とクライアント側3D読み込みロジックのみ）

## 関連ファイルパス一覧
- `src/lib/routeProviders.ts`
- `src/components/camera/CameraCapture.tsx`
- `docs/map-free-route-camera-initial-load-fix.md`

## セットアップ手順
1. 開発サーバーを再起動する。
```bash
bun run dev
```
2. `/spot` で `無料 (OSRM)` を選択し、`ルート検索` を押して OpenStreetMap の経路画面が開くことを確認する。
3. `/camera` で `ごしょどん` を選択し、顔検出時にモデルが表示されることを確認する。
4. 初回で表示されない場合、同じキャラを一度外して再選択すると再読み込みされることを確認する。
