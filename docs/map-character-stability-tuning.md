# Map検索拡張 + Character表示安定化

## 機能概要
- `map` で近傍探索の表示件数と最大検索半径を調整可能にした。
- `map` は従来どおり位置情報失敗時に盛岡駅を起点に探索する。
- `character` は legacy 実装の表示安定化処理を移植し、モデル別チューニングを導入した。

## 技術的な設計判断と理由
- 近傍探索は「半径段階拡張」を維持しつつ、`targetCount` と `maxRadius` を可変化した。
  - 理由: 全件表示より負荷を抑えながら、ユーザーが探索範囲を広げられるため。
- `character` は MTL/OBJ 失敗時の候補フォールバックを維持したまま、mesh 補正を追加した。
  - 理由: モデルが「表示されない」「極小になる」問題は、URL解決だけでなく material/culling の差異で発生するため。
- モデル別チューニング値は `characters` 定義に集約した。
  - 理由: キャラ追加時に1ファイルで調整可能にし、表示不具合の調整コストを下げるため。

## モデル別チューニング値
- `sobacchi`: `scaleMultiplier=1.08`, `positionOffset.y=-0.06`
- `karin`: `scaleMultiplier=1.05`
- `kerohira`: `scaleMultiplier=0.9`
- `enzo`: `scaleMultiplier=1.15`
- `goshodon`: `scaleMultiplier=0.88`
- 共通補正: `DoubleSide`, `transparent`, `alphaTest=0.1`, `depthWrite/depthTest`, `frustumCulling無効`, `vertexNormals再計算`

## 使用している Supabase テーブル
- `spots`
- `cities`
- `genres`
- `events`

## 関連ファイルパス一覧
- `src/components/spot/SpotSurface.tsx`
- `src/components/character/CharacterViewer.tsx`
- `src/app/character/page.tsx`
- `src/lib/characters.ts`
- `src/lib/types.ts`
- `legacy/flask_app/static/javascript/ThreeAndMediapipe.js`

## セットアップ/確認手順
1. `bun run dev` を起動する。
2. `/spot` を開き、以下を確認する。
   - 表示件数が `20/50/100` で切り替わる。
   - 最大検索半径が `5/10/20/50km` で切り替わる。
   - `すべての観光地を表示する` のON/OFFで表示対象が切り替わる。
3. `/character` を開き、全キャラでモデルが表示されることを確認する。
4. 読み込み失敗時はエラー表示内の候補URLを確認し、`再試行` で復帰することを確認する。
5. Cloudflare Tunnel 経由でも `/character` のモデル表示を確認する。
