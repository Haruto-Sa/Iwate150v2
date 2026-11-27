import "server-only";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import manifest from "../../data/municipalities/manifest.json";
import { locateMunicipality, type MunicipalBoundaryData, type MunicipalityLocation } from "./municipalBoundaries";

let cached: Promise<MunicipalBoundaryData> | undefined;

/**
 * 同梱の行政区域を検証して読み込む。失敗を空カタログとして隠さない。
 * @returns 復元したデータ。入出力・整合性エラーは呼び出し側へ返す
 * @example const data = await loadMunicipalBoundaries();
 */
export function loadMunicipalBoundaries(): Promise<MunicipalBoundaryData> {
  cached ??= readFile(`${process.cwd()}/data/municipalities/iwate-2026.json.gz`, { signal: AbortSignal.timeout(5000) })
    .then(bytes => {
      if (createHash("sha256").update(bytes).digest("hex") !== manifest.dataSha256) throw new Error("Municipal boundary integrity check failed");
      const data = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString("utf8")) as MunicipalBoundaryData;
      if (data.version !== 1 || data.municipalities.length !== manifest.municipalities.length) throw new Error("Municipal boundary version mismatch");
      return data;
    }).catch(error => { cached = undefined; throw error; });
  return cached;
}

/**
 * 位置を保存・ログ出力せず、同梱する岩手県の区域と照合する。
 * @param point - 呼び出し元が取得した緯度・経度
 * @returns データ上の包含結果。取得可否の判定やDB書き込みは行わない
 * @example await locateIwateMunicipality({ lat: 39.7, lng: 141.15 });
 */
export async function locateIwateMunicipality(point: { lat: number; lng: number }): Promise<MunicipalityLocation> {
  return locateMunicipality(point, await loadMunicipalBoundaries());
}
