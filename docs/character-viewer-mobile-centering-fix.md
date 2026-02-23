# Character表示の中心ズレ・モバイル崩れ修正

## 発生条件

- `/character` をスマホサイズで初回表示したとき、モデルが見えないことがある。
- 画面サイズを変更するとモデルが見える場合がある。
- スマホ幅でテキストや選択ボタンの配置が崩れることがある。

## 根本原因

1. リサイズ時にレンダラーサイズは更新されるが、モデルの再フレーミングが十分に再計算されていなかった。
2. `renderProfile.positionOffset` が適用されることで、表示ウィンドウ中心から外れるケースがあった。
3. `/character` の情報領域・選択ボタンで、スマホ幅時の折返しと最小幅制約が不足していた。

## 修正内容

1. `CharacterViewer` にて、リサイズ時にモデルのフィット・センタリングを再実行するように変更。
2. `camera` / `controls` を `useRef` で保持し、初期表示とリサイズで同じフィット経路を使うように統一。
3. `CharacterViewer` に `disableProfilePositionOffset?: boolean` を追加し、`/character` では `true` を指定して中心固定。
4. `/character` の3D表示枠を `aspect-square` 基準に変更し、モバイルで安定表示。
5. `/character` のテキスト・タグ・選択ボタンに `break-words` / `min-w-0` / 行間調整を追加し、崩れを抑制。

## 影響範囲

- 直接影響: `/character`
- コンポーネントAPI変更: `CharacterViewer` に `disableProfilePositionOffset` を追加
- 非影響: `/camera` の既存モデル追従ロジック

## 関連ファイル

- `src/components/character/CharacterViewer.tsx`
- `src/app/character/page.tsx`

## 検証観点

1. スマホ初回表示でモデルが表示ウィンドウ中心に見える。
2. スマホ→PC→スマホのリサイズ往復でも視界外に飛ばない。
3. キャラ切替時も中心表示が維持される。
4. スマホ幅でタイトル・説明・タグ・選択ボタンが崩れない。
5. `bunx tsc --noEmit` が通る。
