# Camera baseline — Issue #30

`camera-baseline.json` contains three samples per condition (36 runs). The input is the public MediaPipe `portrait.jpg` rendered into a 640×480 canvas stream. Face inference and Three.js rendering run normally. These are macOS Playwright engine/device profiles, **not physical iPhone/Android measurements**.

Median time from camera start, milliseconds:

| Profile / condition | Video playing | Model object ready | First face result | All selected models submitted |
| --- | ---: | ---: | ---: | ---: |
| iPhone / single / first | 92 | 307 | 444 | 455 |
| iPhone / single / revisit | 83 | 292 | 101 | 310 |
| Android / single / first | 34 | 358 | 4464 | 4473 |
| Android / single / revisit | 16 | 946 | 58 | 981 |
| iPhone / delayed assets / first | 150 | 2281 | 2464 | 2476 |
| Android / delayed assets / first | 25 | 2254 | 6247 | 6253 |

An object being loaded does not mean it is visible. The Android profile had a roughly four-second gap between object readiness and the first face result. Capture must wait for the selected models to be rendered, or allow the user to remove them explicitly.

The first visit uses a fresh context; revisit uses in-app navigation. Normal cases have Service Worker enabled. Delay injection makes Service Worker unavailable and adds one second per model/MediaPipe request; it is **not bandwidth throttling**. `visible-submit` measures CPU render submission with a detected face and visible object, not GPU completion or physical display presentation. Screenshots were inspected separately. CPU/GPU scheduling on the host may vary.

## Reproduce

Use Node 22, Bun 1.3.4 and the repository's Playwright browsers. Build with the mock-data/OAuth-disabled environment used by `playwright.config.ts`. Ensure port 3100 is free.

```sh
curl --fail --location https://storage.googleapis.com/mediapipe-assets/portrait.jpg -o /tmp/camera-portrait.jpg
bun run build
node scripts/measure-camera.mjs /tmp/camera-portrait.jpg documents/camera-performance/result.json
```

The image is used by the [official MediaPipe test](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/face_landmarker_test.py). It is not bundled into the application. The runner checks its input stream dimensions, tests capture-to-PNG/editing when a model appears, saves JSON/screenshots, and closes its owned server/browser. Use only a public test fixture: output screenshots contain the supplied image.

Runtime timing records contain stage names/timestamps only, retain at most 64 marks, reset on camera restart, and are neither persisted nor sent. Raw local measurements and screenshots are under ignored `documents/camera-performance/`.

## Remaining comparisons

Target a 20% reduction in median first selection-to-display time in the same controlled profiles, without adding over 100ms to median video startup. Physical-device targets require physical-device baselines. These targets have not been achieved. Actual low-bandwidth conditions, moving faces and sustained GPU memory usage still require device validation. Model-load deadlines/cancellation and resource disposal are now covered by automated tests.

Disabling `refineLandmarks` was tried but not retained: one 12-condition run still took about 4.9 seconds to first display for the Android first/single case. This is an inconclusive single-run comparison, not proof that the option can never improve performance. The current setting is preserved.


## Worker and bounded-loader validation (2026-10-24)

`camera-worker-validation.json` records one run of each of 16 conditions on the working tree based on `b4fd526`. All conditions produced detected-face model renders and captured PNGs, including all five models (OBJ/MTL and FBX). This is functional validation, not a statistically established speedup. The runner now includes the all-models scenario after the original scenarios.

OBJ and MTL requests start together. Assets have a 32 MiB response limit and a shared 20-second deadline; selecting away aborts pending fetches. External MTL textures participate in cancellation; FBX embedded-image loading is tracked for completion. Synchronous Three.js parsing is not interruptible. A one-second injected response delay is still not a low-bandwidth experiment.

Face inference uses one shared Worker where supported, with a 20-second initialization deadline and a 20-second frame deadline. This keeps the UI available during inference rather than promising faster inference. The generated vendor script retains the upstream license, applies version-checked corrections to the legacy Worker initialization, and preserves the existing inference settings and iOS CPU preference. Unsupported Worker/OffscreenCanvas environments retain the previous main-thread path; the Worker deadline does not apply to that path. The shared Worker is retained for revisit, while page-owned Three.js objects are disposed on leave.

Tests cover stalled inference with ordinary-photo fallback, stalled model loads, retry, cancellation, and stale-subscriber isolation. Physical device rendering, moving-face tracking, sustained memory/power usage and the original performance targets remain open.

## Translation and mirroring validation

The runner also translates the public portrait by -64/+64 pixels in a 640-pixel stream. For each front/back mode it reads actual transparent model-canvas pixels and checks that the alpha-weighted horizontal centroid moves in the expected direction by more than 6% of the output width. `camera-tracking-validation.json` records all 16 directional checks across two engine/device profiles and cold/revisit conditions. Observed shifts were about 9–10%, with reversed direction in the mirrored front mode. Every condition also saved a PNG.

This validates tracking of a translated image and requested facing-mode transforms. It does not validate live head rotation, occlusion, physical camera selection or physical-device performance. The runner now fails if any of the 20 expected render/capture conditions is incomplete. Timing marks after the moving-face scenario's camera switch refer to the restarted camera and must not be included in first-start performance comparisons.


Linux CI exposed a legacy Emscripten registration failure (`GLctx` was unset on the first frame). The Worker now obtains the actual OffscreenCanvas WebGL context, determines its version from `GL_VERSION`, and registers/activates that same context with Emscripten. Constructor presence alone is not used as proof of context availability. If neither WebGL context can be created in the Worker, only that explicit unsupported case falls back to the original main-thread implementation; inference errors/timeouts continue to surface as failures.
