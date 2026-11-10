/**
 * Headless captures of the isolated test room.
 * Run from the repo root after `python3 -m http.server` on :8765.
 *
 *   TEM_BASE_URL=http://127.0.0.1:8765/empty-museum/ node empty-museum/salle-temoin/capture.mjs
 */
const playwright = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const chromium = playwright.chromium || playwright.default.chromium;
import {mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const base = process.env.TEM_BASE_URL || 'http://127.0.0.1:8765/empty-museum/';
const out = process.env.TEMOIN_OUT || '/tmp/salle-captures';
await mkdir(out, {recursive: true});

const shots = [
  ['01-entrance', 'entrance', 'desktop'],
  ['02-perspective', 'perspective', 'desktop'],
  ['03-floor', 'floor', 'desktop'],
  ['04-frame', 'frame', 'desktop'],
  ['05-ceiling', 'ceiling', 'desktop'],
  ['06-plinth', 'plinth', 'desktop'],
  ['07-mobile', 'mobile', 'mobile'],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const metrics = {};
for (const [name, shot, tier] of shots) {
  const viewport = tier === 'mobile' ? {width: 390, height: 844} : {width: 1440, height: 900};
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, hasTouch: tier === 'mobile', isMobile: tier === 'mobile'});
  const page = await context.newPage();
  const url = new URL('salle-temoin.html', base);
  url.searchParams.set('shot', shot);
  url.searchParams.set('tier', tier);
  await page.goto(url.href, {waitUntil: 'networkidle', timeout: 120000});
  await page.waitForFunction(() => window.__SALLE_TEMOIN__?.ready === true, null, {timeout: 120000});
  await page.waitForTimeout(1200);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({path: file});
  metrics[name] = await page.evaluate(() => ({...window.__SALLE_TEMOIN__}));
  console.log(name, metrics[name].drawCalls, 'draws', metrics[name].triangles, 'tris', metrics[name].textureMegabytes, 'MB');
  await context.close();
}

if (process.env.TEMOIN_SKIP_VIDEO) {
  await browser.close();
  console.log('captures in', out);
  process.exit(0);
}
const videoContext = await browser.newContext({
  viewport: {width: 1280, height: 720},
  recordVideo: {dir: out, size: {width: 1280, height: 720}},
});
const videoPage = await videoContext.newPage();
const videoUrl = new URL('salle-temoin.html', base);
videoUrl.searchParams.set('shot', 'video');
videoUrl.searchParams.set('tier', 'desktop');
await videoPage.goto(videoUrl.href, {waitUntil: 'networkidle', timeout: 120000});
await videoPage.waitForFunction(() => window.__SALLE_TEMOIN__?.ready === true, null, {timeout: 120000});
await videoPage.waitForFunction(() => (window.__SALLE_TEMOIN__?.videoTime || 0) >= 16, null, {timeout: 60000});
await videoPage.waitForTimeout(400);
const video = videoPage.video();
await videoContext.close();
const raw = await video.path();
console.log('video raw', raw);
await readFile(path.join(out, 'metrics.json')).catch(() => {});
const {writeFile} = await import('node:fs/promises');
await writeFile(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 2));
await browser.close();
console.log('captures in', out);
