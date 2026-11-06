// The chart geometry from shared.js: ranges, scales, point thinning and
// the progress chart's log scale. The drawing itself is checked in the
// browser by test/ui/charts.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../shared.js');

const close = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} is not ${expected}`);

test('valueRange finds the extremes and widens a single value', () => {
  assert.deepEqual(s.valueRange([3, -2, 7, 0]), { min: -2, max: 7 });
  assert.deepEqual(s.valueRange([-5, -1]), { min: -5, max: -1 });

  // all equal: widened so that scales never divide by zero
  assert.deepEqual(s.valueRange([4, 4, 4]), { min: 3, max: 5 });
  assert.deepEqual(s.valueRange([0]), { min: -1, max: 1 });
});

test('valueRange handles many values without spreading them into Math.min', () => {
  const values = Array.from({ length: 200000 }, (_, i) => i - 1000);
  assert.deepEqual(s.valueRange(values), { min: -1000, max: 198999 });
});

test('linearScale maps the range onto the screen, also upside down', () => {
  const x = s.linearScale(-5, 5, 20, 580);
  assert.equal(x(-5), 20);
  assert.equal(x(5), 580);
  assert.equal(x(0), 300);

  // a y axis: larger values are higher up, so at smaller pixel rows
  const y = s.linearScale(0, 10, 280, 20);
  assert.equal(y(0), 280);
  assert.equal(y(10), 20);
  assert.equal(y(5), 150);

  // values outside the range extrapolate (the plot clips them)
  assert.equal(x(10), 860);
});

test('sampleIndices keeps everything when there is room', () => {
  assert.deepEqual(s.sampleIndices(5, 60), [0, 1, 2, 3, 4]);
  assert.deepEqual(s.sampleIndices(60, 60), [...Array(60).keys()]);
  assert.deepEqual(s.sampleIndices(0, 60), []);
});

test('sampleIndices thins evenly to at most the limit, from the first point', () => {
  for (const [count, max] of [[101, 60], [1000, 400], [61, 60], [10000, 60]]) {
    const idx = s.sampleIndices(count, max);

    // floating-point steps can fit in one extra point (61 of 61 for a
    // limit of 60), hence "about" the limit
    assert.ok(idx.length <= max + 1, `${count}/${max}: ${idx.length} drawn`);
    assert.ok(idx.length >= max - 1, `${count}/${max}: only ${idx.length} drawn`);
    assert.equal(idx[0], 0);
    assert.ok(idx[idx.length - 1] < count);
    assert.ok(idx.every((v, i) => i === 0 || v > idx[i - 1]), 'strictly increasing');

    // evenly spread: no gap is more than one index bigger than another
    const gaps = idx.slice(1).map((v, i) => v - idx[i]);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, `${count}/${max}: uneven gaps`);
  }
});

test('progressLevel is log10(1 − R²), clamped to the chart', () => {
  close(s.progressLevel(0), 0);
  close(s.progressLevel(0.9), -1);
  close(s.progressLevel(0.99), -2);
  close(s.progressLevel(0.999), -3);

  // a perfect fit and anything better than 10^-6 sit on the bottom edge
  assert.equal(s.progressLevel(1), s.PROGRESS_MIN_LOG);
  assert.equal(s.progressLevel(1 - 1e-9), s.PROGRESS_MIN_LOG);

  // worse than the mean (negative R²), not a number, or -Infinity: top edge
  assert.equal(s.progressLevel(-5), 0);
  assert.equal(s.progressLevel(NaN), 0);
  assert.equal(s.progressLevel(-Infinity), 0);

  // a custom range
  assert.equal(s.progressLevel(0.99999, -3), -3);
});

test('progressGrid gives one labelled line per power of ten', () => {
  const grid = s.progressGrid();

  assert.deepEqual(grid.map(g => g.label), [
    'R² 0', 'R² 0.9', 'R² 0.99', 'R² 0.999', 'R² 0.9999', 'R² 0.99999', 'R² 0.999999'
  ]);
  grid.forEach((g, k) => close(s.progressLevel(g.r2), -k, 1e-6));
});

test('the progress chart puts R² 0.999 halfway down', () => {
  // as in app.js: levels 0 .. -6 map onto rows top .. H - bottom
  const top = 12;
  const bottom = 300 - 28;
  const toY = s.linearScale(0, s.PROGRESS_MIN_LOG, top, bottom);

  close(toY(s.progressLevel(0)), top);
  close(toY(s.progressLevel(0.999)), (top + bottom) / 2);
  close(toY(s.progressLevel(1)), bottom);
});

const ROLES = ['data', 'model', 'median', 'target', 'replay', 'grid', 'frame', 'text'];

test('every chart colour comes from a theme token, with a fallback', () => {
  assert.deepEqual(Object.keys(s.CHART_COLOR_TOKENS).sort(), [...ROLES].sort());
  assert.deepEqual(Object.keys(s.CHART_COLOR_FALLBACKS).sort(), [...ROLES].sort());

  // lines and points use the caption keys' tokens, so they always match
  assert.equal(s.CHART_COLOR_TOKENS.data, '--key-cyan');
  assert.equal(s.CHART_COLOR_TOKENS.model, '--key-red');
  assert.equal(s.CHART_COLOR_TOKENS.median, '--key-grey');
  assert.equal(s.CHART_COLOR_TOKENS.target, '--key-green');
  assert.equal(s.CHART_COLOR_TOKENS.replay, '--key-blue');
});

test('chartColors resolves the tokens and falls back for missing ones', () => {
  const css = { '--key-cyan': ' #00808c ', '--key-red': '#d32f2f', '--chart-grid': '' };
  const colors = s.chartColors(name => css[name]);

  assert.equal(colors.data, '#00808c', 'trimmed');
  assert.equal(colors.model, '#d32f2f');
  assert.equal(colors.grid, s.CHART_COLOR_FALLBACKS.grid, 'empty value');
  assert.equal(colors.replay, s.CHART_COLOR_FALLBACKS.replay, 'missing value');
  assert.deepEqual(Object.keys(colors).sort(), [...ROLES].sort());
});

test('every chart token is defined in each theme of style.css', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'style.css'), 'utf8');

  // the dark default, light by device setting, and light by choice
  const blocks = [
    css.match(/:root \{([^}]*)\}/)[1],
    css.match(/:root:not\(\[data-theme="dark"\]\) \{([^}]*)\}/)[1],
    css.match(/:root\[data-theme="light"\] \{([^}]*)\}/)[1]
  ];

  for (const [i, block] of blocks.entries()) {
    for (const token of [...Object.values(s.CHART_COLOR_TOKENS), '--chart-bg']) {
      assert.match(block, new RegExp(`${token}:\\s*#[0-9a-f]{3,6};`), `${token} in theme block ${i}`);
    }
  }
});

test('niceTicks gives round steps of 1, 2 or 5 inside the range', () => {
  assert.deepEqual(s.niceTicks(-5.4, 5.4, 8), [-4, -2, 0, 2, 4]);
  assert.deepEqual(s.niceTicks(0.6, 27.4, 6), [5, 10, 15, 20, 25]);
  assert.deepEqual(s.niceTicks(-0.003, 0.002, 5), [-0.003, -0.002, -0.001, 0, 0.001, 0.002]);
  assert.deepEqual(s.niceTicks(0, 1e6, 4), [0, 500000, 1000000]);

  // no floating-point noise
  for (const v of s.niceTicks(0.1, 0.7, 6)) assert.equal(v, Number(v.toFixed(10)));

  // nothing for an empty or broken range
  assert.deepEqual(s.niceTicks(1, 1), []);
  assert.deepEqual(s.niceTicks(NaN, 1), []);
});

test('formatTick keeps labels short', () => {
  assert.deepEqual([0, -2.5, 0.3, 1000, 123456, 0.0001234].map(s.formatTick),
    ['0', '-2.5', '0.3', '1000', '1.2e5', '1.2e-4']);
});

test('chartSize keeps charts readable on narrow screens', () => {
  assert.deepEqual(s.chartSize(600), { width: 600, height: 300 });
  assert.deepEqual(s.chartSize(318), { width: 318, height: 240 });
  assert.deepEqual(s.chartSize(1200), { width: 1200, height: 340 });
  assert.deepEqual(s.chartSize(0), { width: 600, height: 300 });
});

test('fitGeometry keeps the data inside the plot, away from the frame', () => {
  const g = s.fitGeometry({ min: -5, max: 5 }, { min: 2, max: 27 }, 600, 300);

  assert.ok(g.toX(-5) > g.plot.left && g.toX(5) < g.plot.right);
  assert.ok(g.toY(27) > g.plot.top && g.toY(2) < g.plot.bottom);
  assert.ok(g.toY(27) < g.toY(2), 'larger values are higher up');

  // room for the tick labels and axis titles
  assert.ok(g.plot.left >= 50 && 300 - g.plot.bottom >= 36);
  assert.ok(g.xTicks.includes(0));
});

test('predictedGeometry draws a square plot with the same scale on both axes', () => {
  const g = s.predictedGeometry({ min: 0, max: 10 }, 600, 300);

  close(g.plot.right - g.plot.left, g.plot.bottom - g.plot.top);
  close(g.toX(7) - g.toX(2), g.toY(2) - g.toY(7));
});

test('progressGeometry spans the generations and the R² levels', () => {
  const g = s.progressGeometry(30, 600, 300);

  close(g.toX(1), g.plot.left);
  close(g.toX(30), g.plot.right);
  close(g.toY(0), g.plot.top);
  close(g.toY(1), g.plot.bottom);
  assert.equal(s.progressGeometry(1, 600, 300).maxG, 2);
});
