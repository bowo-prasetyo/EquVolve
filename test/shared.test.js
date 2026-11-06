const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../shared.js');
const { baseConfig } = require('./helpers');

test('target formulas accept both Math.sin(x) and sin(x) syntax', () => {
  const a = shared.generateFormulaSamples('Math.sin(x)', 0, 3, 7);
  const b = shared.generateFormulaSamples('sin(x)', 0, 3, 7);
  assert.deepEqual(a, b);
});

test('evolved expressions round-trip as target formulas', () => {
  const tree = { op: 'pow', left: { op: 'sin', child: 'x' }, right: '2.000' };
  const expr = shared.treeToString(tree);
  const samples = shared.generateFormulaSamples(expr, -2, 2, 9);
  for (const p of samples) {
    assert.ok(Math.abs(p.y - shared.evaluateTree(tree, p.x)) < 1e-12);
  }
});

test('non-finite samples are dropped', () => {
  const s = shared.generateFormulaSamples('1/x', -1, 1, 3);
  assert.deepEqual(s.map(p => p.x), [-1, 1]);
});

test('validateConfig accepts the defaults', () => {
  assert.deepEqual(shared.validateConfig({ ...baseConfig(), targetR2: 0.99 }), []);
});

test('validateConfig rejects bad input with readable messages', () => {
  const cases = [
    [{ populationSize: 1 }, /Population Size/],
    [{ populationSize: '' }, /Population Size/],
    [{ mutationRate: 1.5 }, /Mutation Rate/],
    [{ targetR2: 1.2 }, /Target R²/],
    [{ minX: 5, maxX: -5 }, /X Range/],
    [{ targetFormula: 'x +* 2' }, /Formula is invalid/],
    [{ targetFormula: '7' }, /constant/],
    [{ operators: [] }, /operator/],
    [{ dataMode: 'dataset', dataset: [] }, /CSV/]
  ];

  for (const [override, pattern] of cases) {
    const errors = shared.validateConfig({ ...baseConfig({ targetR2: 0.99 }), ...override });
    assert.ok(errors.some(e => pattern.test(e)), `${JSON.stringify(override)} -> ${errors}`);
  }
});

test('normalizeConfig converts legacy minError to targetR2', () => {
  const c = shared.normalizeConfig({ minError: 0.01 });
  assert.ok(Math.abs(c.targetR2 - 0.99) < 1e-12);
  assert.equal('minError' in c, false);
  assert.equal(c.sampleCount, shared.DEFAULT_SAMPLE_COUNT);
});

test('validateConfigFields names the field of each problem', () => {
  const errors = shared.validateConfigFields({
    ...baseConfig({ targetR2: 0.99 }),
    populationSize: 1,
    targetFormula: 'foo(x',
    minX: 5,
    maxX: -5,
    operators: []
  });

  assert.deepEqual(errors.map(e => e.field).sort(), ['operators', 'populationSize', 'targetFormula', 'xRange']);
  assert.match(errors.find(e => e.field === 'targetFormula').message, /unknown name "foo"/);

  // validateConfig gives the same problems as messages
  assert.deepEqual(shared.validateConfig({
    ...baseConfig({ targetR2: 0.99 }), populationSize: 1, targetFormula: 'foo(x', minX: 5, maxX: -5, operators: []
  }), errors.map(e => e.message));
});

test('validateConfigFields checks the formula even when other settings are wrong', () => {
  const fields = (override) =>
    shared.validateConfigFields({ ...baseConfig({ targetR2: 0.99 }), ...override }).map(e => e.field);

  assert.deepEqual(fields({ targetFormula: 'x +* 2', tournamentSize: 0 }).sort(), ['targetFormula', 'tournamentSize']);
  assert.deepEqual(fields({ targetFormula: 'bad(x)', sampleCount: 1 }).sort(), ['sampleCount', 'targetFormula']);

  // a constant target belongs to the formula, or to the dataset
  assert.deepEqual(fields({ targetFormula: '7' }), ['targetFormula']);
  assert.deepEqual(
    fields({ dataMode: 'dataset', variables: ['x'], dataset: [{ x: 1, y: 2 }, { x: 2, y: 2 }] }),
    ['dataset']
  );
});

test('formulaOperators finds the operators a formula needs', () => {
  const ops = (f) => shared.formulaOperators(f).ops.sort();

  assert.deepEqual(ops('x*x + 2'), ['*', '+']);
  assert.deepEqual(ops('x*x + 2/x'), ['*', '+', '/']);
  assert.deepEqual(ops('Math.sin(x) * exp(x/3)'), ['*', '/', 'exp', 'sin']);
  assert.deepEqual(ops('x - 1'), ['-']);

  // a leading or nested sign is not subtraction
  assert.deepEqual(ops('-x'), []);
  assert.deepEqual(ops('exp(-x*x)'), ['*', 'exp']);
  assert.deepEqual(ops('2 * -x'), ['*']);

  // whole powers are repeated multiplication; others need pow
  assert.deepEqual(ops('pow(x, 2)'), ['*']);
  assert.deepEqual(ops('x**3'), ['*']);
  assert.deepEqual(ops('pow(sin(x), 2)'), ['*', 'sin']);
  assert.deepEqual(ops('pow(x, 2.5)'), ['pow']);
  assert.deepEqual(ops('x**x'), ['pow']);
});

test('formulaOperators lists Math functions that are not operators, and ignores bad formulas', () => {
  assert.deepEqual(shared.formulaOperators('abs(x) + floor(x)').unsupported, ['abs', 'floor']);
  assert.deepEqual(shared.formulaOperators('PI * x').unsupported, []);
  assert.deepEqual(shared.formulaOperators('foo(x)'), { ops: [], unsupported: [] });
  assert.deepEqual(shared.formulaOperators(''), { ops: [], unsupported: [] });
});

test('fitQuality puts R² into words', () => {
  assert.equal(shared.fitQuality(1), 'Excellent fit');
  assert.equal(shared.fitQuality(0.999), 'Excellent fit');
  assert.equal(shared.fitQuality(0.995), 'Very good fit');
  assert.equal(shared.fitQuality(0.95), 'Good fit');
  assert.equal(shared.fitQuality(0.7), 'Rough fit');
  assert.equal(shared.fitQuality(0.1), 'Poor fit');
  assert.equal(shared.fitQuality(-0.5), 'Worse than guessing the average');
  assert.equal(shared.fitQuality(null), '');
  assert.equal(shared.fitQuality(NaN), '');
});

test('formatShortNumber keeps tree labels short', () => {
  assert.deepEqual(
    [0.0000017645, 123456.78, -2.5, 0.30000000001, 12345.678, 0.001, 1e-7, 0, -0.00042].map(shared.formatShortNumber),
    ['1.76e-6', '1.23e5', '-2.5', '0.3', '12350', '0.001', '1e-7', '0', '-4.2e-4']
  );

  // never more than 9 characters (as in -1.23e-12) for a wide spread of values
  for (let e = -12; e <= 12; e++) {
    for (const m of [1, -1.23456789, 9.87654321]) {
      const label = shared.formatShortNumber(m * Math.pow(10, e));
      assert.ok(label.length <= 9, `${m}e${e} -> ${label}`);
    }
  }
});
