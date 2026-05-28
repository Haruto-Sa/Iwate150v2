#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_PATH="$ROOT_DIR/docs/lighthouse-baseline.json"
BASE_URL="${LIGHTHOUSE_BASE_URL:-http://127.0.0.1:3000}"
LIGHTHOUSE_CLI="${LIGHTHOUSE_CLI:-lighthouse@11}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

if ! command -v bun >/dev/null 2>&1; then
  echo "[lighthouse] bun が見つかりません。" >&2
  exit 1
fi

if ! command -v bunx >/dev/null 2>&1; then
  echo "[lighthouse] bunx が見つかりません。" >&2
  exit 1
fi

if ! curl -fsS "$BASE_URL" >/dev/null 2>&1; then
  echo "[lighthouse] $BASE_URL に接続できません。先に 'bun run dev' でアプリを起動してください。" >&2
  exit 2
fi

resolve_chrome_path() {
  if [ -n "${LIGHTHOUSE_CHROME_PATH:-}" ] && [ -x "${LIGHTHOUSE_CHROME_PATH}" ]; then
    printf '%s\n' "${LIGHTHOUSE_CHROME_PATH}"
    return 0
  fi

  local mac_chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ -x "$mac_chrome" ]; then
    printf '%s\n' "$mac_chrome"
    return 0
  fi

  for candidate in google-chrome chromium chromium-browser chrome; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done

  return 1
}

if ! CHROME_PATH="$(resolve_chrome_path)"; then
  echo "[lighthouse] Chrome / Chromium が見つかりません。LIGHTHOUSE_CHROME_PATH を指定してください。" >&2
  exit 3
fi

DETAIL_PATH="$(cd "$ROOT_DIR" && bun --eval '
  import { fetchSpots } from "./src/lib/supabaseClient";
  import { buildSpotSlug } from "./src/lib/spotRoutes";

  const spots = await fetchSpots();
  if (!spots.length) {
    console.error("[lighthouse] スポットデータが取得できませんでした。");
    process.exit(1);
  }

  console.log(`/spots/${buildSpotSlug(spots[0])}`);
')"

declare -a PAGE_PATHS=(
  "/"
  "/map"
  "/search"
  "$DETAIL_PATH"
)

declare -a PAGE_KEYS=(
  "home"
  "map"
  "search"
  "spot-detail"
)

echo "[lighthouse] install command:"
echo "  bun add -d ${LIGHTHOUSE_CLI}"
echo "[lighthouse] base url: $BASE_URL"
echo "[lighthouse] output: $OUTPUT_PATH"

for index in "${!PAGE_PATHS[@]}"; do
  page_path="${PAGE_PATHS[$index]}"
  page_key="${PAGE_KEYS[$index]}"
  page_url="${BASE_URL%/}${page_path}"
  page_output="$TMP_DIR/${page_key}.json"

  echo "[lighthouse] auditing ${page_url}"
  if ! bunx "$LIGHTHOUSE_CLI" "$page_url" \
    --quiet \
    --chrome-path="$CHROME_PATH" \
    --output=json \
    --output-path="$page_output" \
    --only-categories=performance,accessibility,best-practices,seo,pwa >/dev/null; then
    echo "[lighthouse] ${page_url} の計測に失敗しました。" >&2
    exit 4
  fi
done

cd "$ROOT_DIR"
bun --eval '
  import { readFileSync, writeFileSync } from "node:fs";

  const [outputPath, baseUrl, detailPath, ...pairs] = process.argv.slice(1);
  const pages = [];

  for (let index = 0; index < pairs.length; index += 2) {
    const key = pairs[index];
    const jsonPath = pairs[index + 1];
    const report = JSON.parse(readFileSync(jsonPath, "utf8"));
    const categories = report.categories ?? {};

    pages.push({
      key,
      path: new URL(report.finalDisplayedUrl).pathname,
      requestedUrl: report.requestedUrl,
      finalUrl: report.finalDisplayedUrl,
      categories: {
        performance: Math.round((categories.performance?.score ?? 0) * 100),
        accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
        bestPractices: Math.round((categories["best-practices"]?.score ?? 0) * 100),
        seo: Math.round((categories.seo?.score ?? 0) * 100),
        pwa: Math.round((categories.pwa?.score ?? 0) * 100),
      },
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    detailPath,
    pages,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");

  console.log("");
  console.log("| Page | Performance | Accessibility | Best Practices | SEO | PWA |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const page of pages) {
    console.log(
      `| ${page.path} | ${page.categories.performance} | ${page.categories.accessibility} | ${page.categories.bestPractices} | ${page.categories.seo} | ${page.categories.pwa} |`
    );
  }
' "$OUTPUT_PATH" "$BASE_URL" "$DETAIL_PATH" \
  "home" "$TMP_DIR/home.json" \
  "map" "$TMP_DIR/map.json" \
  "search" "$TMP_DIR/search.json" \
  "spot-detail" "$TMP_DIR/spot-detail.json"
