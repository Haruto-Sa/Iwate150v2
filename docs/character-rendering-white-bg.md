# Characterモデル表示の白背景・配色安定化

## 機能概要
- `character` ページの3D表示背景を白に統一。
- `obj + mtl` を優先して読み込み、失敗時は `obj` のみでフォールバック。
- 色情報が弱い/無いメッシュは濃い灰色で表示して視認性を確保。
- カメラ利用なしで表示領域の中心にモデルが来るように調整。

## 技術的な設計判断と理由
- legacy の `stamp.js` にある「OBJ中心化 + ライト + MTL失敗時フォールバック」を、React/Three.js 構成に移植した。
- 透明設定を基本オフにして、背景・マテリアル干渉による非表示を防止した。
- `frustumCulling` 無効化と法線再計算を維持し、モデル欠け・暗転を抑制した。

## 関連ファイル
- `src/components/character/CharacterViewer.tsx`
- `src/lib/characters.ts`
- `src/app/character/page.tsx`
- `legacy/flask_app/static/javascript/stamp.js`
- `legacy/flask_app/templates/stamp.html`

## 確認手順
1. `bun run dev` を実行。
2. `/character` を開いて、背景が白であることを確認。
3. 5キャラすべてでモデルが中央表示されることを確認。
4. 色なしメッシュが濃い灰色で視認できることを確認。
5. 回転・拡大・縮小の操作が継続して動くことを確認。
