// Browser tests for the charts' theme colours: the canvases use the
// theme's background, their lines and points match the colour keys in
// their captions, and a theme switch redraws them.
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../../shared.js');
const { useBrowser, openApp, startButton, waitForStatus } = require('./helpers');

useBrowser();

// "rgb(26, 26, 26)" or "#1a1a1a" -> [26, 26, 26]
function rgb(color) {
  const m = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (m) return m.slice(1, 4).map(Number);
  let hex = color.trim().slice(1);
  if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The colour each caption key is shown in, as the page computes it.
async function keyColors(page) {
  const keys = await page.$$eval('figcaption .key', (spans) =>
    spans.map(k => [k.classList[1], getComputedStyle(k).color]));
  return Object.fromEntries(keys.map(([name, color]) => [name, rgb(color)]));
}

async function token(page, name) {
  return rgb(await page.evaluate((n) =>
    getComputedStyle(document.documentElement).getPropertyValue(n), name));
}

async function canvasBackground(page, index) {
  return rgb(await page.$$eval('canvas', (cs, i) => getComputedStyle(cs[i]).backgroundColor, index));
}

// The pixel at (x, y) on canvas `index`, as [r, g, b, alpha].
function pixel(page, index, x, y) {
  return page.$$eval('canvas', (cs, a) =>
    [...cs[a.index].getContext('2d').getImageData(a.x, a.y, 1, 1).data], { index, x, y });
}

// Where the first data marker (x = -5, y = 27) of the default target
// x*x + 2 is drawn on the fit chart, and the latest-best dot of a
// one-generation run on the progress chart (as in app.js).
const FIRST_MARKER = [20, 20];
const LATEST_BEST_DOT = [84 + 1, 272];

// WCAG contrast ratio between two colours
function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ['dark', 'light']) {
  test(`${scheme} theme: the charts use the theme's background and their keys' colours`, async (t) => {
    const page = await openApp(t, { colorScheme: scheme });
    const keys = await keyColors(page);

    // the canvases' background is the theme's chart background
    const bg = await token(page, '--chart-bg');
    assert.deepEqual(await canvasBackground(page, 0), bg, 'fit chart background');
    assert.deepEqual(await canvasBackground(page, 1), bg, 'progress chart background');

    // data points are drawn in the colour of the "data" key
    const marker = await pixel(page, 0, ...FIRST_MARKER);
    assert.ok(distance(marker, keys.cyan) <= 3, `marker ${marker} vs key ${keys.cyan}`);

    await startButton(page).click();
    await waitForStatus(page, 'Target R² reached');

    // the best program's dot on the progress chart matches the "best" key
    const best = await pixel(page, 1, ...LATEST_BEST_DOT);
    assert.ok(distance(best, keys.red) <= 3, `best ${best} vs key ${keys.red}`);

    // the target line's key matches the target token the line is drawn in
    assert.deepEqual(keys.green, await token(page, s.CHART_COLOR_TOKENS.target));
    assert.deepEqual(keys.grey, await token(page, s.CHART_COLOR_TOKENS.median));
  });

  test(`${scheme} theme: every chart colour is readable on the chart background`, async (t) => {
    const page = await openApp(t, { colorScheme: scheme });
    const bg = await token(page, '--chart-bg');

    // 3:1 for lines and points, 4.5:1 for the axis labels
    for (const role of ['data', 'model', 'median', 'target', 'replay']) {
      const c = await token(page, s.CHART_COLOR_TOKENS[role]);
      assert.ok(contrast(c, bg) >= 3, `${role}: contrast ${contrast(c, bg).toFixed(2)}`);
    }

    const text = await token(page, s.CHART_COLOR_TOKENS.text);
    assert.ok(contrast(text, bg) >= 4.5, `labels: contrast ${contrast(text, bg).toFixed(2)}`);

    // the grid is visible but quieter than the lines
    const grid = await token(page, s.CHART_COLOR_TOKENS.grid);
    assert.ok(contrast(grid, bg) > 1.2, 'grid visible');
  });
}

test('the theme toggle redraws the charts in the new colours', async (t) => {
  const page = await openApp(t, { colorScheme: 'dark' });

  const darkMarker = await pixel(page, 0, ...FIRST_MARKER);
  const darkBg = await canvasBackground(page, 0);

  await page.locator('button.theme-toggle').click(); // Auto -> Light
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');

  const keys = await keyColors(page);
  const lightMarker = await pixel(page, 0, ...FIRST_MARKER);

  assert.ok(distance(lightMarker, keys.cyan) <= 3, `redrawn in the light key colour: ${lightMarker}`);
  assert.ok(distance(lightMarker, darkMarker) > 20, 'the colour changed');
  assert.notDeepEqual(await canvasBackground(page, 0), darkBg, 'the background changed');
});

test('in Auto, a device switch between light and dark redraws the charts', async (t) => {
  const page = await openApp(t, { colorScheme: 'light' });
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');

  const lightBest = await pixel(page, 1, ...LATEST_BEST_DOT);

  await page.emulateMedia({ colorScheme: 'dark' });

  const keys = await keyColors(page);
  await page.waitForFunction(([x, y, want]) => {
    const d = document.querySelectorAll('canvas')[1].getContext('2d').getImageData(x, y, 1, 1).data;
    return Math.hypot(d[0] - want[0], d[1] - want[1], d[2] - want[2]) <= 3;
  }, [...LATEST_BEST_DOT, keys.red]);

  const darkBest = await pixel(page, 1, ...LATEST_BEST_DOT);
  assert.ok(distance(darkBest, lightBest) > 20, `${lightBest} -> ${darkBest}`);
});
