import { chromium, webkit, devices, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const [portraitPath, outputPath] = process.argv.slice(2);
if (!portraitPath || !outputPath) throw new Error('Usage: node scripts/measure-camera.mjs PORTRAIT.jpg RESULTS.json');
const portrait = `data:image/jpeg;base64,${(await readFile(portraitPath)).toString('base64')}`;
const baseURL = 'http://127.0.0.1:3100';
const results = [];
await mkdir(dirname(resolve(outputPath)), { recursive: true });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3100'], {
  env: { ...process.env, AUTH_URL: baseURL, AUTH_SECRET: randomBytes(32).toString('hex'), NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '', AUTH_GITHUB_ID: '', AUTH_GITHUB_SECRET: '' },
  stdio: ['ignore', 'pipe', 'ignore'],
});
let serverReady = false;
server.stdout.on('data', (chunk) => { if (String(chunk).includes('Ready in')) serverReady = true; });
let browser;
let expired = false;
const deadline = setTimeout(() => { expired = true; server.kill('SIGTERM'); void browser?.close(); }, 10 * 60_000);
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error('Owned server failed to start; check port 3100');
    try { if (serverReady && (await fetch(baseURL)).ok) break; } catch {}
    if (attempt === 39) throw new Error('Server readiness timeout');
    await new Promise((done) => setTimeout(done, 250));
  }
  for (const [environment, engine, device] of [['iphone', webkit, devices['iPhone 13']], ['android', chromium, devices['Pixel 5']]]) {
    browser = await engine.launch({ args: environment === 'android' ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader'] : [] });
    for (const scenario of ['single', 'multiple', 'delayed-assets']) {
      const context = await browser.newContext({ ...device, permissions: ['camera'], serviceWorkers: scenario === 'delayed-assets' ? 'block' : 'allow' });
      if (scenario === 'delayed-assets') await context.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, 'serviceWorker'); });
      let assetDelayCount = 0;
      await context.addInitScript((portrait) => {
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('voja_install_prompt_dismiss_until', String(Date.now() + 86400000));
        // 実カメラを開かず公開テスト画像を動画として送る。顔推論と描画自体は実装を通す。
        Object.getPrototypeOf(navigator.mediaDevices).getUserMedia = async () => {
          const image = new Image();
          image.src = portrait;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 480;
          const ctx = canvas.getContext('2d');
          /** 公開画像をフレームへ描く。@returns なし @example draw(); */
          const draw = () => {
            ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, 640, 480);
            const scale = Math.min(640 / image.width, 480 / image.height);
            ctx.drawImage(image, (640 - image.width * scale) / 2, 0, image.width * scale, image.height * scale);
          };
          draw();
          const stream = canvas.captureStream(15);
          const timer = setInterval(draw, 1000 / 15);
          for (const track of stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => { clearInterval(timer); stop(); };
          }
          window.cameraFixture = { width: canvas.width, height: canvas.height, created: performance.now() };
          return stream;
        };
      }, portrait);
      // 通常条件はSW有効。障害注入だけSW非対応とし、迂回を防ぐ。1秒の応答遅延であり帯域制限ではない。
      if (scenario === 'delayed-assets') await context.route(/\/(models|mediapipe)\//, async (route) => {
        assetDelayCount += 1;
        await new Promise((done) => setTimeout(done, 1000));
        await route.continue();
      });
      const page = await context.newPage();
      for (const visit of ['cold', 'revisit']) {
        if (expired) throw new Error('Camera benchmark exceeded ten minutes');
        const delaysBefore = assetDelayCount;
        if (visit === 'cold') {
          await page.goto(`${baseURL}/camera`);
        } else {
          await page.getByRole('link', { name: 'ホーム', exact: true }).first().click();
          await page.waitForURL(baseURL + '/');
          await page.getByRole('link', { name: 'カメラ', exact: true }).first().click();
          await page.waitForURL(baseURL + '/camera');
        }
        await page.waitForFunction(() => { const v = document.querySelector('video'); return v?.readyState >= 2; }, null, { timeout: 20000 });
        const firstVideoObserved = await page.evaluate(() => performance.now());
        const fixture = await page.evaluate(() => ({ ...window.cameraFixture, videoWidth: document.querySelector('video').videoWidth }));
        if (fixture.videoWidth !== 640 || fixture.width !== 640) throw new Error(`Unexpected camera input: ${JSON.stringify(fixture)}`);
        await page.getByRole('button', { name: 'そばっち', exact: true }).click();
        if (scenario === 'multiple') await page.getByRole('button', { name: 'えんぞー', exact: true }).click();
        let visible = true;
        try {
          await page.waitForFunction((multiple) => {
            const marks = performance.getEntriesByType('mark').map((m) => m.name);
            return marks.includes('iwate-camera:sobacchi:visible-submit:end') && (!multiple || marks.includes('iwate-camera:enzo:visible-submit:end'));
          }, scenario === 'multiple', { timeout: 30000 });
        } catch { visible = false; }
        const measured = await page.evaluate(() => ({
          marks: performance.getEntriesByType('mark').filter((m) => m.name.startsWith('iwate-camera:')).map((m) => ({ name: m.name.slice(13), time: m.startTime })),
          resources: performance.getEntriesByType('resource').filter((r) => /\/(models|mediapipe)\//.test(r.name)).map((r) => ({ name: new URL(r.name).pathname, start: r.startTime, duration: r.duration, transferSize: r.transferSize, decodedBodySize: r.decodedBodySize })),
        }));
        if (scenario === "delayed-assets" && assetDelayCount === delaysBefore) throw new Error("Asset delay was not applied");
        results.push({ environment, scenario, visit, serviceWorker: scenario !== "delayed-assets", delayedRequests: assetDelayCount - delaysBefore, firstVideoObserved, fixture, visible, ...measured });
        console.log(environment, scenario, visit, visible, measured.marks);
        await page.screenshot({ path: `${outputPath}.${environment}-${scenario}-${visit}.png`, fullPage: true });
        if (visible) {
          await expect(page.getByRole('button', { name: '写真を撮る', exact: true })).toBeEnabled();
          await page.getByRole('button', { name: '写真を撮る', exact: true }).click();
          await page.waitForURL(baseURL + '/camera/edit');
          const capture = await page.evaluate(() => ({ png: sessionStorage.getItem('capturedPhoto')?.startsWith('data:image/png;base64,'), models: JSON.parse(sessionStorage.getItem('capturedModels') ?? '[]') }));
          expect(capture.png).toBe(true);
          expect(capture.models).toEqual(scenario === 'multiple' ? ['sobacchi', 'enzo'] : ['sobacchi']);
          results.at(-1).capture = capture;
        }
      }
      await context.close();
    }
    await browser.close(); browser = null;
  }
} finally {
  clearTimeout(deadline);
  await browser?.close();
  server.kill('SIGTERM');
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), instrumentedWorkingTree: true, recordedAt: new Date().toISOString(), scope: 'Desktop engine/device profiles; public still-image canvas stream; CPU render submission, not GPU completion or physical device. One sample per condition.', results }, null, 2) + '\n');
}
