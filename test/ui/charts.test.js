// Browser tests for what the canvas charts draw. Expected positions come
// from the same shared.js geometry the page uses, and pixels are read
// back from the canvases. No screenshots are compared, so fonts and
// anti-aliasing do not matter: only colours at known positions do.
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../../shared.js');
const {
  useBrowser, appUrl, openApp, reload, storeSession, setSettings, startButton, waitForStatus
} = require('./helpers');

useBrowser();

const T = (op, left, right) => ({ op, left, right });

// Canvas layout, as in app.js (both canvases are 600 × 300).
const W = 600;
const H = 300;
const FIT = { padding: 20 };
const PREDICTED = { pad: 30 };
const PROGRESS = { left: 84, right: 12, top: 12, bottom: 28 };
const FIT_MAX_POINTS = 60;

const NAMED = { red: [255, 0, 0], green: [0, 128, 0] };

function rgb(color) {
  if (NAMED[color]) return NAMED[color];
  let hex = color.slice(1);
  if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}

// The chart colours of the page's current theme, as [r, g, b], read from
// the same CSS tokens the page draws with.
async function themeColors(page) {
  const tokens = await page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map(n => [n, style.getPropertyValue(n).trim()]));
  }, Object.values(s.CHART_COLOR_TOKENS));

  return Object.fromEntries(
    Object.entries(s.chartColors(name => tokens[name])).map(([role, v]) => [role, rgb(v)])
  );
}

// Is a pixel within `radius` of (x, y) on canvas `index` (0 = fit,
// 1 = progress) close to `color`? The canvases are transparent, so a
// pixel that a line only partly covers keeps the line's colour at a
// lower alpha; only nearly empty pixels are ignored.
function colorNear(page, index, x, y, color, { radius = 2, tolerance = 70 } = {}) {
  return page.$$eval('canvas', (canvases, a) => {
    const c = canvases[a.index];
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const cx = Math.round(a.x);
    const cy = Math.round(a.y);

    for (let dy = -a.radius; dy <= a.radius; dy++) {
      for (let dx = -a.radius; dx <= a.radius; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || py < 0 || px >= c.width || py >= c.height) continue;
        const i = (py * c.width + px) * 4;
        if (img[i + 3] < 24) continue;
        const d = Math.hypot(img[i] - a.color[0], img[i + 1] - a.color[1], img[i + 2] - a.color[2]);
        if (d <= a.tolerance) return true;
      }
    }

    return false;
  }, { index, x, y, color, radius, tolerance });
}

// Is a pixel within `radius` of (x, y) clearly green (the target line)?
// The target usually lies on a grid line (0.999, 0.99, ...), so its
// pixels are green blended with the grid's grey rather than pure green.
function greenNear(page, index, x, y, radius = 0) {
  return page.$$eval('canvas', (canvases, a) => {
    const c = canvases[a.index];
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;

    for (let dy = -a.radius; dy <= a.radius; dy++) {
      for (let dx = -a.radius; dx <= a.radius; dx++) {
        const i = ((Math.round(a.y) + dy) * c.width + Math.round(a.x) + dx) * 4;
        if (img[i + 3] >= 24 && img[i + 1] - img[i] >= 50 && img[i + 1] - img[i + 2] >= 50) return true;
      }
    }

    return false;
  }, { index, x, y, radius });
}

// How many pixels of canvas `index` are clearly green.
function countGreen(page, index) {
  return page.$$eval('canvas', (canvases, i) => {
    const c = canvases[i];
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let j = 0; j < img.length; j += 4) {
      if (img[j + 3] >= 24 && img[j + 1] - img[j] >= 50 && img[j + 1] - img[j + 2] >= 50) n++;
    }
    return n;
  }, index);
}

// How many pixels of canvas `index` are close to `color`.
function countColor(page, index, color, tolerance = 40) {
  return page.$$eval('canvas', (canvases, a) => {
    const c = canvases[a.index];
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;

    for (let i = 0; i < img.length; i += 4) {
      if (img[i + 3] < 24) continue;
      if (Math.hypot(img[i] - a.color[0], img[i + 1] - a.color[1], img[i + 2] - a.color[2]) <= a.tolerance) n++;
    }

    return n;
  }, { index, color, tolerance });
}

// The fit chart's scales for a set of points, as drawFit computes them.
function fitScales(points) {
  const x = s.valueRange(points.map(p => p.x));
  const y = s.valueRange(points.map(p => p.y));
  return {
    toX: s.linearScale(x.min, x.max, FIT.padding, W - FIT.padding),
    toY: s.linearScale(y.min, y.max, H - FIT.padding, FIT.padding)
  };
}

// The progress chart's scales for a run of `generations`.
function progressScales(generations) {
  const toX = s.linearScale(1, Math.max(generations, 2), PROGRESS.left, W - PROGRESS.right);
  const level = s.linearScale(0, s.PROGRESS_MIN_LOG, PROGRESS.top, H - PROGRESS.bottom);
  return { toX, toY: (r2) => level(s.progressLevel(r2)) };
}

// A saved 30-generation run of sin(x), with a known progress history and
// three replay steps, so the progress chart has fixed content.
const SERIES = Array.from({ length: 30 }, (_, i) => {
  const g = i + 1;
  return [g, 1 - Math.pow(10, -g / 6), 1 - Math.pow(10, -g / 12)];
});

function savedRun() {
  const model = (k) => s.compressTree(T('*', String(k), T('*', 'x', 'x')));

  return {
    timestamp: 1,
    generation: 30,
    population: [],
    model: model(0.5),
    bestFitness: 0.01,
    bestR2: SERIES[29][1],
    bestSize: 5,
    history: [],
    series: SERIES,
    timeline: [[1, 0.5, 0.5, model(0.1)], [12, 0.9, 0.1, model(0.3)], [30, SERIES[29][1], 0.01, model(0.5)]],
    config: {
      targetFormula: 'sin(x)', minX: -5, maxX: 5, sampleCount: 101,
      populationSize: 50, targetR2: 0.999, maxGenerations: 30,
      operators: ['+', '-', '*'], mutationRate: 0.1, crossoverRate: 0.7, elitismRate: 0.05,
      tournamentSize: 5, treeDepth: 4, maxTreeDepth: 8, linearScaling: true,
      constantOptimization: false, speed: 'fast', dataMode: 'formula',
      variables: ['x'], targetName: '', dataset: []
    }
  };
}

async function openSavedRun(t) {
  const page = await openApp(t, { dialogs: 'accept' });
  await storeSession(page, savedRun());
  await reload(page);
  await waitForStatus(page, 'Restored session at generation 30.');
  return page;
}

// =========================================================
// FIT CHART
// =========================================================

test('the fit chart marks the sampled points of the target formula', async (t) => {
  const page = await openApp(t);
  const COLORS = await themeColors(page);

  const points = s.generateFormulaSamples('x*x + 2', -5, 5, 101);
  const { toX, toY } = fitScales(points);
  const drawn = s.sampleIndices(points.length, FIT_MAX_POINTS);

  assert.ok(drawn.length < points.length, 'markers are thinned');

  for (const i of drawn) {
    const p = points[i];
    assert.ok(
      await colorNear(page, 0, toX(p.x), toY(p.y), COLORS.data, { radius: 0, tolerance: 10 }),
      `point ${i} (${p.x}, ${p.y}) is marked`
    );
  }

  // no program yet, so no curve
  assert.equal(await countColor(page, 0, COLORS.model), 0);
});

test('the fit chart draws the best program through the data', async (t) => {
  const page = await openApp(t);
  const COLORS = await themeColors(page);
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');

  const points = s.generateFormulaSamples('x*x + 2', -5, 5, 101);
  const { toX, toY } = fitScales(points);
  const markers = s.sampleIndices(points.length, FIT_MAX_POINTS)
    .map(i => [toX(points[i].x), toY(points[i].y)]);

  // check the curve y = x² + 2 where no marker (radius 4) covers it
  let checked = 0;

  for (let x = -4.95; x <= 4.95; x += 0.05) {
    const px = toX(x);
    const py = toY(x * x + 2);

    if (markers.some(([mx, my]) => Math.hypot(mx - px, my - py) < 5.5)) continue;

    assert.ok(await colorNear(page, 0, px, py, COLORS.model), `curve at x = ${x.toFixed(2)}`);
    checked++;
  }

  assert.ok(checked >= 20, `only ${checked} curve points could be checked`);
});

test('with several inputs the fit chart plots predicted against actual', async (t) => {
  const dataset = [];
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) dataset.push({ v: { a, b }, y: a + 2 * b });
  }

  // a share link with a fixed, slightly wrong model: y = a + 1.9 b
  const model = T('+', 'a', T('*', '1.9', 'b'));
  const code = await s.encodeShare(s.buildSharePayload({
    config: {
      targetFormula: 'x*x + 2', minX: -5, maxX: 5, sampleCount: 101, populationSize: 200,
      targetR2: 0.999, maxGenerations: 500, operators: ['+', '-', '*'], mutationRate: 0.1,
      crossoverRate: 0.7, elitismRate: 0.05, tournamentSize: 5, treeDepth: 4, maxTreeDepth: 8,
      linearScaling: true, constantOptimization: false, speed: 'fast', dataMode: 'dataset',
      variables: ['a', 'b'], targetName: 'y', dataset
    },
    model,
    r2: 0.99,
    generation: 7,
    fileName: 'fixed.csv'
  }));

  // a share link is read when the page loads
  const page = await openApp(t, { url: `${appUrl()}#/?run=${code}` });
  const COLORS = await themeColors(page);
  await waitForStatus(page, 'Loaded a shared run');

  const { min, max } = s.valueRange(dataset.map(p => p.y));
  const size = Math.min(W, H) - PREDICTED.pad * 2;
  const left = (W - size) / 2;
  const toX = s.linearScale(min, max, left, left + size);
  const toY = s.linearScale(min, max, H - PREDICTED.pad, H - PREDICTED.pad - size);

  // each row at (actual, predicted); points on the box's edge are
  // partly clipped, so look within 2 px of the centre
  for (const p of dataset) {
    const predicted = s.evaluateTree(model, p.v);
    assert.ok(
      await colorNear(page, 0, toX(p.y), toY(predicted), COLORS.data, { radius: 2, tolerance: 10 }),
      `row a=${p.v.a} b=${p.v.b}`
    );
  }

  // the perfect-prediction diagonal, between the points
  for (const v of [min + 0.25, (min + max) / 2 + 0.25, max - 0.25]) {
    assert.ok(await colorNear(page, 0, toX(v), toY(v), COLORS.model), `diagonal at ${v}`);
  }
});

// =========================================================
// PROGRESS CHART
// =========================================================

test('the progress chart draws its grid and the dashed target line', async (t) => {
  const page = await openApp(t);
  const COLORS = await themeColors(page);
  const { toY } = progressScales(1);
  const x = PROGRESS.left + 40;

  // one grid line per power of ten
  for (const { r2, label } of s.progressGrid()) {
    if (Math.abs(r2 - 0.999) < 1e-9) continue; // under the target line
    assert.ok(await colorNear(page, 1, x, toY(r2), COLORS.grid, { radius: 0, tolerance: 20 }), label);
  }

  // the target R² 0.999: green dashes 6 px long with 4 px gaps
  const y = toY(0.999);
  assert.ok(await greenNear(page, 1, PROGRESS.left + 3, y), 'dash');
  assert.ok(!(await greenNear(page, 1, PROGRESS.left + 8, y)), 'gap');
  assert.ok(await greenNear(page, 1, PROGRESS.left + 13, y), 'next dash');
  assert.ok(!(await greenNear(page, 1, PROGRESS.left + 3, toY(0.99), 1)), 'only at the target');

  // no run yet: no best or median line
  assert.equal(await countColor(page, 1, COLORS.model), 0);
});

test('the target line follows the Target R² setting', async (t) => {
  const page = await openApp(t);
  const COLORS = await themeColors(page);
  const { toY } = progressScales(1);
  const x = PROGRESS.left + 3;

  for (const r2 of [0.99, 0.995, 0.9]) {
    await setSettings(page, { 'Target R²': r2 });
    assert.ok(await greenNear(page, 1, x, toY(r2)), `at ${r2}`);
    assert.ok(!(await greenNear(page, 1, x, toY(0.999), 1)), `not at 0.999 when ${r2}`);
  }

  // R² 1 cannot be shown on a log scale, so there is no target line
  await setSettings(page, { 'Target R²': 1 });
  assert.equal(await countGreen(page, 1), 0);
});

test('the progress chart draws the best and median of every generation', async (t) => {
  const page = await openSavedRun(t);
  const COLORS = await themeColors(page);
  const { toX, toY } = progressScales(30);

  for (const g of [5, 15, 25]) {
    const [, best, median] = SERIES[g - 1];
    assert.ok(await colorNear(page, 1, toX(g), toY(best), COLORS.model), `best at generation ${g}`);
    assert.ok(await colorNear(page, 1, toX(g), toY(median), COLORS.median, { tolerance: 50 }), `median at generation ${g}`);
  }

  // the latest best is marked with a dot
  const [, last] = SERIES[29];
  assert.ok(await colorNear(page, 1, toX(30) - 2, toY(last), COLORS.model, { radius: 0, tolerance: 10 }));

  // no replay marker until the replay is used
  assert.equal(await countColor(page, 1, COLORS.replay), 0);
});

test('the replay position is marked on the progress chart', async (t) => {
  const page = await openSavedRun(t);
  const COLORS = await themeColors(page);
  const { toX } = progressScales(30);

  // the second improvement is at generation 12
  await page.getByRole('slider', { name: 'Replay position' }).fill('1');

  const x = toX(12);
  for (const y of [PROGRESS.top + 5, (PROGRESS.top + H - PROGRESS.bottom) / 2 + 20, H - PROGRESS.bottom - 5]) {
    assert.ok(await colorNear(page, 1, x, y, COLORS.replay, { radius: 1 }), `marker at y = ${y}`);
  }

  // and removed again when going back to the latest program
  await page.getByRole('button', { name: 'Back to latest', exact: true }).click();
  assert.equal(await countColor(page, 1, COLORS.replay), 0);
});
