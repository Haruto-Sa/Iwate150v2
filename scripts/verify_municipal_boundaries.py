"""独立したGEOS実装で、原典から包含テストの期待値を生成する。

Usage: uv run --with shapely==2.1.2 --no-project python scripts/verify_municipal_boundaries.py ARCHIVE.zip
Shapelyは検証時だけ利用し、アプリの依存関係には追加しない。
"""
import gzip
import hashlib
import json
from pathlib import Path
import random
import sys
import zipfile
import shapely
from shapely.geometry import Point, shape
from prepare_municipal_boundaries import SOURCE_NAME, SOURCE_SHA256


def verify(archive: Path) -> None:
    """座標保存・33自治体・穴と島を検証し、原典GEOS判定による固定ケースを出力する。"""
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Unexpected source archive")
    with zipfile.ZipFile(archive) as source:
        original = json.loads(source.read(SOURCE_NAME))
    root = Path(__file__).resolve().parents[1]
    converted = json.loads(gzip.decompress((root / "data/municipalities/iwate-2026.json.gz").read_bytes()))
    originals = {}
    for feature in original["features"]:
        code = feature["properties"]["N03_007"]
        originals.setdefault(code, []).extend(feature["geometry"]["coordinates"])
    geometries = {}
    for municipality in converted["municipalities"]:
        code = municipality["code"]
        rings = [polygon["rings"] for polygon in municipality["polygons"]]
        if rings != originals[code]:
            raise ValueError("Coordinates were changed")
        geometry = shape({"type": "MultiPolygon", "coordinates": originals[code]})
        if not geometry.is_valid:
            raise ValueError(f"Invalid source geometry for {code}: {shapely.is_valid_reason(geometry)}")
        geometries[code] = geometry
    if len(geometries) != 33 or set(originals) != set(geometries):
        raise ValueError("Municipality coverage differs")
    shapely.prepare(list(geometries.values()))
    cases = []

    def add(point: Point, label: str) -> None:
        """原典の内側と境界を別々に評価し、数値座標と期待値を記録する。"""
        inside = [code for code, geometry in geometries.items() if geometry.contains(point)]
        # アプリの浮動小数点境界一致幅（座標平面で1e-10度）を独立したGEOSで照合する。
        # strictBoundaryCodesも残し、厳密包含との差を追跡できるようにする。
        strict_boundary = [code for code, geometry in geometries.items() if geometry.boundary.contains(point)]
        boundary = [code for code, geometry in geometries.items() if geometry.boundary.distance(point) <= 1e-10]
        cases.append({"label": label, "lat": point.y, "lng": point.x, "status": "boundary" if boundary else "ambiguous" if len(inside) > 1 else "inside" if inside else "outside", "codes": sorted(set(inside + boundary)), "strictBoundaryCodes": strict_boundary})

    for code, geometry in geometries.items():
        largest = max(geometry.geoms, key=lambda polygon: polygon.area)
        add(largest.representative_point(), f"{code}-interior")
        add(Point(largest.exterior.coords[0]), f"{code}-vertex")
        for index, polygon in enumerate(geometry.geoms):
            for hole in polygon.interiors:
                add(shape({"type": "Polygon", "coordinates": [list(hole.coords)]}).representative_point(), f"{code}-hole-{index}")
        if len(geometry.geoms) > 1:
            island = sorted(geometry.geoms, key=lambda polygon: polygon.area, reverse=True)[1]
            add(island.representative_point(), f"{code}-island")
    rng = random.Random(20260101)
    for index in range(160):
        add(Point(rng.uniform(140.25, 142.35), rng.uniform(38.65, 40.55)), f"grid-{index}")
    target = root / "src/lib/testData/municipal-boundary-cases.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"sourceSha256": SOURCE_SHA256, "shapelyVersion": shapely.__version__, "cases": cases}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"municipalities": len(geometries), "cases": len(cases), "shapely": shapely.__version__}))


if __name__ == "__main__":
    verify(Path(sys.argv[1]))
