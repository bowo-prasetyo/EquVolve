// Benchmark: how often does the engine reach R² >= 0.999 within 200
// generations on a fixed set of targets? Prints a Markdown table.
//
//   npm run bench            # 20 runs per target
//   node bench/benchmark.js 5
//
// Uses the real worker.js (via test/helpers.js) and the app's default
// settings, so results reflect what users get.
const { loadWorker, baseConfig } = require('../test/helpers');
const { toInfix } = require('../shared.js');

const RUNS = Number(process.argv[2] || 20);
const GENERATIONS = 200;

const TARGETS = [
  ['x*x*x - 2*x + 1', ['+', '-', '*']],
  ['3*x*x + 2', ['+', '-', '*']],
  ['x*x + 2/x', ['+', '-', '*', '/']],
  ['exp(-x*x/2)', ['+', '-', '*', '/', 'exp']],
  ['sin(x) + sin(x*x)', ['+', '-', '*', '/', 'sin', 'cos']],
  ['sin(x) * exp(x/3)', ['+', '-', '*', '/', 'sin', 'exp']]
];

const SETTINGS = {
  minX: -3,
  maxX: 3,
  sampleCount: 101,
  populationSize: 200,
  targetR2: 0.999,
  maxGenerations: GENERATIONS,
  mutationRate: 0.2,
  crossoverRate: 0.8,
  elitismRate: 0.02,
  tournamentSize: 5,
  treeDepth: 4,
  maxTreeDepth: 8,
  linearScaling: true
};

console.log(`| Target | Operators | Reached R² ≥ 0.999 | Median generations (when reached) | Example result |`);
console.log(`| --- | --- | --- | --- | --- |`);

for (const [formula, operators] of TARGETS) {
  const reached = [];
  let example = null;

  for (let i = 0; i < RUNS; i++) {
    const w = loadWorker();
    w.send({ type: 'start', config: baseConfig({ ...SETTINGS, targetFormula: formula, operators }) });
    w.tick(GENERATIONS + 5);

    const done = w.finished()[0];

    if (done.reason === 'targetReached') {
      reached.push(done.generation);
      if (!example) example = toInfix(done.model);
    }
  }

  reached.sort((a, b) => a - b);
  const median = reached.length ? reached[Math.floor(reached.length / 2)] : '–';

  console.log(`| \`${formula}\` | \`${operators.join(' ')}\` | ${reached.length} / ${RUNS} | ${median} | ${example ? '`' + example + '`' : '–'} |`);
}
