# OAuth未有効エラー対策 + Character FBX対応

## 機能概要
- `/login` の Google/GitHub OAuth で `Unsupported provider` が返る場合に、ユーザー向けメッセージへ変換する。
- 未有効と判定された OAuth ボタンはセッション中に無効化し、同じエラーの連続発生を防ぐ。
- `/character` のモデルローダーを OBJ/MTL に加えて FBX 対応に拡張する。
- `goshodon` のモデル参照を、現在の同梱ファイル構成に合わせて `models/goshodon.obj` に設定する。
- `camera` 側も FBX 読み込みを追加し、キャラ定義変更による回帰を防ぐ。

## 技術的な設計判断とその理由
- OAuth エラーは Supabase 側設定不足（Authentication > Providers 未有効）で発生するため、クライアントで判別して設定誘導メッセージを出す。
- OAuth ボタン表示は `NEXT_PUBLIC_SUPABASE_OAUTH_PROVIDERS`（例: `google,github`）で制御可能にし、環境ごとの差分をUIに反映できるようにした。
- Character/Camera の双方でモデル形式判定を導入し、拡張子に応じて `OBJLoader` / `FBXLoader` を使い分ける。
- `goshodon` は同梱済み `public/models/goshodon.obj` を優先し、配信・参照ずれ時の読み込み失敗を避ける。

## 使用している Supabase テーブル
- `auth.users`（ログインセッション）
- `users`（ログイン後の表示名利用）

## 関連ファイルパス一覧
- `src/lib/auth.ts`
- `src/app/login/page.tsx`
- `src/components/character/CharacterViewer.tsx`
- `src/components/camera/CameraCapture.tsx`
- `src/lib/characters.ts`
- `docs/auth-oauth-character-fbx-fix.md`

## セットアップ手順
1. Supabase Dashboard で OAuth Provider を有効化する。
   - `Authentication > Providers > Google`
   - `Authentication > Providers > GitHub`
2. 必要に応じて `.env.local` に OAuth 表示対象を設定する。
```bash
NEXT_PUBLIC_SUPABASE_OAUTH_PROVIDERS=google,github
```
3. 開発サーバーを再起動する。
```bash
bun run dev
```
4. 動作確認を行う。
   - `/login` で OAuth エラーが日本語メッセージに変換されること
   - `/character` で `ごしょどん` を選択してモデル表示されること
   - `/camera` で `ごしょどん` 選択時にモデルが表示されること
