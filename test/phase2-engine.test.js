const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWorker, baseConfig } = require('./helpers');
const shared = require('../shared.js');

function allTreesValid(population) {
  return population.every(t => shared.isValidTree(t));
}

test('evolved trees never exceed Max Tree Depth', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({
      treeDepth: 3,
      maxTreeDepth: 5,
      targetFormula: 'sin(x) * exp(x/3)',
      operators: ['+', '-', '*', '/', 'sin', 'exp']
    })
  });
  w.tick(59);

  for (const u of w.updates()) {
    const depths = u.population.map(shared.treeDepth);
    assert.ok(Math.max(...depths) <= 5, `generation ${u.generation}: max depth ${Math.max(...depths)}`);
  }
});

test('crossover and mutation keep every tree well-formed (unary ops keep one child)', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({ operators: Object.keys(shared.OP_ARITY), targetFormula: 'sin(x) + x' })
  });
  w.tick(39);

  for (const u of w.updates()) {
    assert.ok(allTreesValid(u.population), `invalid tree in generation ${u.generation}`);
  }
});

test('initial population is ramped: varied depths and sizes', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ treeDepth: 5, maxGenerations: 1 }) });

  const pop = w.updates()[0].population;
  const depths = new Set(pop.map(shared.treeDepth));
  assert.ok(depths.size >= 3, `only depths ${[...depths]}`);
});

test('linear scaling: an affine transform of x*x is solved in the first generation', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({ targetFormula: '37.5 * x*x - 1234', targetR2: 0.999999, populationSize: 200 })
  });
  w.tick(20);

  const [done] = w.finished();
  assert.equal(done.reason, 'targetReached');
  assert.ok(done.generation <= 3, `took ${done.generation} generations`);
});

test('the reported model reproduces the reported R² on the training data', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({ targetFormula: '3*x*x*x - x + 7', maxGenerations: 30 })
  });
  w.tick(40);

  const last = w.finished()[0];
  const pts = w.read('points');
  const mean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let ssTot = 0;
  let ssRes = 0;

  for (const p of pts) {
    ssTot += (p.y - mean) ** 2;
    ssRes += (p.y - shared.evaluateTree(last.model, p.x)) ** 2;
  }

  assert.ok(Math.abs((1 - ssRes / ssTot) - last.r2) < 1e-6, `model R² ${1 - ssRes / ssTot} vs reported ${last.r2}`);
});

test('without linear scaling the raw program is the model', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({ linearScaling: false, maxGenerations: 3 })
  });
  w.tick(5);

  const last = w.finished()[0];
  const pts = w.read('points');
  for (const p of pts.slice(0, 10)) {
    const a = shared.evaluateTree(last.best, p.x);
    const b = shared.evaluateTree(last.model, p.x);
    assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a)));
  }
});

test('updates report the median R², program size and a model', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ maxGenerations: 2 }) });
  w.tick(3);

  const u = w.updates()[0];
  assert.equal(typeof u.medianR2, 'number');
  assert.ok(u.medianR2 <= u.r2);
  assert.equal(u.size, shared.treeSize(u.model));
  assert.ok(shared.isValidTree(u.model));
});
