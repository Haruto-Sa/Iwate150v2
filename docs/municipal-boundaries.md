# 岩手県の市町村境界データ

国土数値情報（行政区域データ）（国土交通省）を加工して作成。市町村別に整理し、座標・島・穴は保持しています。

- 原典: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html
- データ時点: 2026-01-01、取得日: 2026-10-24
- 原典ZIP: https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2026/N03-20260101_03_GML.zip
- 原典のライセンス表示: CC BY 4.0。https://creativecommons.org/licenses/by/4.0/
- 利用条件: https://nlftp.mlit.go.jp/ksj/other/agreement_01.html
- 詳細な出典・SHA256・市町村コード・境界未定の隣接自治体: `data/municipalities/manifest.json`

## 保持する情報

33市町村、8,224ポリゴン、937,242頂点。経度・緯度の数値は丸めず、穴・島を含む全リングを保持します。元データの市町村単位への整理とポリゴン外接矩形の追加、JSONのgzip圧縮だけを行います。市町村名やアプリの既存mock IDではなく、原典の5桁行政コードで識別します。

## 再生成と検証

上記ZIPをダウンロードし、次のコマンドをリポジトリルートで実行します。変換はPython標準ライブラリのみ、独立検証だけShapelyを使用します。

```sh
python3 scripts/prepare_municipal_boundaries.py /path/to/N03-20260101_03_GML.zip
uv run --with shapely==2.1.2 --no-project python scripts/verify_municipal_boundaries.py /path/to/N03-20260101_03_GML.zip
bun run test:unit -- src/lib/municipalBoundaries.test.ts src/lib/municipalBoundaryServer.test.ts
```

原典ZIPのSHA256が異なる場合は変換を中止します。更新時は単にハッシュを置き換えず、ライセンス・座標系・33市町村の範囲・境界未定表を再確認します。GEOS検証は原典との座標完全一致、全自治体の図形妥当性を確認し、内点・頂点・島・穴・固定乱数点242件の期待値を生成します。厳密な境界判定も記録し、アプリの数値誤差幅（座標平面で1e-10度）による差を追跡します。

## 使用範囲と制約

`locateMunicipality` は内側・境界・自治体重複・区域外・不正入力を分けます。境界や重複で先頭自治体を選びません。距離は観測緯度の局所平面で最近点を求めた後の球面距離で、短距離用の近似です。

このライブラリ単独ではスタンプ取得を許可しません。GPS精度、測定時刻、境界余裕、位置偽装、保存・認証・取得回数を扱いません。座標や履歴を保存・ログ出力しません。原典はJGD2011（EPSG:6668）で、現在のGNSS WGS84と完全に同一とは扱えません。原典メタデータの水平位置の標準偏差25mは最大誤差の保証ではありません。

境界未定表には大船渡市–釜石市、奥州市–金ケ崎町、奥州市–平泉町、岩泉町–野田村が含まれます。出典: https://nlftp.mlit.go.jp/ksj/gml/datalist/N03_Boundary_undetermined.pdf 。これらの原典境界を確定境界とは扱いません。

サーバー用ローダーは圧縮データのハッシュ、復元上限32MiB、5秒の読み込み期限を確認し、成功時のみキャッシュします。失敗を区域外として隠しません。圧縮データは約8.1MBでブラウザーへ配信しない想定です。現時点でAPIや画面には接続していません。接続時にはNext.jsの出力トレースへの同梱と本番相当環境でのメモリー・速度検証が必要です。

Issue #29 の位置履歴保存と Issue #34 のデータ最小化は方針確認待ちです。この変更だけで市町村スタンプ機能の完了とはしません。
