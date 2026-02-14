# Search / Map / Character 安定化アップデート

## 機能概要
- Search を DB 直接検索へ切り替え、市区町村・ジャンルで安全に絞り込みできるようにした。
- Search の 30 件固定表示を廃止し、50 件単位のページング表示を追加した。
- Map を「現在地が取れない場合は盛岡駅起点」「近傍20件を半径拡張で探索」「全件表示チェックで切替」に統一した。
- Character のモデル読み込みを camera と同系統の URL 解決 + フォールバック候補リトライへ統一した。

## 技術的な設計判断とその理由
- Search は `src/app/api/search/route.ts` を介したサーバー検索へ変更した。
  - クライアント全件取得よりも、件数増加時の応答性と安全性（パラメータ検証）を優先するため。
- Search のページサイズは 50 件固定（API 上限 100）。
  - モバイル環境での描画負荷を抑えながら、スクロール体験を確保するため。
- Event のジャンル絞り込みは未対応とした。
  - `events` テーブルに `genre_id` が存在せず、擬似判定より明示仕様を優先したため。
- Map の近傍表示は固定半径ではなく段階半径拡張方式にした。
  - 地域密度差が大きくても「常時20件に近い件数」を安定表示するため。
- Character は signed URL だけに依存せず、public/local URL を候補化した。
  - 署名URLの一時失敗時でも、手動リロードなしで表示復旧できるようにするため。

## 使用している Supabase テーブル
- `cities`（検索フィルタ用の市区町村）
- `genres`（スポット検索フィルタ用のジャンル）
- `spots`（スポット検索・地図表示）
- `events`（イベント検索）

## 関連ファイルパス一覧
- `src/lib/supabaseClient.ts`
- `src/app/api/search/route.ts`
- `src/app/search/page.tsx`
- `src/components/search/SearchSurface.tsx`
- `src/lib/config.ts`
- `src/components/spot/SpotSurface.tsx`
- `src/app/character/page.tsx`
- `src/components/character/CharacterViewer.tsx`

## セットアップ手順
1. 開発サーバーを再起動する。
```bash
bun run dev
```

2. Search を確認する。
- `/search` で市区町村・ジャンル・キーワードが効くこと
- 50 件単位で「前へ/次へ」が動くこと

3. Map を確認する。
- `/spot` で位置情報拒否時に盛岡駅基準になること
- 近傍20件表示と「すべての観光地を表示する」切替が動くこと

4. Character を確認する。
- `/character` でモデルが表示されること
- 一時的な読み込み失敗時に「再試行」で復帰できること
