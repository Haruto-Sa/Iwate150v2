# ESLint設定更新への対応（Issue #61）

eslint-config-next 16.4.6で既存のeffect内state更新が指摘されるため、外部同期とReact内の状態調整を分けて確認する。

## Studioフォーム

編集対象の参照が変わったときだけ、フォームとエラーをレンダー中に同期する。以前と同じ参照比較を使い、編集中の入力や通信中状態を不要にリセットしない。条件内で比較対象も更新するため再レンダーは有限。対象切り替え後に古いフォームが一度DOMへ出ることも防ぐ。

関連ファイル: `src/components/studio/StudioEventsManager.tsx`、`StudioSpotsManager.tsx`と各テスト。DBスキーマ・API・使用テーブルの変更なし。

根拠: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
