# 認証URLと個人APIのOrigin検証

## この変更

Auth.js beta.32は`AUTH_URL ?? NEXTAUTH_URL`を認証URLに使うが、個人APIは`AUTH_URL`のみを参照していた。互換変数`NEXTAUTH_URL`だけを設定した環境では、認証URLと更新APIの送信元判定が一致しなかった。個人APIも同じ優先順位に揃える。

| 設定 | 個人APIの比較基準 |
| --- | --- |
| AUTH_URLあり | AUTH_URLのorigin |
| AUTH_URL未定義、NEXTAUTH_URLあり | NEXTAUTH_URLのorigin |
| 両方未設定または採用値が空 | 既存のrequest.urlのorigin（今後の強化対象） |
| 採用値がURLとして不正 | 503、更新しない |

AUTH_URLが空文字のときにNEXTAUTH_URLを再採用しない点もAuth.jsに合わせる。両方に異なるURLを設定する運用は推奨しない。URLを厳密に検証する新しい設定契約や未設定時の拒否は本変更には含まない。

## 設定移行の手順

1. Productionと認証用Previewそれぞれの正規originを決める。`AUTH_URL`にその環境の公開URLを設定し、OAuthプロバイダーのcallbackを同じoriginの`/api/auth/callback/google`または`/api/auth/callback/github`へ合わせる。ProductionのURLを全Previewへ流用しない。
2. 現コードのOAuth有効化条件は`AUTH_GOOGLE_ID`と`AUTH_GOOGLE_SECRET`、`AUTH_GITHUB_ID`と`AUTH_GITHUB_SECRET`の対。旧`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`、`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`だけでは有効にならない。値を公開Issue・ログへ貼らず、サービス管理者が環境別に新名へ移行する。
3. `AUTH_SECRET`を設定する。Auth.jsの互換用`NEXTAUTH_SECRET`は既存Cookieに関わるため、名前変更と秘密値ローテーションを同時に行わない。ローテーションは別作業としてセッション失効の影響を確認する。
4. 環境変数の適用にはデプロイが必要。既存設定をすぐに削除せず、ログイン、callback、セッション、本人データ更新、ログアウトを実環境で確認してから旧設定を整理する。

このPRでは外部設定・秘密値・OAuth登録・本番デプロイを変更していない。`.env.example`のlocalhostはローカル開発用で、Productionの値ではない。

## 検証と限界

実route handlerを呼ぶ単体テストで、互換URLの採用、request由来originの拒否、優先順位、不正設定で非更新を確認する。DBは所有者条件を評価するインメモリfixture、セッションはmock。実OAuthやVercelのヘッダー処理を検証した証拠ではない。

変更前は新規ケースのうち3件失敗、変更後は成功。未設定時のrequest URL fallback、`trustHost: true`、URLのscheme/path等の厳密検証、本番での設定必須化はIssue #35の残件。Host偽装による実環境の侵害を再現したという主張ではない。

PR #49ではOrigin処理が`apiGuards.assertSameOrigin`へ移動する。統合時は本変更の優先順位と回帰ケースを共通ガードへ移す必要がある。こちらはPR #62を基底とし、#49の共通化がこの修正を上書きしないようにレビューする。

最終検証: 単体148件、型検査、本番ビルド、Chromium E2E19件成功。lintエラー0・既存警告7。独立セキュリティレビューで、この限定差分にブロッカーなし。
