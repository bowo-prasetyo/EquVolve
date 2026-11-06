const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../shared.js');

const T = (op, left, right) => ({ op, left, right });

test('variables evaluate from a number (x) or from named values', () => {
  const tree = T('+', T('*', '2', 'a'), 'b');
  assert.equal(s.evaluateTree(tree, { a: 3, b: 1 }), 7);
  assert.equal(s.evaluateTree(T('*', 'x', 'x'), 4), 16);
  assert.ok(s.isVariable('weight_kg'));
  assert.ok(!s.isVariable('-2.5'));
  assert.ok(!s.isVariable('1e-3'));
});

test('CSV headers become safe, unique variable names', () => {
  assert.deepEqual(
    s.variableNames(['Years of experience', 'age (yrs)', 'sin', 'class', '2nd', '', 'age (yrs)']),
    ['Years_of_experience', 'age_yrs', 'v_sin', 'v_class', 'v_2nd', 'x6', 'age_yrs_2']
  );
});

test('parseCsv reads headers, skips bad rows, and accepts ; or tab separators', () => {
  const t = s.parseCsv('a,b,"c",y\n1,2,3,4\n5,x,6,7\n\n8;9;10;11\n12\t13\t14\t15\n');
  assert.deepEqual(t.headers, ['a', 'b', 'c', 'y']);
  assert.deepEqual(t.rows, [[1, 2, 3, 4], [8, 9, 10, 11], [12, 13, 14, 15]]);

  const noHeader = s.parseCsv('1,2\n3,4\n');
  assert.deepEqual(noHeader.headers, ['x1', 'y']);
  assert.equal(noHeader.rows.length, 2);
});

test('parseCsv skips rows with empty cells instead of reading them as 0', () => {
  const t = s.parseCsv('a,b,y\n1.5,,3\n1,2,3\n4, ,6\n"",5,6\n7,8,\n9,10,11,\n');
  // only the complete rows are kept; a trailing separator past the
  // header's width is still ignored
  assert.deepEqual(t.rows, [[1, 2, 3], [9, 10, 11]]);
});

test('datasetFromTable: one input keeps x, several inputs keep their names', () => {
  const single = s.datasetFromTable({ headers: ['YearsExperience', 'Salary'], rows: [[1, 10], [2, 20]] });
  assert.deepEqual(single.variables, ['x']);
  assert.deepEqual(single.dataset, [{ x: 1, y: 10 }, { x: 2, y: 20 }]);

  const multi = s.datasetFromTable({ headers: ['a', 'price', 'b'], rows: [[1, 9, 2]] }, 1);
  assert.deepEqual(multi.variables, ['a', 'b']);
  assert.deepEqual(multi.dataset, [{ v: { a: 1, b: 2 }, y: 9 }]);
});

test('exports name the function parameters after the variables', () => {
  const tree = T('+', T('*', '2', 'height'), T('pow', 'width', '2'));
  const js = s.exportProgram(tree, 'js', ['height', 'width']);
  assert.equal(js, 'const f = (height, width) => 2 * height + Math.pow(width, 2);');
  const f = new Function(`${js}; return f;`)();
  assert.equal(f(3, 4), 22);

  assert.match(s.exportProgram(tree, 'python', ['height', 'width']), /def f\(height, width\):\n    return 2 \* height \+ width \*\* 2/);
  assert.equal(s.exportProgram(tree, 'latex', ['height', 'width']), 'y = 2 \\cdot \\mathit{height} + {\\mathit{width}}^{2}');
});

test('simplification works with several variables', () => {
  const tree = T('+', T('*', 'a', 'b'), T('-', T('*', 'b', 'a'), T('*', '0', 'c')));
  const out = s.simplifyTree(tree, [{ v: { a: 1, b: 2, c: 3 }, y: 0 }, { v: { a: -1, b: 0.5, c: 1 }, y: 0 }]);
  assert.ok(s.treeSize(out) < s.treeSize(tree), s.toInfix(out));
  for (const v of [{ a: 1, b: 2, c: 3 }, { a: -2, b: 0.3, c: 9 }]) {
    assert.ok(Math.abs(s.evaluateTree(out, v) - s.evaluateTree(tree, v)) < 1e-12);
  }
});

test('validateConfig checks multi-variable datasets', () => {
  const base = {
    populationSize: 100, maxGenerations: 10, targetR2: 0.99, mutationRate: 0.1,
    crossoverRate: 0.7, elitismRate: 0.05, tournamentSize: 5, treeDepth: 4,
    operators: ['+'], dataMode: 'dataset'
  };
  const good = { ...base, variables: ['a', 'b'], dataset: [{ v: { a: 1, b: 2 }, y: 1 }, { v: { a: 2, b: 1 }, y: 3 }] };
  assert.deepEqual(s.validateConfig(good), []);

  const missing = { ...good, dataset: [{ v: { a: 1 }, y: 1 }, { v: { a: 2, b: 1 }, y: 3 }] };
  assert.ok(s.validateConfig(missing).some(e => /numeric value for each input/.test(e)));

  const tooMany = { ...good, variables: Array.from({ length: 11 }, (_, i) => `v${i}`) };
  assert.ok(s.validateConfig(tooMany).some(e => /input columns/.test(e)));
});

test('share links carry multi-variable data and reject models with unknown variables', async () => {
  const config = {
    targetFormula: 'x', dataMode: 'dataset', variables: ['a', 'b'],
    dataset: [{ v: { a: 1, b: 2 }, y: 3 }, { v: { a: 4, b: 5 }, y: 6 }]
  };
  const model = T('+', 'a', 'b');

  const back = await s.decodeShare(await s.encodeShare(s.buildSharePayload({ config, model, r2: 1, generation: 3 })));
  assert.deepEqual(back.config.variables, ['a', 'b']);
  assert.deepEqual(back.config.dataset, config.dataset);
  assert.deepEqual(back.model, model);

  const evil = await s.decodeShare(await s.encodeShare(s.buildSharePayload({ config, model: T('+', 'a', 'constructor'), r2: 1, generation: 1 })));
  assert.equal(evil.model, undefined);
});

test('normalizeConfig: formula mode always uses x; new settings get defaults', () => {
  const c = s.normalizeConfig({ dataMode: 'formula', variables: ['a', 'b'] });
  assert.deepEqual(c.variables, ['x']);
  assert.equal(c.constantOptimization, false);
  assert.deepEqual(s.normalizeConfig({ dataMode: 'dataset', variables: ['a', 'b'] }).variables, ['a', 'b']);
});

test('factors cancel across divisions', () => {
  const tree = T('*', T('*', '2.0006', T('/', 'depth', 'width')), 'width');
  assert.equal(s.toInfix(s.simplifyTree(tree)), '2.0006 * depth');

  const q = T('/', T('*', 'a', T('*', 'b', 'b')), T('*', '4', 'b'));
  const out = s.simplifyTree(q);
  assert.equal(s.toInfix(out), '0.25 * a * b');

  assert.equal(s.toInfix(s.simplifyTree(T('/', 'x', T('*', 'x', 'x')))), '1 / x');
  assert.equal(s.toInfix(s.simplifyTree(T('/', '3', T('*', '2', 'x')))), '1.5 / x');
  assert.equal(s.toInfix(s.simplifyTree(T('/', 'x', '0'))), 'x / 0');
});
