# キャラクタービューアの描画ライフサイクル分離

## 概要

Issue #33 R5の残りの描画ループとリサイズ監視を`characterRuntime.ts`へ移動。背景・カメラ生成は既存の`characterScene.ts`へまとめ、`CharacterViewer.tsx`は518行、主要effectのcallbackは149行にする。

## 設計判断

- effectの9項目の依存配列、モデル候補の順序、タイムアウト、再試行回数は維持する。
- viewportが0のときの最大360フレーム待機と、WebGLRenderer生成のtry/catch・早期returnはeffect内に残す。
- fit後のref/state更新、自動再試行の判断、破棄後のref初期化はコンポーネント内のcallbackに残す。callbackの依存条件は既存のeffect依存に含まれる。
- 各描画フレームは次のフレームを予約し、現在の回転フラグとモデル参照を読む。その後controls.update、renderer.renderの順序を保つ。
- リサイズはaspect、projection、rendererサイズの更新後にfitを呼ぶ。ResizeObserverがない環境ではwindow.resizeを監視する。
- cleanupはキャンセル印、監視終了、再fit予約取消、描画予約取消、controlsとrendererのdispose、ref初期化、objectとcanvasの除去の順序を維持する。
- カメラ撮影側のモデルローダーとは統合しない。ログの接頭辞と内容を維持する。

## 関連ファイル

- `src/components/character/CharacterViewer.tsx`
- `src/components/character/characterRuntime.ts`
- `src/components/character/characterRuntime.test.ts`
- `src/components/character/characterScene.ts`
- `e2e/character-assets.spec.ts`

## データ・セットアップ

Supabaseテーブルの追加・変更なし。Node 22とBunで既存のセットアップを使用する。

## 検証

- 変更前のChromium/iPhone全5モデル表示・拡大・縮小・回転・リセット：2件通過。各モデルのPNGを比較用に保存。
- 描画の順序、最新refの参照、予約の取消、ResizeObserver有無、0サイズ時の寸法フォールバックと監視解除：単体3件通過。
- 最終差分の全単体754件・72ファイル通過。型検査、lint通過（既存4警告）。本番ビルド成功。
- 4プロファイルのキャラクターE2E32件通過。モデル失敗時の再試行と画像遅延を含む。
- モデル全体の画像を撮影できるよう、既存の操作後スクリーンショットに加え、先頭へ戻したfullPageスクリーンショットを追加。変更前後それぞれChromium/iPhoneの2件通過。
- 全体画像10枚の比較では9枚が完全一致。iPhoneのケロ平だけリセットボタン領域（x=776〜1037、y=1325〜1529）に43,281画素の差があり、モデル領域は一致。ボタン押下後の表示状態差を画像で確認。PCとスマホ幅のモデル全体を目視した。
- effect callbackは149行（依存配列を除く）。viewport待機とrenderer生成の早期returnは保持。
- ブラウザープロファイルでの検証は実機Safari/ChromeやQuestでの確認を意味しない。
