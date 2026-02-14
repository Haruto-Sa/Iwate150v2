# Camera MediaPipe Tunnel 対応

## 機能概要
- `/camera` の FaceMesh 初期化を安定化し、二重初期化による RuntimeError を回避する。
- MediaPipe FaceMesh のアセット参照をローカル配信（`/public/mediapipe/face_mesh`）に寄せ、Cloudflare Tunnel 経由でも同じ読み込み経路で動作させる。
- HTTPS でないアクセス時は明示的にエラーメッセージを表示する。
- `/camera` プレビューと `/camera/edit` の見え方差分を減らすため、キャプチャ時に表示領域と同じクロップ・ミラーで保存する。

## 技術的な設計判断とその理由
- `startInProgressRef` で起動処理を排他制御した。
  - React Strict Mode / HMR 下で `startCamera` が重複起動し、FaceMesh 初期化が競合するのを防ぐため。
- FaceMesh インスタンスをファイルスコープで singleton 管理し、`Module.arguments` エラー時は自動で再生成する。
  - 初回表示時に失敗しても手動リロードなしで復旧させるため。
- `resetMediaPipeSolutionGlobals()` で `createMediapipeSolutionsWasm` 系のグローバルを初期化前に破棄した。
  - 再マウント時に古い Module 状態を引き継いで失敗するケースを減らすため。
- `locateFile` を CDN 直参照からローカル配信に変更し、SIMD リソース要求を non-SIMD バイナリへ寄せた。
  - ネットワーク経路差（ローカル直アクセス / Tunnel）をなくし、`Module.arguments` 系の不安定挙動を回避するため。
- `window.isSecureContext` をチェックし、非HTTPS環境では即時に利用不可を返す。
  - Tunnel 利用時の設定ミスを画面上で即時判別できるようにするため。
- キャプチャ時は `object-cover` と同じトリミング計算を行い、前面カメラ時はミラー反転を反映して保存する。
  - プレビュー時の顔とモデルの位置関係を、編集画面の画像でも一致させるため。
- `/camera` のプレビュー比率を `aspect-[4/3] sm:aspect-[16/10]` に固定した。
  - `/camera/edit` と同じ比率に揃え、PC での構図差分を抑えるため。

## 使用している Supabase テーブル
- なし（この対応はカメラ・MediaPipe 初期化のみ）

## 関連ファイルパス一覧
- `src/components/camera/CameraCapture.tsx`
- `public/mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js`
- `public/mediapipe/face_mesh/face_mesh_solution_wasm_bin.js`

## セットアップ手順
1. MediaPipe FaceMesh アセットを確認する。
```bash
ls public/mediapipe/face_mesh
```

2. 開発サーバーを起動する。
```bash
bun run dev
```

3. Cloudflare Tunnel で公開する場合は HTTPS URL でアクセスする。
- HTTP URL では `getUserMedia` が拒否されるため、`/camera` は利用できない。

4. `/camera` を開き、以下を確認する。
- 初回起動で RuntimeError が出ないこと
- 内外カメラ切替後に継続して顔検出できること
- ページ再読み込みなしでも自動復旧すること
- プレビューでの顔とモデルの位置が、`/camera/edit` 表示時にも一致すること
