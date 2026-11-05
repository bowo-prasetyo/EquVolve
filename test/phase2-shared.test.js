const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../shared.js');

const T = (op, left, right) => ({ op, left, right });
const U = (op, child) => ({ op, child });

function sameValues(a, b, xs = [-2.5, -1, -0.3, 0.7, 1, 2, 3.3]) {
  for (const x of xs) {
    const va = s.evaluateTree(a, x);
    const vb = s.evaluateTree(b, x);
    if (!Number.isFinite(va)) continue;
    assert.ok(Math.abs(va - vb) <= 1e-9 * Math.max(1, Math.abs(va)), `x=${x}: ${va} vs ${vb}`);
  }
}

// ---------- simplification ----------

test('folds constants and collects like terms', () => {
  // (2.469 + ((-2.507 + (x * x)) - -1.712))  ->  x^2 + 1.674
  const tree = T('+', '2.469', T('-', T('+', '-2.507', T('*', 'x', 'x')), '-1.712'));
  const out = s.simplifyTree(tree);
  assert.equal(s.toInfix(out), 'pow(x, 2) + 1.674');
  sameValues(tree, out);
});

test('removes identities', () => {
  assert.equal(s.toInfix(s.simplifyTree(T('*', '1', T('+', 'x', '0')))), 'x');
  assert.equal(s.toInfix(s.simplifyTree(T('-', 'x', 'x'))), '0');
  assert.equal(s.toInfix(s.simplifyTree(T('/', U('sin', 'x'), U('sin', 'x')))), '1');
  assert.equal(s.toInfix(s.simplifyTree(T('pow', U('cos', 'x'), '1'))), 'cos(x)');
});

test('merges coefficients through products and divisions', () => {
  // 9.667 * (((8.22 * 9.254) * 6.426) * ((x + 5.258) + x))  ->  linear in x
  const tree = T('*', '9.667', T('*', T('*', T('*', '8.22', '9.254'), '6.426'), T('+', T('+', 'x', '5.258'), 'x')));
  const out = s.simplifyTree(tree);
  assert.ok(s.treeSize(out) <= 5, s.toInfix(out));
  sameValues(tree, out);

  const div = T('/', T('*', '4', 'x'), '2');
  assert.equal(s.toInfix(s.simplifyTree(div)), '2 * x');
});

test('simplified random trees compute the same values', () => {
  const ops = Object.keys(s.OP_ARITY);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gen = (d) => {
    if (d === 0 || rand() < 0.25) return rand() < 0.5 ? 'x' : (rand() * 10 - 5).toFixed(3);
    const op = ops[Math.floor(rand() * ops.length)];
    return s.OP_ARITY[op] === 1 ? U(op, gen(d - 1)) : T(op, gen(d - 1), gen(d - 1));
  };
  const pts = [-2, -0.5, 0.25, 1.5, 3].map(x => ({ x }));

  for (let i = 0; i < 500; i++) {
    const tree = gen(5);
    const out = s.simplifyTree(tree, pts);
    for (const p of pts) {
      const a = s.evaluateTree(tree, p.x);
      if (!Number.isFinite(a)) continue;
      const b = s.evaluateTree(out, p.x);
      assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a)), `${s.treeToString(tree)} -> ${s.toInfix(out)}`);
    }
  }
});

// ---------- printing & export ----------

test('infix output uses only necessary parentheses and round-trips as a target', () => {
  const tree = T('-', T('*', '-2', 'x'), T('/', 'x', T('+', 'x', '1')));
  const text = s.toInfix(tree);
  assert.equal(text, '-2 * x - x / (x + 1)');
  const samples = s.generateFormulaSamples(text, -3, 3, 13);
  for (const p of samples) {
    assert.ok(Math.abs(p.y - s.evaluateTree(tree, p.x)) < 1e-9);
  }
});

test('JavaScript export evaluates like the tree', () => {
  const tree = T('+', T('pow', U('sin', 'x'), '2'), T('*', '0.5', U('exp', T('-', '0', 'x'))));
  const code = s.exportProgram(tree, 'js');
  assert.match(code, /^const f = \(x\) => /);
  const f = new Function(`${code}; return f;`)();
  for (const x of [-1, 0, 2.5]) {
    assert.ok(Math.abs(f(x) - s.evaluateTree(tree, x)) < 1e-9);
  }
});

test('Python export uses math functions and ** for powers', () => {
  const tree = T('*', '3', T('pow', U('log', 'x'), T('-', 'x', '1')));
  const code = s.exportProgram(tree, 'python');
  assert.match(code, /import math/);
  assert.match(code, /def f\(x\):\n    return 3 \* math\.log\(x\) \*\* \(x - 1\)/);
});

test('LaTeX export', () => {
  const tree = T('+', T('/', U('sqrt', 'x'), '2'), T('pow', U('sin', 'x'), '2'));
  assert.equal(s.exportProgram(tree, 'latex'), 'y = \\frac{\\sqrt{x}}{2} + {\\left(\\sin\\left(x\\right)\\right)}^{2}');
});

// ---------- formula safety ----------

test('formulas may only use x, numbers, operators and Math', () => {
  assert.doesNotThrow(() => s.compileFormula('Math.sin(x) + pow(x, 2) * PI - abs(x) % 3 + 1e-3'));

  for (const bad of [
    'alert(1)', 'x; fetch("/")', 'constructor', 'Math.constructor', '`x`',
    'x[0]', 'this', 'globalThis', 'x => x', '(0, eval)("x")', 'x.toString()'
  ]) {
    assert.throws(() => s.compileFormula(bad), Error, bad);
  }
});

// ---------- share links ----------

test('share links round-trip settings, data and the model', async () => {
  const model = T('+', '1.5', T('*', '2', U('sin', 'x')));
  const config = {
    targetFormula: 'sin(x)', minX: -3, maxX: 3, sampleCount: 51, populationSize: 150,
    targetR2: 0.995, maxGenerations: 300, operators: ['+', 'sin'], mutationRate: 0.2,
    crossoverRate: 0.8, elitismRate: 0.02, tournamentSize: 4, treeDepth: 3, maxTreeDepth: 7,
    linearScaling: false, dataMode: 'dataset', dataset: [{ x: 1, y: 2 }, { x: 2, y: 5 }]
  };

  const code = await s.encodeShare(s.buildSharePayload({ config, model, r2: 0.97, generation: 12, fileName: 'a.csv' }));
  assert.match(code, /^[zj][A-Za-z0-9_-]+$/);

  const back = await s.decodeShare(code);
  assert.deepEqual(back.model, model);
  assert.equal(back.r2, 0.97);
  assert.equal(back.generation, 12);
  assert.equal(back.fileName, 'a.csv');
  assert.deepEqual(back.config, config);
});

test('large datasets are left out of share links', () => {
  const dataset = Array.from({ length: s.MAX_SHARED_POINTS + 1 }, (_, i) => ({ x: i, y: i }));
  const payload = s.buildSharePayload({ config: { dataMode: 'dataset', dataset }, model: 'x', r2: 1, generation: 1 });
  assert.equal(payload.datasetOmitted, true);
  assert.equal(payload.config.dataset, undefined);
});

test('share links drop unknown fields and invalid values', async () => {
  const evil = {
    v: 1,
    config: { targetFormula: 'x', populationSize: 'NaN', operators: ['+', 'eval'], dataset: [[1, 2], [3, 'x'], 'bad'], extra: 1 },
    model: ['eval', 'x'],
    __proto__x: 1
  };
  const code = 'j' + Buffer.from(JSON.stringify(evil)).toString('base64url');
  const back = await s.decodeShare(code);

  assert.deepEqual(back.config, { targetFormula: 'x', operators: ['+'], dataset: [{ x: 1, y: 2 }] });
  assert.equal(back.model, undefined);
});

test('broken share links are rejected', async () => {
  await assert.rejects(s.decodeShare('q123'));
  await assert.rejects(s.decodeShare('jnot-json'));
});

test('normalizeConfig fills Phase 2 settings for older sessions', () => {
  const c = s.normalizeConfig({ treeDepth: 6 });
  assert.equal(c.maxTreeDepth, 12);
  assert.equal(c.linearScaling, true);
});

test('merges powers and reciprocal terms', () => {
  // 0.5 * pow(x, 2) * x  ->  0.5 * pow(x, 3)
  const cube = T('*', T('*', '0.5', T('pow', 'x', '2')), 'x');
  assert.equal(s.toInfix(s.simplifyTree(cube)), '0.5 * pow(x, 3)');

  // (2 * 0.5) / x + (3 * 2) / x  ->  7 / x
  const recip = T('+', T('/', T('*', '2', '0.5'), 'x'), T('/', T('*', '3', '2'), 'x'));
  const out = s.simplifyTree(recip);
  assert.equal(s.toInfix(out), '7 / x');
  assert.equal(s.toLatex(out), '\\frac{7}{x}');
  sameValues(recip, out);

  // x * pow(x, -1)  ->  1
  assert.equal(s.toInfix(s.simplifyTree(T('*', 'x', T('pow', 'x', '-1')))), '1');
});
