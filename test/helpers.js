// Loads worker.js inside a Node vm context that mimics a Web Worker:
// importScripts, postMessage and onmessage. Timers are manual so tests
// step generations deterministically.
//
// The engine's Math.random is seeded, so every engine test sees the same
// "random" run each time and cannot fail by bad luck. Set GP_TEST_SEED
// to try another seed, or to "random" for unseeded runs:
//
//   GP_TEST_SEED=42 npm test
//   GP_TEST_SEED=random npm test
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

const DEFAULT_SEED = 1;

function defaultSeed() {
  const env = process.env.GP_TEST_SEED;

  if (env === undefined || env === '') return DEFAULT_SEED;
  if (env === 'random') return null;

  const seed = Number(env);

  if (!Number.isInteger(seed)) {
    throw new Error(`GP_TEST_SEED must be an integer or "random", got "${env}"`);
  }

  return seed;
}

// mulberry32: a small, fast 32-bit PRNG with a uniform output in [0, 1),
// installed as the context's own Math.random (the host's is untouched).
const SEEDED_RANDOM = `
  (function (seed) {
    let a = seed >>> 0;
    Math.random = function random() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })
`;

// options.seed: an integer seeds Math.random (default: GP_TEST_SEED, else
// 1); null leaves it truly random, as the benchmark needs.
function loadWorker({ seed = defaultSeed() } = {}) {
  const messages = [];
  const timers = [];

  const context = {
    console,
    postMessage: (m) => messages.push(m),
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: (id) => { if (id) timers[id - 1] = null; }
  };

  context.importScripts = (...files) => {
    for (const f of files) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context, { filename: f });
    }
  };

  vm.createContext(context);

  if (seed !== null) {
    vm.runInContext(SEEDED_RANDOM, context)(seed);
  }

  vm.runInContext(fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8'), context, { filename: 'worker.js' });

  return {
    context,
    messages,
    send: (data) => context.onmessage({ data }),
    // read a top-level binding inside the worker
    read: (name) => vm.runInContext(name, context),
    // run pending timer callbacks (one generation each)
    tick(n = 1) {
      for (let i = 0; i < n; i++) {
        const idx = timers.findIndex(Boolean);
        if (idx === -1) return false;
        const fn = timers[idx];
        timers[idx] = null;
        fn();
      }
      return true;
    },
    pendingTimers: () => timers.filter(Boolean).length,
    updates: () => messages.filter(m => m.type === 'update'),
    finished: () => messages.filter(m => m.type === 'finished'),
    // every message describing a generation (the last one of a run
    // arrives as 'finished' rather than 'update')
    results: () => messages.filter(m => m.type === 'update' || m.type === 'finished')
  };
}

function baseConfig(overrides = {}) {
  return {
    targetFormula: 'x*x + 2',
    minX: -5,
    maxX: 5,
    sampleCount: 101,
    populationSize: 100,
    targetR2: 2, // unreachable: run until maxGenerations unless overridden
    maxGenerations: 1000,
    operators: ['+', '-', '*'],
    mutationRate: 0.1,
    crossoverRate: 0.7,
    elitismRate: 0.05,
    tournamentSize: 5,
    treeDepth: 4,
    dataMode: 'formula',
    dataset: [],
    // one generation per timer tick, population in every update, so
    // tests can step generation by generation
    batchMs: 0,
    delayMs: 0,
    populationEvery: 1,
    ...overrides
  };
}

module.exports = { loadWorker, baseConfig };
