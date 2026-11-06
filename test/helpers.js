// Loads worker.js inside a Node vm context that mimics a Web Worker:
// importScripts, postMessage and onmessage. Timers are manual so tests
// step generations deterministically.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function loadWorker() {
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
