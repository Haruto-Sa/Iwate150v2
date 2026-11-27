# 公開画面のアクセシビリティ検査

Issue #25 の継続検査。13経路を390×900のlight/darkで読み込み、axe-coreのWCAG 2 A/AA・2.1 AA・2.2 AAタグを検査する。ChromiumとWebKitで実行する。共有API非対応を明示した全画面検査と、対応時の共有ボタンの44px以上の高さ検査を分ける。

ページ入場アニメーション中の一時的な透明度を恒常的な文字色と混同しないよう、reduced-motionとフォント読み込みを待って測定する。失敗・要確認項目・コントラスト計算結果をaccessibility.jsonに保存する。ルールの除外は設けない。

## 修正

- X・LINE共有の文字色を既存のテーマ別カラーに合わせ、すべての共有操作を高さ44px以上にする。共有先や処理は変更しない。
- キャラクター地域名の透明度を70%から80%にする。
- 404の数字にテーマ別の補助文字色を使用する。
- 観光統計のラベル付き領域にgroupロールを付け、汎用divへの未対応ラベルを解消する。

Chromiumの静止状態で、lightのX共有は6.81:1、LINE共有は7.47:1。lightの地域名は4.43:1から5.89:1、404は1.33:1から5.61:1へ改善した。大きな404文字の基準は3:1、地域名は4.5:1。

## 再現

```sh
E2E_SERVER_MODE=production bunx playwright test public-accessibility public-focus spot-detail --project=chromium --project=webkit-ui --workers=1
```

axe-coreは開発依存であり、本番画面では読み込まない。既存ロック内の4.14.0を直接指定する。

## 検証結果

Node 22、production buildを使い、Chromium/WebKitのアクセシビリティ56件・フォーカス52件・スポット詳細14件、計122件が成功。lightの共有ボタンとキャラクター選択欄のスクリーンショットを目視確認した。

## 検査範囲と残件

この検査は初期表示の自動チェックであり、WCAG全体への適合宣言ではない。画像・重なりを含む背景でのコントラストはincompleteとして記録され、手動確認が必要。カメラの字幕検査もincompleteとなるが、対象は音声なしのライブカメラプレビューである。スクリーンリーダー、200%ズーム、実機セーフエリア、実際の共有先への受信は未検証。

関連ファイル: e2e/public-accessibility.spec.ts、playwright.config.ts、src/components/ui/ShareButton.tsx、src/app/character/page.tsx、src/app/not-found.tsx、src/components/ui/SpotCard.tsx。Supabaseテーブル・設定の変更はない。
