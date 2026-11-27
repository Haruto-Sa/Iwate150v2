# 使用するUI基盤

LiftKit由来のファイルは、アプリが利用するものを保守対象にします。

- グローバルCSS: `liftkitvars.css`、`background-colors.css`
- コンポーネント: `button`、`icon`、`state-layer`、公開ラッパーの `ui/Button.tsx`
- 型: `lk-color.d.ts`、アイコンが参照する `lk-typography.d.ts`
- 関連処理: `utilities.ts`、`colorUtils.ts`、`utils/debugUtils.ts`

読み込まれない35CSS、型定義4ファイルと壊れた型再公開ファイル、未使用配列を削除しました。取り込み用CLIは利用しないため `liftkit add` と依存パッケージも削除します。使用中のコンポーネント・CSS・型の内容は変更しません。

確認は型検査・単体テスト・lint・本番ビルドと、ホーム/検索/ログインをChrome/WebKit・320/390/1440pxで変更前後比較します。DBや環境変数の変更はありません。

検証結果: 単体658件、型検査・本番ビルドが成功。lintはエラー0・警告6件（未使用変数の警告1件減）。比較18画面中17枚が初回で完全一致し、WebKitログイン390pxの撮影高さ差は同条件の再撮影で完全一致しました。生成CSS5ファイルもSHA-256がすべて一致しています。比較記録は [liftkit-visual-validation.json](liftkit-visual-validation.json)。実機での検証は含みません。
