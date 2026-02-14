# Supabase接続エラー トラブルシューティング

## エラー内容

```
[supabase] spots fetch error, fallback to mock {
  message: 'TypeError: fetch failed',
  details: 'TypeError: fetch failed\n' +
    '\n' +
    'Caused by: Error: getaddrinfo ENOTFOUND hdyxtzvawjaxkgssnrce.supabase.co (ENOTFOUND)\n' +
    'Error: getaddrinfo ENOTFOUND hdyxtzvawjaxkgssnrce.supabase.co\n' +
    '    at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)\n' +
    '    at GetAddrInfoReqWrap.callbackTrampoline (node:internal/async_hooks:130:17)',
  hint: '',
  code: ''
}
```

## エラーの意味

`ENOTFOUND` (Error NOT FOUND) はDNS解決エラーです。指定されたホスト名 `hdyxtzvawjaxkgssnrce.supabase.co` をIPアドレスに変換できなかったことを示しています。

## 考えられる原因

### 1. 無効なSupabase Project URL

`.env.local` に設定されているSupabase URLが存在しないプロジェクトを指している可能性があります。

**確認方法:**
1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクト設定 > API セクションで正しいURLを確認
3. URLは `https://<project-ref>.supabase.co` の形式

### 2. Supabaseプロジェクトが削除・一時停止されている

無料プランのプロジェクトは、一定期間活動がないと一時停止される場合があります。

**対処方法:**
- Supabase Dashboardでプロジェクトのステータスを確認
- 一時停止中の場合は「Resume project」をクリック

### 3. ネットワーク接続の問題

- インターネット接続を確認
- VPN/Proxy設定がDNS解決を妨げている可能性
- ファイアウォール設定を確認

### 4. 環境変数が正しく読み込まれていない

**確認方法:**
```bash
# 環境変数が設定されているか確認
grep SUPABASE .env.local
```

## 解決方法

### ステップ1: 環境変数の確認

`.env.local` ファイルを開き、以下の形式で正しい値が設定されているか確認:

```env
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### ステップ2: Supabase Dashboardで正しい値を取得

1. https://supabase.com/dashboard にアクセス
2. 対象プロジェクトを選択
3. Settings > API に移動
4. 「Project URL」と「anon public」キーをコピー

### ステップ3: 開発サーバーを再起動

環境変数を変更したら、開発サーバーを再起動:

```bash
# Ctrl+C で停止後
bun dev
# または
npm run dev
```

## 現在の動作（フォールバック）

このアプリケーションでは、Supabase接続に失敗した場合、自動的にモックデータにフォールバックします（`src/lib/supabaseClient.ts`）。

```typescript
if (error) {
  console.warn("[supabase] spots fetch error, fallback to mock", error);
  return mockSpots;
}
```

これにより、Supabaseに接続できない環境でも開発を継続できますが、本番環境では正しい接続設定が必要です。

## ローカルSupabaseを使う場合

ローカルでSupabaseを実行する場合:

```bash
# Supabase CLIがインストールされていることを確認
supabase start

# ローカルのURLとキーが表示されるので、.env.localに設定
# 例:
# NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
# NEXT_PUBLIC_SUPABASE_ANON_KEY="<local-anon-key>"
```

## 関連ファイル

- `.env.local` - 環境変数設定
- `src/lib/supabaseClient.ts` - Supabaseクライアント設定とフォールバック処理
- `src/lib/mockData.ts` - フォールバック用モックデータ
