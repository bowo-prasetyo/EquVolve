// Browser tests for what the canvas charts draw. Expected positions come
// from the same shared.js geometry the page uses, and pixels are read
// back from the canvases. No screenshots are compared, so fonts and
// anti-aliasing do not matter: only colours at known positions do.
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../../shared.js');
const {
  useBrowser, appUrl, openApp, reload, storeSession, setSettings, startButton, waitForStatus, restoreBanner
} = require('./helpers');

useBrowser();

const T = (op, left, right) => ({ op, left, right });

const FIT_MAX_POINTS = 60;

// A chart's size in CSS pixels, which its layout is computed from. The
// tests run at a pixel density of 1, so it is also its size in canvas
// pixels, where the pixels are read.
function chartSize(page, index) {
  return page.$$eval('canvas', (cs, i) =>
    [cs[i].width / devicePixelRatio, cs[i].height / devicePixelRatio], index);
}

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

// The fit chart's layout for a set of points, as the page computes it.
async function fitScales(page, points) {
  const [W, H] = await chartSize(page, 0);
  return s.fitGeometry(s.valueRange(points.map(p => p.x)), s.valueRange(points.map(p => p.y)), W, H);
}

// The progress chart's layout for a run of `generations`.
async function progressScales(page, generations) {
  const [W, H] = await chartSize(page, 1);
  return s.progressGeometry(generations, W, H);
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
  const page = await openApp(t);
  await storeSession(page, savedRun());
  await reload(page);
  await restoreBanner(page).getByRole('button', { name: 'Restore run' }).click();
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
  const { toX, toY } = await fitScales(page, points);
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
  const { toX, toY } = await fitScales(page, points);
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
  const [W, H] = await chartSize(page, 0);
  const { toX, toY } = s.predictedGeometry({ min, max }, W, H);

  // each row at (actual, predicted)
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

test('the fit chart has a frame and grid lines at round values', async (t) => {
  const page = await openApp(t);
  const COLORS = await themeColors(page);
  const points = s.generateFormulaSamples('x*x + 2', -5, 5, 101);
  const { plot, toX, toY, xTicks, yTicks } = await fitScales(page, points);

  assert.ok(xTicks.includes(0) && xTicks.length >= 3, `x ticks ${xTicks}`);
  assert.ok(yTicks.length >= 3, `y ticks ${yTicks}`);

  // the grid line at x = 0, near the top where the parabola is far away
  assert.ok(
    await colorNear(page, 0, Math.round(toX(0)), plot.top + 6, COLORS.grid, { radius: 0, tolerance: 20 }),
    'vertical grid line at x = 0'
  );

  // a horizontal grid line at a y tick, left of the curve
  const y = Math.round(toY(yTicks[1]));
  assert.ok(await colorNear(page, 0, plot.left + 3, y, COLORS.grid, { radius: 0, tolerance: 20 }), `grid at y = ${yTicks[1]}`);

  // the frame around the plot
  assert.ok(await colorNear(page, 0, plot.left, (plot.top + plot.bottom) / 2, COLORS.frame, { radius: 0, tolerance: 20 }), 'frame');
});

test('the charts are drawn at the screen\'s pixel density and fit a phone', async (t) => {
  const page = await openApp(t, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const COLORS = await themeColors(page);

  const sizes = await page.$$eval('canvas', (cs) => cs.map(c => [c.width, c.height, c.clientWidth, c.clientHeight]));

  for (const [width, height, cssWidth, cssHeight] of sizes) {
    assert.equal(width, 2 * cssWidth, 'twice as many canvas pixels across');
    assert.equal(height, 2 * cssHeight, 'and down');
    assert.ok(cssHeight >= 240, `tall enough to read: ${cssHeight}`);
  }

  // the first data marker, in canvas pixels
  const points = s.generateFormulaSamples('x*x + 2', -5, 5, 101);
  const { toX, toY } = await fitScales(page, points);
  assert.ok(await colorNear(page, 0, 2 * toX(-5), 2 * toY(27), COLORS.data, { radius: 1, tolerance: 10 }));
});

test('the charts are redrawn at their new size when the window changes', async (t) => {
  const page = await openApp(t);
  const before = await chartSize(page, 0);

  await page.setViewportSize({ width: 700, height: 720 });
  await page.waitForFunction((w) => document.querySelector('canvas').width !== w, before[0]);

  const [W, H] = await chartSize(page, 0);
  const width = await page.$eval('canvas', c => c.clientWidth);
  assert.equal(W, width, 'drawn at the width it is shown at');
  assert.deepEqual([W, H], [s.chartSize(width).width, s.chartSize(width).height]);

  // and the data are drawn in the new layout
  const COLORS = await themeColors(page);
  const points = s.generateFormulaSamples('x*x + 2', -5, 5, 101);
  const { toX, toY } = await fitScales(page, points);
  assert.ok(await colorNear(page, 0, toX(-5), toY(27), COLORS.data, { radius: 0, tolerance: 10 }));
});

// =========================================================
// PROGRESS CHART
// =========================================================

test('the progress chart draws its grid and the dashed target line', async (t) => {
  const page = await openApp(t);
  const COLORS = await themeColors(page);
  const { toY, plot } = await progressScales(page, 1);
  const x = plot.left + 40;

  // one grid line per power of ten
  for (const { r2, label } of s.progressGrid()) {
    if (Math.abs(r2 - 0.999) < 1e-9) continue; // under the target line
    assert.ok(await colorNear(page, 1, x, toY(r2), COLORS.grid, { radius: 0, tolerance: 20 }), label);
  }

  // the target R² 0.999: green dashes 6 px long with 4 px gaps
  const y = toY(0.999);
  assert.ok(await greenNear(page, 1, plot.left + 3, y), 'dash');
  assert.ok(!(await greenNear(page, 1, plot.left + 8, y)), 'gap');
  assert.ok(await greenNear(page, 1, plot.left + 13, y), 'next dash');
  assert.ok(!(await greenNear(page, 1, plot.left + 3, toY(0.99), 1)), 'only at the target');

  // no run yet: no best or median line
  assert.equal(await countColor(page, 1, COLORS.model), 0);
});

test('the target line follows the Target R² setting', async (t) => {
  const page = await openApp(t);
  const COLORS = await themeColors(page);
  const { toY, plot } = await progressScales(page, 1);
  const x = plot.left + 3;

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
  const { toX, toY } = await progressScales(page, 30);

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
  const { toX, plot } = await progressScales(page, 30);

  // the second improvement is at generation 12
  await page.getByRole('slider', { name: 'Replay position' }).fill('1');

  const x = toX(12);
  for (const y of [plot.top + 5, (plot.top + plot.bottom) / 2 + 20, plot.bottom - 5]) {
    assert.ok(await colorNear(page, 1, x, y, COLORS.replay, { radius: 1 }), `marker at y = ${y}`);
  }

  // and removed again when going back to the latest program
  await page.getByRole('button', { name: 'Back to latest', exact: true }).click();
  assert.equal(await countColor(page, 1, COLORS.replay), 0);
});
