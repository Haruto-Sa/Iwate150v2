# ランタイム依存のセキュリティ更新（2026-10-28）

Issue #61 / #35。main `d70c76a` を基点とする独立した変更。機能追加のPR群には依存しない。

## レビューの要点

| 対象 | 更新前の解決版 | 更新後 | 確認すること |
| --- | --- | --- | --- |
| Next.js | 16.0.8 | 16.4.3 | ページ・画像・認証ルートの互換性 |
| next-auth | 5.0.0-beta.30 | 5.0.0-beta.32 | 既存のGoogle/GitHub設定を維持 |
| @auth/core | 0.41.0 | 0.41.3 | 不正Bearerを例外にせず未認証として扱う |
| sharp（間接依存） | 0.34.5 | 0.35.5 | Next.jsの依存更新で解決 |
| nodemailer / 型定義 | 6.10.1 / 6.4.23 | 削除 | 登録済み認証プロバイダーはGoogle/GitHubのみ。メール送信の実装から参照なし |
| ロックファイル | bun.lock / package-lock.json | bun.lockのみ | 既存CIと同じBunによる解決に統一 |

`package.json` と `bun.lock` を先に確認し、次に `src/lib/authDependency.test.ts` を確認する。
`package-lock.json` の削除が差分の大半を占める。アプリの認証設定・DBスキーマ変更はない。
`e2e/camera-capture.spec.ts` のSwiftShader指定はヘッドレス検証専用で、本番ブラウザの設定には影響しない。

## 監査結果

Bun 1.3.4の `bun audit --json` を更新前後で実行した。同一パッケージに複数範囲の指摘が含まれるため、以下は **package/advisory/rangeレコード数** であり、ユニークなCVE数・本アプリで成立する攻撃数ではない。

| 指標 | 更新前 | 更新後 |
| --- | ---: | ---: |
| 指摘のあるパッケージ | 26 | 21 |
| 指摘レコード合計 | 140 | 65 |
| critical | 10 | 3 |
| high | 62 | 36 |
| moderate | 60 | 23 |
| low | 8 | 3 |

今回のBun監査では、対象のNext.js / next-auth / @auth/core / sharp / nodemailerの指摘がなくなった。
**全体監査は未合格**（終了コード1）。残るcriticalは開発用のtinypool / vitestだが、開発環境の安全性も別途対処が必要。
残存パッケージ・範囲・アドバイザリURLは [監査記録](security-dependency-audit-2026-10-28.json) に保存した。監査元の重大度が上流アドバイザリの評価と異なる場合があり、個別の影響判断が必要。

## 検証と限界

Node 22.23.4 / Bun 1.3.4。ブラウザ検証は実DB・OAuthを無効にしたローカル本番ビルドを使用。

| 検証 | 結果 |
| --- | --- |
| 空ディレクトリから `bun install --frozen-lockfile --ignore-scripts` | 成功、533パッケージ。nodemailerのインストールなし |
| 単体テスト | 30ファイル・143件成功（更新前は29ファイル・140件成功） |
| 不正Bearer回帰（getToken単体） | 3ケース成功。旧解決版はURIError、新解決版はnull |
| lint | エラー0、既存警告7 |
| 型検査 | 成功 |
| 本番ビルド | Next.js 16.4.3で成功 |
| 標準Chromium E2E（SwiftShader明示前） | 18成功・カメラ1失敗。トレースにWebGLコンテキスト作成失敗 |
| 拡張4プロファイル（SwiftShader明示後） | 69成功・5失敗。下記参照 |
| 最終・標準本番モードChromium（再ビルド） | 19/19成功、PWA含む。元の5秒待機条件 |

拡張検証はDesktop Chrome、Pixel 5、Desktop Safari、iPhone 13のPlaywrightプロファイル。Android OSエミュレーター・iPhone実機の結果ではない。

- Chromium: 18/19成功。カメラ準備完了の5秒待機で失敗。個別再実行では撮影→編集→PNGが2.6秒で成功。さらに元の5秒待機条件による再実行は18件成功・PWA 1件スキップ（実行モードの指定不足）だった。続いて標準設定で再ビルドし本番モードを指定した最終実行ではPWAを含む19/19件が成功した。先の失敗は再現していないが、再現条件は未確定。
- Pixel 5: 19/19成功（仮想カメラを含む）。
- WebKit / iPhone: 各16/18成功。カメラ不在時のエラー表示待機と画像の表示枠の縦横比で失敗。共有ファイル自体の800×600と編集前後の内容変化の検証は成功。カメラ不在のエラー表示は診断用の20秒待機でも失敗した。旧版との比較が未実施のため、既存不具合か更新による回帰かは未確定。
- WebKit系ではChrome用仮想カメラ引数を使う撮影テストを拡張検証の対象外にした。カメラ互換性を確認できたことにはならない。

テストの失敗を通すためのタイムアウト緩和・アサーション削除はコミットしていない。実OAuthログイン、実DB、本番環境、物理カメラ、OS共有先への到達は未検証。

## リリース前確認と残作業

- E2Eの未解決結果を切り分け、実OAuthコールバックとセッションをステージングで確認してからマージ判断する。
- VercelのカスタムInstall Commandがnpmを固定していないか確認する。本変更では管理画面の設定を確認していない。既存GitHub Actionsは `bun install --frozen-lockfile` を使用している。
- `eslint-config-next` は16.0.8のまま。残りの開発依存更新・定期監査とともにIssue #61で追跡する。現時点で定期監査の追加は未実施。
- 本変更を戻すと既知の脆弱な解決版へ戻る。障害時は影響機能の一時停止・修正版の前進適用を優先し、やむを得ないrevertは監査再実行と公開範囲の判断を伴わせる。
- マージ・本番デプロイは実施していない。レビュー用の変更であり、侵入を防げる保証ではない。

## 上流情報

- [Next.js Security Update — October 14, 2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
- [Auth.js beta.32 release](https://github.com/nextauthjs/next-auth/releases/tag/next-auth%405.0.0-beta.32)
- [Auth.js malformed Bearer advisory](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-8fpg-xm3f-6cx3)
