# 配信設定の事前確認

本番モードで配信ポリシーの候補をReport-Onlyヘッダーとして並行出力します。既存の適用ポリシーは維持し、候補の影響をブラウザー内で確認してから適用を判断します。報告の外部送信先は設定しません。

公開アセットの設定は`NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_MEDIAPIPE_FACE_MESH_ASSET_BASE`からオリジンのみを使用します。DBや追加環境変数の設定は不要です。開発サーバーのホットリロードには適用しません。

- 設定: `next.config.ts`
- 候補の生成: `src/lib/headerPolicy.ts`
- URLの扱い: `src/lib/headerPolicy.test.ts`
- ブラウザーでの観測・実行継続: `e2e/header-policy.spec.ts`

候補の観測は、全環境での強制適用や実OAuth・実DBの動作確認を意味しません。環境ごとのアセットと操作の確認記録は非公開の`documents/header-policy-observation.md`に残します。
