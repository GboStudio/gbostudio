/**
 * Headless captures of the lighting sample room.
 *   SAMPLE_BASE_URL=http://127.0.0.1:8765/empty-museum/ node empty-museum/salle-echantillon/capture.mjs
 */
const playwright = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const chromium = playwright.chromium || playwright.default.chromium;
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const base = process.env.SAMPLE_BASE_URL || 'http://127.0.0.1:8765/empty-museum/';
const out = process.env.SAMPLE_OUT || '/tmp/salle-echantillon-captures';
await mkdir(out, {recursive: true});

const shots = [
  ['desktop-axis', 'axis', 'desktop', {width: 1920, height: 1080}],
  ['mobile-axis', 'mobile', 'mobile', {width: 390, height: 844}],
  ['detail-frame', 'frame', 'desktop', {width: 1280, height: 960}],
  ['detail-ceiling', 'ceiling', 'desktop', {width: 1280, height: 960}],
  ['detail-floor', 'floor', 'desktop', {width: 1280, height: 960}],
  ['pano-flat', 'pano', 'desktop', {width: 1920, height: 1080}],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});

const metrics = {};
for (const [name, shot, tier, viewport] of shots) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: tier === 'mobile',
    isMobile: tier === 'mobile',
  });
  const page = await context.newPage();
  const url = new URL('salle-echantillon.html', base);
  url.searchParams.set('shot', shot);
  url.searchParams.set('tier', tier);
  await page.goto(url.href, {waitUntil: 'networkidle', timeout: 180000});
  await page.waitForFunction(() => window.__SALLE_ECHANTILLON__?.ready === true, null, {timeout: 180000});
  await page.waitForTimeout(1400);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({path: file, timeout: 90000});
  metrics[name] = await page.evaluate(() => ({...window.__SALLE_ECHANTILLON__}));
  console.log(name, metrics[name].drawCalls, 'draws', metrics[name].triangles, 'tris', metrics[name].textureMegabytes, 'MB');
  await context.close();
}

await writeFile(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 2));

if (process.env.SAMPLE_SKIP_VIDEO) {
  await browser.close();
  console.log('captures in', out);
  process.exit(0);
}

const videoContext = await browser.newContext({
  viewport: {width: 1280, height: 720},
  recordVideo: {dir: out, size: {width: 1280, height: 720}},
});
const videoPage = await videoContext.newPage();
const videoUrl = new URL('salle-echantillon.html', base);
videoUrl.searchParams.set('shot', 'video');
videoUrl.searchParams.set('tier', 'desktop');
await videoPage.goto(videoUrl.href, {waitUntil: 'networkidle', timeout: 180000});
await videoPage.waitForFunction(() => window.__SALLE_ECHANTILLON__?.ready === true, null, {timeout: 180000});
await videoPage.waitForFunction(() => (window.__SALLE_ECHANTILLON__?.videoTime || 0) >= 12, null, {timeout: 60000});
await videoPage.waitForTimeout(400);
const video = videoPage.video();
await videoContext.close();
console.log('video raw', await video.path());

const switchContext = await browser.newContext({
  viewport: {width: 1280, height: 720},
  recordVideo: {dir: out, size: {width: 1280, height: 720}},
});
const switchPage = await switchContext.newPage();
const switchUrl = new URL('salle-echantillon.html', base);
switchUrl.searchParams.set('shot', 'switch');
switchUrl.searchParams.set('tier', 'desktop');
await switchPage.goto(switchUrl.href, {waitUntil: 'networkidle', timeout: 180000});
await switchPage.waitForFunction(() => window.__SALLE_ECHANTILLON__?.ready === true, null, {timeout: 180000});
await switchPage.waitForFunction(() => (window.__SALLE_ECHANTILLON__?.videoTime || 0) >= 7.6, null, {timeout: 60000});
await switchPage.waitForTimeout(400);
const switchVideo = switchPage.video();
await switchContext.close();
console.log('switch raw', await switchVideo.path());
await browser.close();
console.log('captures in', out);
