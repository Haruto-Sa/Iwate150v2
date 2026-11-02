# 依存関係のセキュリティ修正統合（2026-11-02）

## 目的
Dependabotが検出した古いNext.jsなどの脆弱性に対処し、Bunのlockfile全体を継続監査する。

## 修正範囲
- PR #62のNext.js 16.4.3 / Auth.js beta.32への更新、未使用nodemailerと古いpackage-lock.jsonの削除、Bearer回帰テスト
- PR #65のSerwist 9.5.13 / Vitest 4.1.12 / baseline-browser-mapping 2.11.34 / Zod override 4.6.7、および日次Bun監査
- 2026-10-29のmainにある最新UI・カメラテスト・Playwright 1.64.0を維持
- 旧Next.js 16.0.8用の未使用パッチを削除

## 検証
過去のPR #65では2026-10-28にBun監査0件を報告しているが、これは以前のベースでの結果。本ブランチの統合についてはGitHub ActionsのCI、全ブラウザE2E、監査、Vercelプレビューを新たに確認すること。

- [ ] `bun install --frozen-lockfile`
- [ ] `bun run lint` / `bun run typecheck`
- [ ] `bun run test` / `bun run build`
- [ ] `bun audit --json` の正常な空レポート
- [ ] Playwright E2E（Chromium / screenshots / WebKit / iPhone / Android）
- [ ] Vercelの本番と同等のBun設定、実OAuth、DB接続の確認

Bunの依存監査結果が0件でも安全性全般を保証しない。GitHubのDependabotに依存グラフ上の検出範囲の限界があるため、Bun lockfileの監査を併用する。手動dismissだけで脆弱性を処理しない。

先行PR: #62, #65。JSON-LD、PWAプライベートキャッシュ、origin整合は別PR #63, #64, #66。
