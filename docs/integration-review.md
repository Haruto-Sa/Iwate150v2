# 未完了Issueの統合検証

個別PRだけでは確認できない組み合わせを、一つの作業ツリーで検証する。GitHubの元PRはマージしない。これは未完了Issue全件の完了宣言ではない。

## 取り込み対象

| PR | 検証開始時のhead | ブランチ |
| --- | --- | --- |
| [#36](https://github.com/Haruto-Sa/Iwate150v2/pull/36) | `b7a3a1f` | `feat/issue-25-detail-map` |
| [#37](https://github.com/Haruto-Sa/Iwate150v2/pull/37) | `5665040` | `feat/issue-31-camera-timer` |
| [#38](https://github.com/Haruto-Sa/Iwate150v2/pull/38) | `7827d9e` | `feat/issue-30-camera-readiness` |
| [#39](https://github.com/Haruto-Sa/Iwate150v2/pull/39) | `d1237d3` | `feat/issue-32-camera-video` |
| [#40](https://github.com/Haruto-Sa/Iwate150v2/pull/40) | `bed7313` | `chore/issue-35-dependency-updates` |
| [#41](https://github.com/Haruto-Sa/Iwate150v2/pull/41) | `271630b` | `fix/issue-34-user-sync-writes` |
| [#42](https://github.com/Haruto-Sa/Iwate150v2/pull/42) | `fc11baf` | `feat/issue-34-delete-own-data` |
| [#43](https://github.com/Haruto-Sa/Iwate150v2/pull/43) | `fc0f493` | `fix/issue-35-studio-data` |
| [#44](https://github.com/Haruto-Sa/Iwate150v2/pull/44) | `70e0140` | `feat/issue-14-menu-language` |
| [#45](https://github.com/Haruto-Sa/Iwate150v2/pull/45) | `8d438d8` | `feat/issue-16-page-guides` |
| [#46](https://github.com/Haruto-Sa/Iwate150v2/pull/46) | `b907885` | `feat/issue-10-spot-statistics` |
| [#47](https://github.com/Haruto-Sa/Iwate150v2/pull/47) | `56c36b2` | `feat/issue-17-app-icons` |
| [#48](https://github.com/Haruto-Sa/Iwate150v2/pull/48) | `c9155bb` | `feat/issue-15-color-theme` |
| [#49](https://github.com/Haruto-Sa/Iwate150v2/pull/49) | `c91b66b` | `fix/issue-35-api-guards` |
| [#50](https://github.com/Haruto-Sa/Iwate150v2/pull/50) | `e25ac87` | `feat/issue-9-official-spots` |
| [#51](https://github.com/Haruto-Sa/Iwate150v2/pull/51) | `357987c` | `fix/issue-8-character-previews` |
| [#52](https://github.com/Haruto-Sa/Iwate150v2/pull/52) | `d6a4f04` | `feat/issue-29-municipal-boundaries` |
| [#53](https://github.com/Haruto-Sa/Iwate150v2/pull/53) | `25d577a` | `fix/issue-25-stamp-layout` |

## 競合解決で維持する動作

- 撮影: 通常撮影、タイマー取消し、期限付きモデル読み込み、動画の再生・保存・共有を維持し、操作部分を既存の外観トークンへ接続する。映像自体は反転しない。
- キャラクター: 選択したモデルのプレビューと `object-contain` を維持し、テーマ背景を使う。
- 検索と詳細: hydration前の入力抑止、出典付き統計、写真なし施設の空枠除去、サンプル保存禁止を維持する。
- 管理: 取得失敗を0件と表示せず、簡潔な日本語見出しとテーマ色を保持する。
- 本人データ: 全削除を共通のOrigin/8KiB/5秒本文制限へ接続する。旧本文リーダーを復活させず、サイズ超過・タイムアウト時には削除しないことをテストする。
- テスト: Playwrightの対象を和集合にし、どのPRのiPhone/Android/WebKitテストも除外しない。

## 組み合わせで発見した問題

削除エラーの固定赤色は、ダーク背景上の実描画でコントラスト比2.09だった。意味別エラー色へ置き換え、明暗両方で4.5以上と再試行操作を検証する。録画停止アイコンも同じエラー色へ合わせる。

PR #53のCIでは撮影用テストだけが旧見出しを参照していた。見出し変更を `e2e/screenshots.spec.ts` にも反映する。

## 再検証

```sh
bun run test:unit --maxWorkers=2
bun run typecheck
bun run lint
E2E_SERVER_MODE=production bunx playwright test --project=chromium --project=webkit-ui --project=iphone --project=android --workers=2
```

Playwrightが起動するサーバーは実DB・OAuth設定を無効にしたモック環境。認証済みUIテストも本人APIを差し替えており、本番データ削除は行わない。ソフトウェア描画の撮影検証は実機の熱・速度・カメラ品質の証拠とは区別する。

## 検証結果（2026-10-24）

- 56ファイル・621単体テスト成功。型検査・本番ビルド成功。lintはエラー0、既存警告7。
- 初回統合E2Eは306成功、2対象外、旧見出し参照3失敗。対象外はタッチ端末のホイール操作。旧見出しを修正したChrome/WebKitの6ケースは成功。
- 最終ビルドで削除失敗の明暗8ケース、ダークでの動画録画・再生・保存4ケース、スタンプ撮影6ケースの計18件成功。実ブラウザー描画で削除エラーのコントラスト4.5以上を検証。
- [削除エラー変更前](screenshots/integration/delete-dark-before.png) / [変更後](screenshots/integration/delete-dark-after.png)。変更前はChromium 390px、変更後はiPhoneプロファイル390pxで撮影。
- 既存18PRのheadをコミット祖先関係で確認。PR #53の旧見出し修正 `25d577a` も取り込み済み。

## 残る確認

- iPhone実機とAndroidエミュレーターの写真・動画。Android Chromeの初回設定が未完了。
- 本番DBの移行適用先とバックアップ確認、実OAuth/本人保存の通し確認。
- Issue #29 と #34 の座標履歴保存方針。市町村境界は基盤のみで、取得API/画面/永続保存は未接続。
- Issue #8 の追加2モデルの利用条件・モデル入手。既存5体のプレビュー修正と区別する。
- Issue #33の未完リファクタリング（Storage設定、データ層分割、Character/Camera責務分割、未使用UI基盤、設定・ドキュメント整合）。部分的に実装済みの項目も原手順と照合する。
- 最終的な独立レビューとユーザーによるマージ判断。

## CI実行の分割

統合後の358テストは、1ジョブ・2ワーカーで全体10分の期限に達し、154件が未実行となった（run 40034408956）。CIを既存の5プロジェクト別ジョブへ分割し、各ジョブは1ワーカーにしてソフトウェア3D描画の同時実行を抑える。対象プロジェクト、テストごとの期限、全体10分・ジョブ15分の上限は維持する。1環境の失敗で他環境を中断せず、診断ファイルもプロジェクト別に保存する。

同runではAndroidのキャラクタープレビュー2件が個別期限でも失敗しており、ジョブ分割だけで修復済みとは扱わない。traceと分割後CIで別途確認する。
