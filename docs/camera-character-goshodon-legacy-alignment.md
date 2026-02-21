# Cameraごしょどん参照修正 + Characterのlegacy寄せ

## 機能概要
- `goshodon` のモデル参照を `models/goshodon.obj` へ変更し、現在の `public/models` 構成に合わせた。
- `/camera` のモデル読込を単一URL依存から候補順次読込に変更し、ローカル `public/models` を最優先フォールバックとして扱うようにした。
- `/character` を「単一選択表示」から「キャラクターごとの独立表示」へ変更し、legacy の character/stamp 画面に近い表示・操作フローへ寄せた。

## 技術的な設計判断とその理由
- **ごしょどんの参照先をOBJへ戻す**
  - リポジトリ上で `ごしょどん3.fbx` が削除され、実体が `public/models/goshodon.obj` のみになっているため。
- **cameraはローカル候補を先頭にする**
  - Supabase Storage の移行遅延や signed/public URL の差異があっても、同梱モデルで表示可能にするため。
- **cameraの読込を候補順次試行へ変更**
  - `MTL+OBJ` 失敗時の `OBJ` フォールバック、および候補URLの切り替えを自動化して失敗率を下げるため。
- **character画面をキャラ専用UIへ再構成**
  - カメラ画面に合わせた単一モデル選択ではなく、legacy のようにキャラ単位で独立表示・独立操作できる体験に戻すため。

## 使用しているSupabaseテーブル
- なし（本修正はモデル/アセットURL解決とUI構成のみ）

## 関連ファイルパス一覧
- `src/lib/characters.ts`
- `src/components/camera/CameraCapture.tsx`
- `src/app/character/page.tsx`
- `docs/camera-character-goshodon-legacy-alignment.md`

## セットアップ手順
1. 開発サーバーを起動する。
```bash
bun run dev
```
2. `/camera` で「ごしょどん」を選択し、モデルが表示されることを確認する。
3. `/character` で各キャラクターが独立したカード/3Dビューで表示され、拡大縮小・回転操作できることを確認する。
