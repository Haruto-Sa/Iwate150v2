"""公式N03の岩手県GeoJSONを、座標を簡略化せず市町村別にまとめる。

Usage: python3 scripts/prepare_municipal_boundaries.py /tmp/N03-20260101_03_GML.zip
ネットワーク接続は行わない。更新時は出典・基準日・SHA・自治体一覧をレビューする。
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys
import zipfile

SOURCE_SHA256 = "871e3010f40d79db706cd2c686eda1c5fb0d13437e64ec36618cb8cc355a1265"
SOURCE_NAME = "N03-20260101_03.geojson"
# 公式の暫定境界線一覧（令和8年1月1日時点）を確認した組。
PROVISIONAL_PAIRS = [("03203", "03211"), ("03215", "03381"), ("03215", "03402"), ("03483", "03503")]
EXPECTED_CODES = set("03201 03202 03203 03205 03206 03207 03208 03209 03210 03211 03213 03214 03215 03216 03301 03302 03303 03321 03322 03366 03381 03402 03441 03461 03482 03483 03484 03485 03501 03503 03506 03507 03524".split())


def prepare(path: Path) -> None:
    """固定版の出典を検証し、公開カタログと判定用圧縮データを出力する。"""
    if path.stat().st_size > 32 * 1024 * 1024:
        raise ValueError("Archive exceeds the reviewed size limit")
    archive = path.read_bytes()
    if hashlib.sha256(archive).hexdigest() != SOURCE_SHA256:
        raise ValueError("Source archive differs from the reviewed version")
    with zipfile.ZipFile(path) as source:
        if source.getinfo(SOURCE_NAME).file_size > 48 * 1024 * 1024:
            raise ValueError("GeoJSON exceeds the reviewed size limit")
        original = json.loads(source.read(SOURCE_NAME))
    if original.get("crs", {}).get("properties", {}).get("name") != "urn:ogc:def:crs:EPSG::6668":
        raise ValueError("Unexpected coordinate reference system")
    municipalities = {}
    vertices = 0
    for feature in original["features"]:
        props = feature["properties"]
        code, name = props["N03_007"], props["N03_004"]
        if props["N03_001"] != "岩手県" or code not in EXPECTED_CODES:
            raise ValueError("Unexpected municipality")
        entry = municipalities.setdefault(code, {"code": code, "name": name, "polygons": []})
        if entry["name"] != name or feature["geometry"]["type"] != "MultiPolygon":
            raise ValueError("Conflicting municipality or geometry")
        for rings in feature["geometry"]["coordinates"]:
            if not rings:
                raise ValueError("Empty polygon")
            points = []
            for ring in rings:
                if len(ring) < 4 or ring[0] != ring[-1]:
                    raise ValueError("Ring must be closed")
                for point in ring:
                    if len(point) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
                        raise ValueError("Invalid coordinate")
                    if not 139 < point[0] < 143 or not 38 < point[1] < 42:
                        raise ValueError("Coordinate outside the prefecture envelope")
                points.extend(ring)
            vertices += len(points)
            entry["polygons"].append({
                "bounds": [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)],
                "rings": rings,
            })
    if set(municipalities) != EXPECTED_CODES:
        raise ValueError("The prefecture catalog is incomplete")
    entries = [municipalities[code] for code in sorted(municipalities)]
    catalog = [{"code": m["code"], "name": m["name"], "provisionalNeighbors": sorted(b if a == m["code"] else a for a, b in PROVISIONAL_PAIRS if m["code"] in (a, b))} for m in entries]
    payload = json.dumps({"version": 1, "municipalities": entries}, ensure_ascii=False, separators=(",", ":")).encode()
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    output = Path(__file__).resolve().parents[1] / "data/municipalities"
    output.mkdir(parents=True, exist_ok=True)
    (output / "iwate-2026.json.gz").write_bytes(compressed)
    manifest = {
        "dataDate": "2026-01-01", "retrievedOn": "2026-10-24",
        "source": "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html",
        "archive": "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2026/N03-20260101_03_GML.zip",
        "archiveSha256": SOURCE_SHA256, "dataSha256": hashlib.sha256(compressed).hexdigest(),
        "license": "CC-BY-4.0", "crs": "EPSG:6668 (JGD2011)",
        "attribution": "国土数値情報（行政区域データ）（国土交通省）を加工して作成。市町村別に整理し、座標・島・穴は保持。",
        "provisionalBoundarySource": "https://nlftp.mlit.go.jp/ksj/gml/datalist/N03_Boundary_undetermined.pdf",
        "featureCount": len(original["features"]), "vertexCount": vertices,
        "municipalities": catalog,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"municipalities": len(entries), "vertices": vertices, "jsonBytes": len(payload), "gzipBytes": len(compressed), "sha256": manifest["dataSha256"]}))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/prepare_municipal_boundaries.py ARCHIVE.zip")
    prepare(Path(sys.argv[1]))
