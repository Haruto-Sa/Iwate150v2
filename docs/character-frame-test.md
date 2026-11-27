# キャラクターの描画検査

`e2e/character-assets.spec.ts` は全5モデルの表示、拡大・縮小・回転・リセット、読み込み失敗からの再試行、テクスチャ読み込み順による色の一致を確認する。

CIのAndroid実行で、5モデルを連続操作する120秒の検査がモデル操作の途中で終了した。取得したPlaywrightトレースでは、画素取得に伴う`canvas`の`waitForSelector`が34回、合計26.7秒を占めた。各回の描画フレーム取得前にLocatorが行う待機であり、モデルを操作する各ボタンの待機とは別である。

`readViewerFrame` は`page.evaluate`から次の描画フレーム内でCanvasを取得する。Canvasが1つでなければ明示的に失敗する。画素取得前の別のDOM待機を省くが、全RGBA画素のSHA-256、背景以外の画素比率、5モデル連続切替、すべての操作・期待値、120秒の上限は維持する。本番の描画実装は変更しない。

```sh
E2E_SERVER_MODE=production bunx playwright test character-assets --project=android --project=chromium --project=iphone --project=webkit-ui --workers=2
```

CI上の改善は必須チェックの結果で判断する。ローカル成功だけでLinuxのソフトウェア描画や実機性能の改善とは判断しない。Supabaseテーブル・設定の変更はない。
