# カメラ描画処理の分離

## 概要

Issue #33 R6の撮影用シーン生成、顔の外接枠計算、写真・動画のフレーム合成を`cameraRendering.ts`へ移す。`CameraCapture.tsx`は850行から778行へ減り、状態と撮影の進行管理を保持する。

## 設計判断

- シーン生成は描画先が存在し、シーンが未作成の場合だけ実行する。scene、camera、rendererのrefへ書く順序と設定値は元のまま。エラー処理は呼び出し側に残す。資源破棄は同じモジュールのdisposeCameraSceneへ移し、cleanup時点の参照をシーンclear、renderer.dispose、forceContextLossの順で解放する。
- 顔ランドマークは内カメラだけxを反転し、既存の式で画面内へ切り詰める。顔枠のstate更新間隔とref更新は親に残す。
- 合成は映像の切り抜き、必要な鏡像変換、その解除、最新3D描画、overlay合成の順序を維持する。写真と動画の共有処理で、最初の動画フレームのみ出力寸法を確定し、以後は既存の寸法を維持する。
- `computeCoverCrop`と`computeCoverTransform`は別の関数のまま。丸めと既定寸法は変えない。
- `startCamera`、顔枠から3Dモデルへの座標変換、録画状態、保存キー、停止後の画面遷移、effect依存とcleanupは変更しない。

## 関連ファイル

- `src/components/camera/CameraCapture.tsx`
- `src/components/camera/cameraRendering.ts`
- `src/components/camera/cameraRendering.test.ts`
- `src/components/camera/coverFit.ts`
- `e2e/camera-capture.spec.ts`
- `e2e/photo-sharing.spec.ts`

## データ・セットアップ

DBテーブル、環境変数、依存パッケージの追加・変更はない。Node 22とBunを使用する。

## 検証

鏡像の有無、映像とモデルの合成順序、動画の長辺制限と既存寸法維持、描画できない入力、顔枠、シーンの初期化を単体検証する。既存の撮影・編集・動画・共有テストを4ブラウザープロファイルで実行する。最終差分の単体763件・73ファイル、型検査、lint（0エラー・既存4警告）、本番ビルドが通過。撮影・編集のE2Eは4プロファイル84件が通過した。資源破棄の分離による新規lint警告はない。

ブラウザープロファイルと疑似カメラを使う自動検証は、実機での顔追従、実写とキャラクターの位置一致、SNSでの受信確認の代わりではない。
