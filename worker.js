// Genetic Programming evolution engine (runs inside a Web Worker).
// Shared helpers from shared.js: OP_ARITY, generateFormulaSamples,
// evaluateTree, pointInput, isConstant, treeSize, treeDepth,
// treeToString, scaledTree, simplifyTree, normalizeConfig.
importScripts('shared.js');

const IMMIGRANT_RATE = 0.1;
const COMPLEXITY_PENALTY = 0.001;

// Speed: "fast" runs as many generations as fit in BATCH_MS before
// sending one update; "slow" sends every generation with a pause, for
// watching evolution step by step.
const SPEEDS = {
  fast: { batchMs: 40, delayMs: 5 },
  slow: { batchMs: 0, delayMs: 150 }
};

// The full population is only needed for checkpoints, so it is sent
// every POPULATION_EVERY generations (and on stop and finish).
const POPULATION_EVERY = 10;

// Constant optimisation: a short (1+1) evolution strategy on the
// constants of the best few programs every generation.
const CONSTANT_OPT_PROGRAMS = 3;
const CONSTANT_OPT_STEPS = 20;

// Koza's rule: pick an internal node as a crossover point 90% of the
// time, so crossover moves meaningful structure instead of leaves.
const INTERNAL_NODE_BIAS = 0.9;

// Crossover attempts before giving up and returning the first parent
// (attempts fail when the child would exceed the max depth).
const CROSSOVER_ATTEMPTS = 5;

const FITNESS_CACHE_LIMIT = 50000;

const DEFAULT_OPERATORS = [
  { symbol: '+', arity: 2 },
  { symbol: '-', arity: 2 },
  { symbol: '*', arity: 2 }
];

let OPERATORS = DEFAULT_OPERATORS;
let targetFormula = 'x*x + 2';
let targetR2 = 0.99;
let maxGenerations = 1000;
let populationSize = 100;
let minX = -5;
let maxX = 5;
let sampleCount = DEFAULT_SAMPLE_COUNT;
let mutationRate = 0.1;
let crossoverRate = 0.7;
let elitismRate = 0.05;
let tournamentSize = 5;
let initDepth = 4;   // depth of randomly generated trees
let maxDepth = 8;    // hard limit for evolved trees
let linearScaling = true;
let constantOptimization = true;
let variables = ['x'];
let dataMode = 'formula';
let dataset = [];
let batchMs = SPEEDS.fast.batchMs;
let delayMs = SPEEDS.fast.delayMs;
let populationEvery = POPULATION_EVERY;
let constOpt = { mode: 'top', programs: CONSTANT_OPT_PROGRAMS, steps: CONSTANT_OPT_STEPS, rate: 0.1 };

// Training points, computed once per config (not once per evaluation).
let points = [];
let meanY = 0;
let ssTot = 0;

let population = [];
let running = false;
let generation = 0;
let loopTimer = null;

// Per-generation results gathered during a batch, sent with the next
// update: progress points, and timeline entries (the best program each
// time it changes) for the replay.
let pendingProgress = [];
let pendingTimeline = [];
let lastBestKey = null;
let lastPopulationSent = -Infinity;
let current = null; // { best, result, medianR2 } of the latest generation

// Keyed by tree structure. Kept across generations (elites and clones
// are not re-evaluated) and cleared whenever the training data changes.
const fitnessCache = new Map();

function getFitness(node) {
  const key = treeToString(node);

  let f = fitnessCache.get(key);

  if (f === undefined) {
    if (fitnessCache.size >= FITNESS_CACHE_LIMIT) {
      fitnessCache.clear();
    }

    f = fitness(node);
    fitnessCache.set(key, f);
  }

  return f;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// =========================================================
// TREE GENERATION
// =========================================================

function randomConstant() {
  return (Math.random() * 20 - 10).toFixed(3);
}

function randomTerminal() {
  return Math.random() < 0.5 ?
    variables[randomInt(variables.length)] :
    randomConstant();
}

function randomOperator(arity = null) {
  const pool = arity === null ?
    OPERATORS :
    OPERATORS.filter(op => op.arity === arity);

  return pool.length ? pool[randomInt(pool.length)] : null;
}

// "full" fills every branch to exactly `depth`; "grow" may stop early.
function generateTree(depth, method = 'grow') {

  if (depth <= 0 || (method === 'grow' && Math.random() < 0.3)) {
    return randomTerminal();
  }

  const op = randomOperator();

  if (op.arity === 1) {
    return { op: op.symbol, child: generateTree(depth - 1, method) };
  }

  return {
    op: op.symbol,
    left: generateTree(depth - 1, method),
    right: generateTree(depth - 1, method)
  };
}

// Ramped half-and-half: depths 2..initDepth, half "full", half "grow",
// so the first generation covers many shapes and sizes.
function initPopulation(size) {
  population = [];
  generation = 0;

  const minD = Math.min(2, initDepth);
  const span = initDepth - minD + 1;

  for (let i = 0; i < size; i++) {
    const depth = minD + (Math.floor(i / 2) % span);
    population.push(generateTree(depth, i % 2 === 0 ? 'full' : 'grow'));
  }
}

function randomImmigrant() {
  return generateTree(initDepth, Math.random() < 0.5 ? 'full' : 'grow');
}

// =========================================================
// FITNESS
// =========================================================

function buildPoints() {

  let pts;

  if (dataMode === 'dataset') {
    pts = dataset.filter(p =>
      Number.isFinite(p.y) &&
      (p.v ? variables.every(n => Number.isFinite(p.v[n])) : Number.isFinite(p.x))
    );
  } else {
    try {
      pts = generateFormulaSamples(targetFormula, minX, maxX, sampleCount);
    } catch (e) {
      pts = [];
    }
  }

  // the evaluation input, resolved once
  for (const p of pts) {
    p.in = pointInput(p);
  }

  return pts;
}

// R² of the program on the training points. With linear scaling the
// program is scored as a + b*f(x) with the least-squares a and b, so
// R² measures how well the program captures the *shape* of the data.
function fitness(program) {

  const invalid = {
    rawError: Infinity,
    r2: -Infinity,
    totalFitness: Infinity,
    a: 0,
    b: 1
  };

  const n = points.length;

  if (n === 0 || ssTot === 0) {
    return invalid;
  }

  const preds = new Array(n);
  let meanF = 0;

  for (let i = 0; i < n; i++) {
    const v = evaluateTree(program, points[i].in);

    if (!Number.isFinite(v)) {
      return invalid;
    }

    preds[i] = v;
    meanF += v;
  }

  meanF /= n;

  let a = 0;
  let b = 1;

  if (linearScaling) {
    let cov = 0;
    let varF = 0;

    for (let i = 0; i < n; i++) {
      const df = preds[i] - meanF;
      cov += df * (points[i].y - meanY);
      varF += df * df;
    }

    // A (numerically) constant program can only predict the mean.
    if (varF > 1e-12 * Math.max(1, meanF * meanF) * n) {
      b = cov / varF;
      a = meanY - b * meanF;
    } else {
      b = 0;
      a = meanY;
    }
  }

  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const r = points[i].y - (a + b * preds[i]);
    ssRes += r * r;
  }

  if (!Number.isFinite(ssRes)) {
    return invalid;
  }

  const r2 = 1 - ssRes / ssTot;
  const error = 1 - r2;

  return {
    rawError: error,
    r2,
    totalFitness: error + treeSize(program) * COMPLEXITY_PENALTY,
    a,
    b
  };
}

// The program as it is actually used: wrapped in a + b*f(x) when
// linear scaling is on, then simplified for display and export.
function modelOf(program) {
  const f = getFitness(program);

  let model = program;

  if (linearScaling && Number.isFinite(f.totalFitness)) {
    // Drop floating-point noise such as "+ 5.6e-17" or "* 0.9999999999".
    const scale = Math.abs(meanY) + Math.sqrt(ssTot / points.length);
    const a = Math.abs(f.a) <= 1e-9 * scale ? 0 : f.a;
    const rb = Math.round(f.b);
    const b = rb !== 0 && Math.abs(f.b - rb) <= 1e-9 * Math.abs(f.b) ? rb : f.b;

    model = scaledTree(program, a, b);
  }

  return simplifyTree(model, points);
}

// =========================================================
// SELECTION & VARIATION
// =========================================================

function tournamentSelection(pop, size = 5) {
  let best = null;
  let bestScore = Infinity;

  for (let i = 0; i < size; i++) {
    const candidate = pop[randomInt(pop.length)];
    const score = getFitness(candidate).totalFitness;

    if (best === null || score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

// Every node with a way to replace it: {node, depth, set(newNode)}.
function listNodes(root) {
  const out = [];
  const holder = { root };

  const walk = (parent, key, depth) => {
    const node = parent[key];

    out.push({
      node,
      depth,
      set: (n) => { parent[key] = n; }
    });

    if (typeof node === 'string') return;

    if (node.child !== undefined) {
      walk(node, 'child', depth + 1);
    } else {
      walk(node, 'left', depth + 1);
      walk(node, 'right', depth + 1);
    }
  };

  walk(holder, 'root', 0);

  return { holder, nodes: out };
}

function pickNode(nodes) {
  const internal = nodes.filter(n => typeof n.node !== 'string');
  const leaves = nodes.filter(n => typeof n.node === 'string');

  if (internal.length && (Math.random() < INTERNAL_NODE_BIAS || !leaves.length)) {
    return internal[randomInt(internal.length)];
  }

  return leaves[randomInt(leaves.length)];
}

// Standard subtree crossover: replace a random subtree of A with a
// random subtree of B, rejecting children deeper than maxDepth.
function crossover(a, b) {

  for (let attempt = 0; attempt < CROSSOVER_ATTEMPTS; attempt++) {
    const { holder, nodes } = listNodes(clone(a));
    const target = pickNode(nodes);
    const donor = pickNode(listNodes(b).nodes);

    if (target.depth + treeDepth(donor.node) > maxDepth) {
      continue;
    }

    target.set(clone(donor.node));

    return holder.root;
  }

  return clone(a);
}

// Replace a random subtree with a new random one (never deeper than
// maxDepth overall).
function subtreeMutation(tree) {
  const { holder, nodes } = listNodes(clone(tree));
  const target = nodes[randomInt(nodes.length)];
  const room = Math.min(initDepth, maxDepth - target.depth);

  target.set(generateTree(Math.max(0, room), 'grow'));

  return holder.root;
}

// Change one node in place: an operator to another of the same arity,
// a constant by a small step, or a terminal to another terminal.
function pointMutation(tree) {
  const { holder, nodes } = listNodes(clone(tree));
  const target = nodes[randomInt(nodes.length)];
  const node = target.node;

  if (typeof node === 'string') {
    if (isConstant(node) && Math.random() < 0.7) {
      // multi-scale step (coarse, medium or fine) so constants can be
      // both moved far and fine-tuned
      const c = Number(node);
      const scale = Math.max(1, Math.abs(c)) * Math.pow(10, -randomInt(3));
      const step = (Math.random() * 2 - 1) * scale;
      target.set(String(Number((c + step).toPrecision(6))));
    } else {
      target.set(randomTerminal());
    }

    return holder.root;
  }

  const op = randomOperator(OP_ARITY[node.op]);

  if (op) {
    node.op = op.symbol;
  }

  return holder.root;
}

function mutate(tree) {
  return Math.random() < 0.5 ? subtreeMutation(tree) : pointMutation(tree);
}

// =========================================================
// CONSTANT OPTIMISATION
// =========================================================

function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// (1+1) evolution strategy on a program's constants: perturb them all
// with Gaussian noise, keep the change if fitness improves, and adapt
// each step size (grow on success, shrink on failure). Returns an
// improved copy of the program, or the program itself.
function optimizeConstants(tree, steps) {
  const start = getFitness(tree).totalFitness;

  if (!Number.isFinite(start)) {
    return tree;
  }

  const { holder, nodes } = listNodes(clone(tree));
  const slots = nodes.filter(n => isConstant(n.node));

  if (!slots.length) {
    return tree;
  }

  let values = slots.map(n => Number(n.node));
  const sigma = values.map(v => 0.1 * Math.max(1, Math.abs(v)));
  let best = start;

  const write = (vals) => {
    slots.forEach((n, i) => n.set(String(Number(vals[i].toPrecision(10)))));
  };

  for (let s = 0; s < steps; s++) {
    const candidate = values.map((v, i) => v + sigma[i] * gaussian());

    write(candidate);

    const f = fitness(holder.root).totalFitness;

    if (f < best) {
      best = f;
      values = candidate;
      for (let i = 0; i < sigma.length; i++) sigma[i] *= 1.5;
    } else {
      for (let i = 0; i < sigma.length; i++) sigma[i] *= 0.9;
    }
  }

  if (best >= start) {
    return tree;
  }

  write(values);

  return holder.root;
}

// Optimise the constants of the best few distinct programs in place
// (Lamarckian: the improved constants are inherited).
function optimizeTopConstants() {
  const seen = new Set();
  let done = 0;

  if (constOpt.mode === 'random') {
    for (let i = 0; i < population.length; i++) {
      if (Math.random() < constOpt.rate) {
        population[i] = optimizeConstants(population[i], constOpt.steps);
      }
    }
    return;
  }

  for (let i = 0; i < population.length && done < constOpt.programs; i++) {
    const key = treeToString(population[i]);

    if (seen.has(key)) continue;

    seen.add(key);
    population[i] = optimizeConstants(population[i], constOpt.steps);
    done++;
  }
}

// =========================================================
// EVOLUTION LOOP
// =========================================================

// How the next generation of exactly `size` individuals is split.
// Elites and immigrants never crowd out bred offspring entirely, and
// the total always equals `size`.
function generationPlan(size) {
  const eliteCount = Math.min(size, Math.floor(size * elitismRate));
  const immigrantCount = Math.min(
    size - eliteCount,
    Math.floor(size * IMMIGRANT_RATE)
  );
  const offspringCount = size - eliteCount - immigrantCount;

  return { eliteCount, immigrantCount, offspringCount };
}

// Send the latest generation's best program, plus everything gathered
// since the previous message.
function report(type, extra = {}) {
  const { best, result } = current;
  const model = modelOf(best);

  const message = {
    type,
    best,
    model,
    fitness: result.totalFitness,
    rawError: result.rawError,
    r2: result.r2,
    medianR2: current.medianR2,
    // size of the program as shown to the user
    size: treeSize(model),
    generation,
    expression: treeToString(best),
    progress: pendingProgress,
    timeline: pendingTimeline,
    ...extra
  };

  if (type !== 'update' || generation - lastPopulationSent >= populationEvery) {
    message.population = clone(population);
    lastPopulationSent = generation;
  }

  pendingProgress = [];
  pendingTimeline = [];

  postMessage(message);
}

function finish(reason) {
  running = false;
  report('finished', { reason });
}

function sortPopulation() {
  population.sort(
    (a, b) => getFitness(a).totalFitness - getFitness(b).totalFitness
  );
}

// Score the current population and record the generation's results.
function assess() {
  sortPopulation();

  if (constantOptimization) {
    optimizeTopConstants();
    sortPopulation();
  }

  const best = population[0];
  const result = getFitness(best);
  const median = getFitness(population[Math.floor(population.length / 2)]);

  current = { best, result, medianR2: median.r2 };

  pendingProgress.push([generation, result.r2, median.r2]);

  const key = treeToString(best);

  if (key !== lastBestKey) {
    lastBestKey = key;
    pendingTimeline.push({
      g: generation,
      r2: result.r2,
      fitness: result.totalFitness,
      model: modelOf(best)
    });
  }

  return result;
}

function breed() {
  const plan = generationPlan(populationSize);
  const next = [];

  // Elitism (population is sorted best-first)
  for (let i = 0; i < plan.eliteCount && i < population.length; i++) {
    next.push(population[i]);
  }

  // Breed offspring
  const offspringTarget = next.length + plan.offspringCount;

  while (next.length < offspringTarget) {

    const parentA = tournamentSelection(population, tournamentSize);

    let child = Math.random() < crossoverRate ?
      crossover(parentA, tournamentSelection(population, tournamentSize)) :
      parentA;

    if (Math.random() < mutationRate) {
      child = mutate(child);
    }

    next.push(child);
  }

  // Random immigrants keep diversity up
  while (next.length < populationSize) {
    next.push(randomImmigrant());
  }

  population = next;
}

// One generation. Returns false when the run has finished.
function evolve() {

  generation++;

  const result = assess();

  if (result.r2 >= targetR2) {
    finish('targetReached');
    return false;
  }

  if (generation >= maxGenerations) {
    finish('maxGenerations');
    return false;
  }

  breed();

  return true;
}

function stopLoop() {
  running = false;

  if (loopTimer !== null) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

// Run generations for up to batchMs (at least one), then send a single
// update, so fast runs are not limited by how often the page redraws.
function loop() {
  loopTimer = null;

  if (!running) return;

  const started = Date.now();
  let keepGoing;

  do {
    keepGoing = evolve();
  } while (keepGoing && running && Date.now() - started < batchMs);

  if (keepGoing && running) {
    report('update');
    loopTimer = setTimeout(loop, delayMs);
  }
}

function startLoop() {
  // Never run two loops at once (e.g. a quick Stop -> Resume).
  stopLoop();

  // Already at the generation limit: say so instead of silently
  // doing nothing.
  if (generation >= maxGenerations) {
    assess();
    finish('maxGenerations');
    return;
  }

  running = true;
  loop();
}

// =========================================================
// CONFIG & MESSAGES
// =========================================================

function buildOperators(ops) {
  const operators = (ops || [])
    .filter(symbol => OP_ARITY[symbol])
    .map(symbol => ({ symbol, arity: OP_ARITY[symbol] }));

  return operators.length > 0 ? operators : DEFAULT_OPERATORS;
}

function applyConfig(rawConfig) {
  const config = normalizeConfig(rawConfig);

  targetFormula = config.targetFormula;
  targetR2 = config.targetR2;
  maxGenerations = config.maxGenerations;
  populationSize = config.populationSize;
  minX = config.minX;
  maxX = config.maxX;
  sampleCount = config.sampleCount;
  OPERATORS = buildOperators(config.operators);
  mutationRate = config.mutationRate;
  crossoverRate = config.crossoverRate;
  elitismRate = config.elitismRate;
  tournamentSize = config.tournamentSize;
  initDepth = config.treeDepth;
  maxDepth = Math.max(config.maxTreeDepth, initDepth);
  linearScaling = config.linearScaling;
  constantOptimization = config.constantOptimization;
  dataMode = config.dataMode;
  variables = config.variables;
  dataset = (config.dataset || []).map(p => (p.v ?
    { v: Object.fromEntries(variables.map(n => [n, Number(p.v[n])])), y: Number(p.y) } :
    { x: Number(p.x), y: Number(p.y) }));

  const speed = SPEEDS[config.speed] || SPEEDS.fast;
  batchMs = config.batchMs ?? speed.batchMs;
  delayMs = config.delayMs ?? speed.delayMs;
  populationEvery = config.populationEvery ?? POPULATION_EVERY;
  constOpt = { ...constOpt, ...(config.constOpt || {}) };

  points = buildPoints();

  meanY = points.reduce((s, p) => s + p.y, 0) / (points.length || 1);
  ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);

  fitnessCache.clear();
  lastBestKey = null;
}

// Drop malformed individuals (e.g. from an old checkpoint) and top up.
function ensurePopulation() {
  population = (population || []).filter(Boolean);

  while (population.length < populationSize) {
    population.push(randomImmigrant());
  }
}

onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'start') {
    stopLoop();
    // Apply the config first so the requested population size is used.
    applyConfig(msg.config);
    initPopulation(populationSize);
    pendingProgress = [];
    pendingTimeline = [];
    lastPopulationSent = -Infinity;
    startLoop();
  }

  if (msg.type === 'stop') {
    const wasRunning = running;

    stopLoop();

    // hand the UI the exact state to checkpoint
    if (wasRunning && current) {
      report('stopped');
    }
  }

  if (msg.type === 'resume') {
    applyConfig(msg.config);
    ensurePopulation();
    startLoop();
  }

  if (msg.type === 'restore') {
    stopLoop();

    applyConfig(msg.state.config || {});

    generation = msg.state.generation || 0;

    population = msg.state.population || [];

    ensurePopulation();

    // stay paused until Resume is clicked
    postMessage({
      type: 'restored',
      generation,
      populationSize: population.length
    });
  }
};
