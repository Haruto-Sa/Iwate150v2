# 公開ページのキーボードフォーカス

320px幅で、画面下のナビに選択中の操作が隠れる問題を修正しました。スクロール余白にsafe-areaを含め、リンク・ボタンだけでなくtabindexで操作する地図にもフォーカス枠を表示します。

カメラの横スクロール欄では、キーボードで選んだキャラクターを表示範囲へ移動します。ポインター操作ではこの移動を追加しません。地図のマーカーが重なった場合は、フォーカス中のマーカーを同じマーカーペイン内の前面に表示します。地図より上のナビやダイアログの重なり順は変更しません。

- `src/app/globals.css`: スクロール余白、tabindex要素の枠、マーカーの前面表示
- `src/components/camera/CameraCharacters.tsx`: キーボード選択時の横スクロール
- `e2e/public-focus.spec.ts`: 公開13ページ、320px/1440px、各ページ先頭12回のTab移動（MacのWebKitではOption+Tab）

テストは表示範囲、中心点での重なり、フォーカス枠、reduced-motion時のCSS遷移・アニメーションを調べます。地図はマーカー初期化後に操作します。全操作・全コントラスト・実機のsafe-area・OSの読み上げを網羅する確認ではありません。DBや追加設定は使用しません。

Macのキー操作は[Safariの公式操作説明](https://support.apple.com/en-lamr/guide/safari/cpsh003/mac)に合わせています。ChromiumとMac WebKitの結果は、実Safari・Firefox・Edgeの実機確認とは区別します。

検証: mainのカメラ分離を取り込んだ状態で、本番ビルド、型チェック、lint（0 errors / 既存4 warnings）、Chromium・Mac WebKitのフォーカス/撮影/ダイアログ90件が成功（2.5分）。
