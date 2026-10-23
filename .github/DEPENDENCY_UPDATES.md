# 依存更新

DependabotでBun依存とGitHub Actionsを毎週月曜09:00（日本時間）に確認する。
Bunの更新PRは最大5件、Actionsは最大2件。同時更新が必要なNext.js、React、Serwist、Tailwindだけをグループ化し、それ以外は個別にレビューする。
メジャー更新を除外せず、自動マージは設定しない。

## 有効化と確認

`.github/dependabot.yml` がデフォルトブランチにマージされてから有効になる。
PR上での構文検証だけでは更新処理の成功は確認できない。マージ後はGitHubの依存グラフ内のDependabot画面で初回ジョブのログと作成PRを確認する。
セキュリティアラートやセキュリティ更新の有効状態はリポジトリ設定で別途確認する。このファイルだけで有効化されたとは扱わない。

## 更新PRのレビュー

1. リリースノート、破壊的変更、`package.json` と `bun.lock` の差分を確認する。
2. 次の組合せを確認し、必要なら同じ更新PRで修正する。
   - Next.js: `patchedDependencies` と `patches/next@*.patch`。画像最適化のクライアント切断対策が上流で修正されたかを確認し、パッチの再適用または削除を判断する。更新失敗を解消するためだけに対策を削除しない。
   - Playwright: `@playwright/test` と `.github/workflows/e2e.yml` のコンテナーの版。ブラウザー同梱版と一致させる。
   - Three.js: `three` と `@types/three` の対応。
   - 固定された `overrides` と要求バージョンの整合性。
3. CIの `lint`、`typecheck`、単体テスト、ビルド、全ブラウザーE2Eを確認する。失敗した更新は原因を解消するまでマージしない。
4. カメラ・共有・認証・地図などに影響する更新は、対象機能をiPhone SafariとAndroid Chromeでも確認する。CIの端末プロファイルだけでは実機確認済みにしない。

Bun本体、Node.js、Playwrightのコンテナー、外部CDN資産はこの設定だけでは連動更新されない。依存更新のレビュー時に `.node-version`、CIのBun固定版、コンテナー、CDN参照も確認し、必要な変更を別PRまたは同じ関連PRへ含める。

参考: [GitHub公式Dependabot設定リファレンス](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
