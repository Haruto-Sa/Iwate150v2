# カメラ処理の責務整理（Issue #33 / R6）

## FaceMesh読み込み

`src/components/camera/faceMesh.ts`に読み込みと再初期化を分離。モジュール変数の共有インスタンスとsingle-flight Promiseも一緒に移し、画面再訪時の再利用を維持する。Workerの機能判定、非SIMDアセット、計測ログ、推論設定、復旧条件と順序は変更しない。撮影・モデル配置・ストリーム開始処理は`CameraCapture.tsx`が保持する。

Supabaseテーブルの変更や追加のセットアップはない。

## 検証

8関数の本体は移動前と厳密一致。画面側にあった共有参照の破棄は`forgetFailedFaceMeshInstance`へ移し、同一インスタンスの場合だけ参照とPromiseを空にする条件を維持した。closeと画面状態更新は呼び出し側に残す。

同時取得・画面再訪での再利用、初期化失敗後の再試行、再生成時のclose、古いインスタンスの失敗が新しい共有対象を破棄しないことを3件で検証。全単体719件、型チェック、lint（0 errors / 既存6 warnings）が成功。

撮影・編集E2Eを実行中。Android相当の顔検出タイムアウト後の復帰で「顔をカメラに向ける」の待機が失敗したため、変更前後の比較を継続する。テストの待機期限やskipは変更していない。実機での顔追従、写真のモデル位置、保存・SNS共有は未検証。

初回E2Eは67成功・1失敗（Android相当、3.2分）。失敗した復帰テストを単独・1 workerで変更前2回、変更後2回実行し、いずれも成功（各約27秒）しました。初回は単体テストとの並行実行があったため負荷の可能性はありますが、原因の確定とは扱いません。失敗トレースを保持しています。

## カメラの向きと写真引き渡しキー

`isCameraFacingMode` / `resolveActiveFacingMode`と型を`src/lib/cameraStream.ts`へ移動。実際のtrack設定を要求値より優先し、不明・未対応・トラックなしでは要求値を使う挙動を維持する。撮影画面と編集画面は`src/lib/config.ts`のsessionStorageキーを参照し、`capturedPhoto` / `capturedDetection` / `capturedModels`の文字列は変更しない。

## object-coverの計算

`src/components/camera/coverFit.ts`に正規化座標補正と整数ピクセル切り抜きを別関数で分離。寸法の既定値、動画の初回/継続フレームで参照する縦横比、出力サイズ制限、鏡像処理は呼び出し側に残す。横長・縦長・同比率と端数の丸めをテストする。

## 未使用フレーム参照

`rafRef`は宣言とcleanupの読み取りだけで、値を代入する処理がなかったため削除した。描画ループの停止は元からeffect内の`animFrame`で行っており、その処理は維持する。

Step 1〜4の本番ビルドと撮影・編集E2E68件が成功（4.8分、1 worker）。以前失敗したAndroid相当の顔検出復帰も成功した。編集E2Eは従来Chromiumのみだったため、編集の分割に先立ち他3プロファイルにも追加し、文字・スタンプの移動、文字のサイズ変更、pointerup後の操作終了を検証する。実機確認とは区別する。

編集分割前の4プロファイル20件が成功（41.6秒）。WebKitでは既存のカメラ不在fixtureが実際の権限エラーを返していたため、navigator.mediaDevices全体の差し替えと呼び出し確認を追加し、同じNotFoundErrorを確実に再現するよう修正した。

## 編集画像の書き出し

`camera/editor/types.ts`に装飾・操作モードの型、`renderEditedPhoto.ts`にPNG合成を移動した。`generateImage`は最新のphoto/stickers/textsを渡す。画像decode、フォント準備待ち、crossOrigin、元画像寸法、正規化座標、描画順、PNG形式を維持している。

PNG合成の移動後は、インデント以外の処理が変更前と一致。単体735件・型・lint（0 errors / 5 warnings）・本番ビルド・編集20件が成功（43.6秒）。
