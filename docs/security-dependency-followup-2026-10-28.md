# 残存依存の更新と継続監査

Issue #61 / #35、PR #62を基底とする追加対応。2026-10-28のBun 1.3.4監査では、PR62後の **21パッケージ・65レコード → 0件**（出力 `{}`、終了コード0）。
レコード数はpackage/advisory/rangeの件数で、ユニークCVE数や本アプリで成立する攻撃数ではない。既知アドバイザリに対する確認であり、侵入されないことを保証するものではない。

## 更新範囲

| 直接依存 | 更新前 | 更新後 | 理由 |
| --- | --- | --- | --- |
| vitest | 3.2.4 | 4.1.12 | Vitest・mockerの指摘と旧tinypool依存を解消 |
| @serwist/next / serwist | 9.5.7 | 9.5.13 | 脆弱なBrowserslist等の固定依存を更新 |
| baseline-browser-mapping | 2.10.0 | 2.11.34 | 古いデータ処理の指摘を解消し旧overrideを除去 |

他の直接依存の解決版は維持した。Babel、Vite、PostCSS、glob関連等の間接依存は、既存の依存範囲で修正版を再解決した。Next.js16.4.3、Auth.js beta.32、React19.2.1、Supabase2.87.1等を追加で更新していない。

### Zod override

Serwist9.5.13はZod4.6.5を固定しており、[メモリ消費に関する指摘](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) の修正範囲外だったため、`overrides.zod = 4.6.7` を追加した。同じ4系だが上流の固定版を上書きするため、ビルド・PWAを含むE2Eで互換性を確認した。全利用元を含むfrozen installも確認した。
上流が修正版を採用した時点でoverrideを削除し、監査・ビルド・E2Eを再実行する。

### ESLint設定の残作業

`eslint-config-next`16.4.3への更新では既存コードの`react-hooks/set-state-in-effect`8件が新たにエラーになった。本PRでは16.0.8と`eslint-plugin-react-hooks`7.0.1を維持した。ルール抑制やアプリの振る舞いの変更は追加していない。
後続でCameraCapture、PhotoSharePanel、LeafletMap、SearchSurface、StudioEventsManager、StudioSpotsManagerの状態更新を検証し、lint設定を更新する。古いlint設定の継続を恒久対応とはしない。

## 継続監査

`.github/workflows/security-audit.yml` は以下でlock全体を監査する。

- package.json / bun.lock / 監査workflow変更のPRとmain/developへのpush
- 毎日08:00 JSTの定期実行（GitHubのデフォルトブランチ）
- workflow_dispatchによる手動実行

権限はcontents:readのみ。依存のインストール・ライフサイクルスクリプト・アプリは実行しない。checkoutの認証情報保存を無効にし、利用Actionsを公式リポジトリで確認したSHAに固定する。重大度フィルター、ignore、continue-on-errorは追加しない。JSON結果を成功・失敗とも14日間artifactに残す。

Bun1.3.4には空のレジストリ応答を終了コード0にする挙動があるため、結果が有効な空JSONオブジェクトであることも検査する。HTTP500/不正JSON/空応答をローカル模擬レジストリで確認し、追加検査では `{}` のみ成功、空文字・配列・null・エラーオブジェクト・指摘入り・不正JSONは失敗することを確認した。

定期監査はデフォルトブランチにマージされてから有効になる。失敗時はActionsのログ/artifactで内容を確認する。依存を修正してfrozen install、監査、関連テストを実行する。監査サービス障害は未検証として扱い、指摘なしに読み替えない。

## ローカル検証

Node22.23.4 / Bun1.3.4。実DB・OAuthを無効にしたローカル本番ビルドで実施。

| 検証 | 結果 |
| --- | --- |
| bun audit --json | `{}` / exit 0 |
| 空ディレクトリでのfrozen install | 成功 |
| 単体 | 30ファイル・143件成功 |
| lint | エラー0、既存警告7 |
| 型検査・本番ビルド | 成功 |
| Chromium E2E | 19/19成功、撮影・共有・PWA含む |
| 監査結果の異常系検証 | 空応答等を追加検査で失敗扱い |

実OAuth、実DB、実機、全てのブラウザの互換性を証明するものではない。管理画面キャッシュ保護PR64は別変更であり、本PR単独には含まない。統合時にもその回帰テストを確認する。

上流仕様: [Vitest 4移行ガイド](https://v4.vitest.dev/guide/migration.html)、[Bun audit](https://bun.sh/docs/pm/cli/audit)。Bunの現行ドキュメントと固定した1.3.4の差は、実行結果に基づいて扱った。
