const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWorker, baseConfig } = require('./helpers');
const shared = require('../shared.js');

// ---------- batching ----------

test('a fast batch runs many generations and reports every one of them', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({ batchMs: 60000, targetR2: 2, maxGenerations: 25, populationSize: 50 })
  });

  // one timer tick is not even needed: the first batch runs to the end
  const results = w.results();
  assert.equal(results.length, 1);
  assert.equal(results[0].type, 'finished');

  const gens = Array.from(results[0].progress, p => p[0]);
  assert.deepEqual(gens, Array.from({ length: 25 }, (_, i) => i + 1));
});

test('progress is continuous across updates', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ targetR2: 2, maxGenerations: 30 }) });
  w.tick(40);

  const gens = w.results().flatMap(m => m.progress.map(p => p[0]));
  assert.deepEqual(gens, Array.from({ length: 30 }, (_, i) => i + 1));
});

test('the population is sent every 10 generations, and always on finish', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ populationEvery: undefined, targetR2: 2, maxGenerations: 25 }) });
  w.tick(30);

  const withPop = w.results().filter(m => m.population).map(m => m.generation);
  assert.deepEqual(withPop, [1, 11, 21, 25]);
});

test('stop sends the exact population to checkpoint', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ targetR2: 2 }) });
  w.tick(4);
  w.send({ type: 'stop' });

  const stopped = w.messages.filter(m => m.type === 'stopped');
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0].generation, 5);
  assert.equal(stopped[0].population.length, 100);
  assert.equal(w.pendingTimers(), 0);
});

test('slow speed reports one generation per update', () => {
  const w = loadWorker();
  const { batchMs, delayMs, ...config } = baseConfig({ speed: 'slow', targetR2: 2, maxGenerations: 5 });
  w.send({ type: 'start', config });
  w.tick(10);

  for (const m of w.results()) {
    assert.equal(m.progress.length, 1);
  }
});

// ---------- replay timeline ----------

test('the timeline records each new best program, never getting worse', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({ targetFormula: 'sin(x) * exp(x/3)', operators: ['+', '-', '*', '/', 'sin', 'exp'], targetR2: 2, maxGenerations: 40 })
  });
  w.tick(50);

  const timeline = w.results().flatMap(m => m.timeline);
  assert.ok(timeline.length >= 1);
  assert.equal(timeline[0].g, 1);

  for (let i = 1; i < timeline.length; i++) {
    assert.ok(timeline[i].g > timeline[i - 1].g);
    // fitness (1 - R² plus a small size penalty) never gets worse; R²
    // alone may dip slightly when a much smaller program takes over
    assert.ok(timeline[i].fitness <= timeline[i - 1].fitness + 1e-12, `fitness rose at generation ${timeline[i].g}`);
    assert.ok(shared.isValidTree(timeline[i].model));
  }
});

// ---------- constant optimisation ----------

function configuredWorker(overrides) {
  const w = loadWorker();
  w.send({ type: 'restore', state: { generation: 0, population: [], config: baseConfig(overrides) } });
  return w;
}

test('constant optimisation tunes a constant inside a non-linear function', () => {
  const w = configuredWorker({ targetFormula: 'exp(0.37 * x)', linearScaling: false });
  const tree = { op: 'exp', child: { op: '*', left: '0.9', right: 'x' } };

  const before = w.context.fitness(tree).totalFitness;
  const after = w.context.optimizeConstants(tree, 200);
  const k = Number(after.child.left);

  assert.ok(w.context.fitness(after).totalFitness < before);
  assert.ok(Math.abs(k - 0.37) < 0.01, `constant ended at ${k}`);
});

test('constant optimisation never makes a program worse and leaves constant-free programs alone', () => {
  const w = configuredWorker({ targetFormula: 'x*x + 2' });
  const tree = { op: '*', left: 'x', right: 'x' };
  assert.equal(w.context.optimizeConstants(tree, 50), tree);

  const t2 = { op: '+', left: { op: '*', left: 'x', right: 'x' }, right: '2.000' };
  const opt = w.context.optimizeConstants(t2, 50);
  assert.ok(w.context.fitness(opt).totalFitness <= w.context.fitness(t2).totalFitness);
});

test('with constant optimisation off, runs still work', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ constantOptimization: false, targetR2: 0.99 }) });
  w.tick(200);
  assert.equal(w.finished()[0].reason, 'targetReached');
});

// ---------- multi-variable ----------

function multiDataset(n = 60) {
  const rows = [];
  let seed = 3;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const a = rand() * 4 - 2;
    const b = rand() * 4 - 2;
    const c = rand() * 4 - 2;
    rows.push({ v: { a, b, c }, y: 2 * a + 3 * b * b - c });
  }
  return rows;
}

test('multi-variable data: finds y = 2a + 3b² − c using only the given variables', () => {
  const w = loadWorker();
  w.send({
    type: 'start',
    config: baseConfig({
      dataMode: 'dataset',
      variables: ['a', 'b', 'c'],
      dataset: multiDataset(),
      targetR2: 0.9999,
      populationSize: 300,
      maxGenerations: 300
    })
  });
  w.tick(310);

  const done = w.finished()[0];
  assert.equal(done.reason, 'targetReached', `stopped at R² ${done.r2}`);

  const used = shared.treeVariables(done.model);
  assert.ok([...used].every(v => ['a', 'b', 'c'].includes(v)), [...used].join());
  assert.ok(shared.isValidTree(done.model, ['a', 'b', 'c']));

  for (const m of w.results().filter(r => r.population)) {
    for (const t of m.population) {
      assert.ok(shared.isValidTree(t, ['a', 'b', 'c']));
    }
  }
});
