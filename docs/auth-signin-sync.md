# サインイン時のユーザー同期（Issue #34）

## 動作と設計

`src/auth.ts` は検証済みGoogle/GitHub OAuth callbackでのみ本人識別子を確定し、`syncAppUserFromIdentity` を呼ぶ。通常のJWT読み取り・クライアントのsession updateではDB同期しない。これにより、自分のデータを削除した直後に古いCookieを読み取っても `users` 行を再作成しない。次のOAuthログインで初めて同期する。

プロフィール（email/name/picture/displayName）はサインイン以外のJWT更新でも削除する。クライアントが送った本人ID・ロールは採用しない。JWTのroleはサインイン時の値になるが、Studioのページ/API認可は現在のDBロールを読むため、降格後に古いJWTで書き込むことはできない。

## テーブル・既存動作

同期先は `users`。自己削除で関連する `favorites`・`stamps` も削除される既存仕様は変更しない。削除後の古いセッションで本人用APIへアクセスすると所有者行が見つからず503となり、自動再作成しない。画面の既存ログアウトと再ログインを使用する。

## 関連ファイル

- `src/auth.ts` / `src/auth.test.ts`
- `src/lib/authServer.ts`
- `src/lib/privateUserApi.ts`
- `src/lib/studioApi.ts` / `src/lib/studioRoutes.test.ts`
- `src/app/studio/page.test.tsx`

設定変更・SQL適用は不要。JWT有効期限、HMAC識別子への移行、位置情報の保存方針は別途残件。

## 検証境界

回帰テストでは通常アクセス時に同期関数を呼ばないこと、再ログイン時に呼ぶこと、プロフィール除去、クライアント更新の無視、Studioの最新DB権限による許可/拒否を確認する。OAuth/DBはモックであり、実サービスでの自己削除→再ログイン確認とは区別する。
