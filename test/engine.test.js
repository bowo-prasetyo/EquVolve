const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWorker, baseConfig } = require('./helpers');

for (const size of [5, 10, 100, 250, 500]) {
  test(`population stays exactly ${size} across generations`, () => {
    const w = loadWorker();
    w.send({ type: 'start', config: baseConfig({ populationSize: size }) });
    w.tick(39);

    const sizes = w.updates().map(u => u.population.length);
    assert.equal(sizes.length, 40);
    assert.ok(sizes.every(s => s === size), `sizes: ${[...new Set(sizes)]}`);
  });
}

test('small populations still evolve (fit improves over random)', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ populationSize: 10, targetFormula: '3*x + 1' }) });
  w.tick(199);

  const r2 = w.updates().at(-1).r2;
  assert.ok(r2 > 0.5, `R² after 200 generations with P=10 was ${r2}`);
});

test('stops when target R² is reached and reports the reason', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ targetR2: 0.99, populationSize: 200 }) });
  w.tick(500);

  const [done] = w.finished();
  assert.ok(done, 'expected a finished message');
  assert.equal(done.reason, 'targetReached');
  assert.ok(done.r2 >= 0.99);
  assert.equal(w.pendingTimers(), 0);
});

test('stops at max generations and reports the reason', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ maxGenerations: 5 }) });
  w.tick(20);

  const fin = w.finished();
  assert.equal(fin.length, 1);
  assert.equal(fin[0].reason, 'maxGenerations');
  assert.equal(fin[0].generation, 5);
});

test('resume after max generations reports finished instead of hanging', () => {
  const w = loadWorker();
  const config = baseConfig({ maxGenerations: 3 });
  w.send({ type: 'start', config });
  w.tick(10);

  w.send({ type: 'resume', config });
  const fin = w.finished();
  assert.equal(fin.length, 2);
  assert.equal(fin[1].reason, 'maxGenerations');

  // raising the limit lets the run continue from where it was
  w.send({ type: 'resume', config: { ...config, maxGenerations: 6 } });
  w.tick(10);
  assert.equal(w.results().at(-1).generation, 6);
});

test('quick stop -> resume never runs two loops at once', () => {
  const w = loadWorker();
  const config = baseConfig();
  w.send({ type: 'start', config });
  w.send({ type: 'stop' });
  w.send({ type: 'resume', config });
  assert.equal(w.pendingTimers(), 1);

  const before = w.updates().length;
  w.tick(1);
  assert.equal(w.updates().length, before + 1);
});

test('formula mode trains on the same evenly spaced grid the UI plots', () => {
  const w = loadWorker();
  w.send({ type: 'start', config: baseConfig({ sampleCount: 21, minX: 0, maxX: 1 }) });

  const pts = w.read('points');
  assert.equal(pts.length, 21);
  assert.equal(pts[0].x, 0);
  assert.equal(pts[20].x, 1);
  assert.ok(Math.abs(pts[1].x - 0.05) < 1e-12);
});

test('dataset mode trains on the uploaded points', () => {
  const w = loadWorker();
  const dataset = Array.from({ length: 30 }, (_, i) => ({ x: i, y: 2 * i + 1 }));
  w.send({ type: 'start', config: baseConfig({ dataMode: 'dataset', dataset, targetR2: 0.999 }) });
  w.tick(300);

  assert.equal(w.read('points').length, 30);
  assert.ok(w.results().at(-1).r2 > 0.99);
});

test('restore keeps the generation, waits for resume, and old minError configs still work', () => {
  const w = loadWorker();
  const { targetR2, ...legacy } = baseConfig({ populationSize: 50 });
  legacy.minError = 0.05;
  delete legacy.sampleCount;

  w.send({
    type: 'restore',
    state: { generation: 42, population: ['x', { op: '+', left: 'x', right: '1.000' }], config: legacy }
  });

  const restored = w.messages.find(m => m.type === 'restored');
  assert.equal(restored.generation, 42);
  assert.equal(restored.populationSize, 50);
  assert.equal(w.pendingTimers(), 0);
  assert.ok(Math.abs(w.read('targetR2') - 0.95) < 1e-12);

  w.send({ type: 'resume', config: baseConfig({ populationSize: 50 }) });
  w.tick(1);
  assert.equal(w.updates().at(-1).generation, 44);
});
