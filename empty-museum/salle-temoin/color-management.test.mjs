/**
 * A flat #7A2E2E patch under neutral light must land within ΔE 8 of the
 * ACES-tone-mapped value. This is the check that caught the pass-4 cast:
 * an sRGB albedo decoded as linear (or the reverse) misses that target.
 *
 *   TEM_BASE_URL=http://127.0.0.1:8765/empty-museum/ node --test empty-museum/salle-temoin/color-management.test.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

const EXPOSURE = 1.12;
const WALL = [0x7a, 0x2e, 0x2e];

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel) {
  const c = Math.min(1, Math.max(0, channel));
  const encoded = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

function aces(color) {
  // three.js r186 ACESFilmicToneMapping, exposure included.
  const scale = EXPOSURE / 0.6;
  let r = color[0] * scale;
  let g = color[1] * scale;
  let b = color[2] * scale;
  const input = [
    [0.59719, 0.35458, 0.04823],
    [0.07600, 0.90834, 0.01566],
    [0.02840, 0.13383, 0.83777],
  ];
  const output = [
    [1.60475, -0.53108, -0.07367],
    [-0.10208, 1.10813, -0.00605],
    [-0.00327, -0.07276, 1.07602],
  ];
  const lin = input.map(row => row[0] * r + row[1] * g + row[2] * b);
  const fit = lin.map(v => ((v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081)));
  const out = output.map(row => row[0] * fit[0] + row[1] * fit[1] + row[2] * fit[2]);
  return out.map(v => Math.min(1, Math.max(0, v)));
}

function expectedWall() {
  const linear = WALL.map(srgbToLinear);
  return aces(linear).map(linearToSrgb);
}

function lab(rgb) {
  const lin = rgb.map(srgbToLinear);
  let x = lin[0] * 0.4124564 + lin[1] * 0.3575761 + lin[2] * 0.1804375;
  let y = lin[0] * 0.2126729 + lin[1] * 0.7151522 + lin[2] * 0.0721750;
  let z = lin[0] * 0.0193339 + lin[1] * 0.1191920 + lin[2] * 0.9503041;
  x /= 0.95047;
  z /= 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a, b) {
  const [L1, a1, b1] = lab(a);
  const [L2, a2, b2] = lab(b);
  return Math.hypot(L1 - L2, a1 - a2, b1 - b2);
}

test('the analytical tone map of #7A2E2E is a muted red, not washed pink', () => {
  const expected = expectedWall();
  assert.ok(expected[0] > expected[1] + 40, `red channel should lead: ${expected}`);
  assert.ok(expected[1] < 80, `green should stay in the pompeian range: ${expected}`);
});

test('a neutral-lit #7A2E2E patch matches the tone-mapped value', async () => {
  const base = process.env.TEM_BASE_URL || 'http://127.0.0.1:8765/empty-museum/';
  const playwright = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const chromium = playwright.chromium || playwright.default.chromium;
  const executable = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({
    executablePath: executable,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const page = await browser.newPage();
    const url = new URL('salle-temoin/color-swatch.html', base);
    await page.goto(url.href, {waitUntil: 'networkidle', timeout: 60000});
    await page.waitForFunction(() => window.__SWATCH__?.flat, null, {timeout: 30000});
    const swatch = await page.evaluate(() => window.__SWATCH__);
    const expected = expectedWall();
    const flat = deltaE(swatch.flat, expected);
    // The damask is tone-on-tone, so the average of the albedo — not one motif pixel —
    // has to survive the same neutral light. A wrong KTX2 transfer function moves it.
    const texture = deltaE(swatch.texture, swatch.flat);
    assert.ok(flat < 8, `flat patch ΔE ${flat.toFixed(2)} from ${expected}, got ${swatch.flat}`);
    assert.ok(texture < 8, `pompeian KTX2 average ΔE ${texture.toFixed(2)} from the flat patch, got ${swatch.texture} (file space ${swatch.textureSpace})`);
  } finally {
    await browser.close();
  }
});
