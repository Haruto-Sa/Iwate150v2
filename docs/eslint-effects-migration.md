# ESLint設定更新への対応（Issue #61）

eslint-config-next 16.4.6で既存のeffect内state更新が指摘されるため、外部同期とReact内の状態調整を分けて確認する。

## Studioフォーム

編集対象の参照が変わったときだけ、フォームとエラーをレンダー中に同期する。以前と同じ参照比較を使い、編集中の入力や通信中状態を不要にリセットしない。条件内で比較対象も更新するため再レンダーは有限。対象切り替え後に古いフォームが一度DOMへ出ることも防ぐ。

関連ファイル: `src/components/studio/StudioEventsManager.tsx`、`StudioSpotsManager.tsx`と各テスト。DBスキーマ・API・使用テーブルの変更なし。

根拠: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes

## 検索・地図・本人データ

- 検索の操作可否は`useSyncExternalStore`のserver/client snapshotで決め、SSRでは無効、hydration後に有効にする。条件変更時のページ番号・待機・エラーは条件キーで同期する。ジャンル解除はイベントタブの選択操作で行う。中断済みレスポンスは結果へ反映しない。
- 地図の親指定位置はpropsから直接使い、ブラウザーの位置取得結果と分離する。親位置への切替・アンマウント後に届く古い位置取得は無視する。
- お気に入り・スタンプの表示状態はidentity/status/revision変更時、古い情報をDOMへ反映する前に初期化する。APIリクエストの世代管理・キャンセル・busy refは従来どおりeffectで同期し、保存API・旧データ取り込み規則は変更しない。
- カメラの選択モデルrefは利用するコールバックより前で宣言する。モデル選択を空にしたときの表示状態初期化は条件付きレンダーで行い、外部描画ループ用refの更新はeffectに維持する。

## 外部リソース同期の行単位例外

`react-hooks/set-state-in-effect`全体は有効のまま。次の3か所だけ、外部リソースのライフサイクルを保つため理由付きで例外とする。

1. `CameraCapture`: SSRにないMediaRecorder対応状況をマウント後に表示へ反映。
2. `CameraCapture`: カメラ・WebGL起動と開始中表示を同期。非同期遅延を追加して警告を迂回しない。
3. `PhotoSharePanel`: effectで生成・破棄するBlob URLを表示へ反映。レンダー中のURL生成や破棄漏れを避ける。

`useCaptureTimer`では不要になった既存の例外指定を削除する。

## 確認

Studio 8件、検索9件、地図3件が成功。検索の2ページ目での条件変更が1リクエストだけになること、検索エラーから初期候補へ戻れること、古い位置取得応答を無視することを追加で検証。スタンプには認証確認・同一人物再認証・別人物への切替後の遅い応答・再読込中表示のテストを追加。実際のOAuth・DB・実機カメラ確認とは区別する。

全単体726件・67ファイルと型チェックが成功。全体lintは0 errors / 5 warnings（R6統合前）。
