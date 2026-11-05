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
