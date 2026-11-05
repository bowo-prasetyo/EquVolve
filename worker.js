// Genetic Programming evolution engine (runs inside a Web Worker).
// Shared helpers: OP_ARITY, generateFormulaSamples, evaluateTree,
// treeToString, normalizeConfig.
importScripts('shared.js');

const IMMIGRANT_RATE = 0.1;
const LOOP_DELAY_MS = 50;

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
let treeDepth = 4;
let dataMode = 'formula';
let dataset = [];

// Training points, computed once per config (not once per evaluation).
let points = [];

let population = [];
let running = false;
let generation = 0;
let loopTimer = null;

const fitnessCache = new Map();

function getFitness(node) {
  const key = JSON.stringify(node);

  if (fitnessCache.has(key)) {
    return fitnessCache.get(key);
  }

  const f = fitness(node);
  fitnessCache.set(key, f);
  return f;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomTerminal() {

  // 50% variable
  if (Math.random() < 0.5) {
    return 'x';
  }

  // ERC: random constant
  const value = Math.random() * 20 - 10;

  return value.toFixed(3);
}

function randomTree(depth = 0) {

  if (depth >= treeDepth || Math.random() < 0.2) {
    return randomTerminal();
  }

  const op = OPERATORS[randomInt(OPERATORS.length)];

  if (op.arity === 1) {
    return {
      op: op.symbol,
      child: randomTree(depth + 1)
    };
  }

  return {
    op: op.symbol,
    left: randomTree(depth + 1),
    right: randomTree(depth + 1)
  };
}

function treeSize(node) {

  if (typeof node === 'string') {
    return 1;
  }

  if (node.child) {
    return 1 + treeSize(node.child);
  }

  return 1 + treeSize(node.left) + treeSize(node.right);
}

function buildPoints() {

  if (dataMode === 'dataset') {
    return dataset.filter(
      p => Number.isFinite(p.x) && Number.isFinite(p.y)
    );
  }

  try {
    return generateFormulaSamples(targetFormula, minX, maxX, sampleCount);
  } catch (e) {
    return [];
  }
}

function fitness(program) {

  const invalid = {
    rawError: Infinity,
    r2: -Infinity,
    totalFitness: Infinity
  };

  if (points.length === 0) {
    return invalid;
  }

  let meanY = 0;

  for (const p of points) {
    meanY += p.y;
  }

  meanY /= points.length;

  let ssTot = 0;
  let ssRes = 0;

  for (const p of points) {

    const predicted = evaluateTree(program, p.x);

    if (!Number.isFinite(predicted)) {
      return invalid;
    }

    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - predicted) ** 2;
  }

  // R² is undefined for a constant target
  if (ssTot === 0) {
    return invalid;
  }

  const r2 = 1 - ssRes / ssTot;

  // convert to minimization
  const error = 1 - r2;

  const complexityPenalty = treeSize(program) * 0.001;

  return {
    rawError: error,
    r2,
    totalFitness: error + complexityPenalty
  };
}

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

  return clone(best);
}

function crossover(a, b) {

  // null safety
  if (a == null) return clone(b);
  if (b == null) return clone(a);

  // terminal safety
  if (typeof a === 'string' || typeof b === 'string') {
    return Math.random() < 0.5 ? clone(a) : clone(b);
  }

  // unary node handling
  if (a.child || b.child) {
    return clone(Math.random() < 0.5 ? a : b);
  }

  // binary node handling
  return {
    op: Math.random() < 0.5 ? a.op : b.op,
    left: crossover(a.left, b.left),
    right: crossover(a.right, b.right)
  };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeNode(node, depth = 0) {

  if (typeof node === 'string') {
    return node;
  }

  // unary operator
  if (OP_ARITY[node.op] === 1) {
    return {
      op: node.op,
      child: normalizeNode(
        node.child || node.left || node.right || randomTree(depth + 1),
        depth + 1
      )
    };
  }

  // binary operator
  return {
    op: node.op,
    left: normalizeNode(
      node.left || node.child || randomTree(depth + 1),
      depth + 1
    ),
    right: normalizeNode(
      node.right || randomTree(depth + 1),
      depth + 1
    )
  };
}

function mutate(node, depth = 0) {

  if (node == null) {
    return randomTree(depth);
  }

  if (typeof node === 'string') {

    // mutate terminal
    if (Math.random() < mutationRate) {

      // keep x sometimes
      if (node === 'x' && Math.random() < 0.5) {
        return 'x';
      }

      // numeric perturbation
      const n = Number(node);

      if (!isNaN(n)) {
        const delta = Math.random() * 2 - 1;
        return (n + delta).toFixed(3);
      }

      return randomTerminal();
    }

    return node;
  }

  if (Math.random() < mutationRate && depth < treeDepth) {
    return randomTree(depth);
  }

  const child = clone(node);

  if (Math.random() < mutationRate) {

    const op = OPERATORS[randomInt(OPERATORS.length)];

    child.op = op.symbol;

    if (op.arity === 1) {
      delete child.left;
      delete child.right;
      child.child = child.child || randomTree(depth + 1);
    } else {
      delete child.child;
      child.left = child.left || randomTree(depth + 1);
      child.right = child.right || randomTree(depth + 1);
    }
  }

  if (child.child) {
    child.child = mutate(child.child, depth + 1);
  } else {
    child.left = mutate(child.left, depth + 1);
    child.right = mutate(child.right, depth + 1);
  }

  return normalizeNode(child, depth);
}

function initPopulation(size) {
  population = [];
  generation = 0;

  for (let i = 0; i < size; i++) {
    population.push(randomTree());
  }
}

// How the next generation of exactly `size` individuals is split.
// Elites and immigrants never crowd out bred offspring entirely, and
// the total always equals `size` (fixes unbounded growth / no-breeding).
function generationPlan(size) {
  const eliteCount = Math.min(size, Math.floor(size * elitismRate));
  const immigrantCount = Math.min(
    size - eliteCount,
    Math.floor(size * IMMIGRANT_RATE)
  );
  const offspringCount = size - eliteCount - immigrantCount;

  return { eliteCount, immigrantCount, offspringCount };
}

function finish(reason, best, result) {
  running = false;

  postMessage({
    type: 'finished',
    reason,
    best,
    fitness: result.totalFitness,
    rawError: result.rawError,
    r2: result.r2,
    generation,
    expression: treeToString(best)
  });
}

function sortPopulation() {
  population.sort(
    (a, b) => getFitness(a).totalFitness - getFitness(b).totalFitness
  );
}

function evolve() {

  generation++;

  sortPopulation();

  const best = population[0];
  const result = getFitness(best);

  postMessage({
    type: 'update',
    best,
    fitness: result.totalFitness,
    rawError: result.rawError,
    r2: result.r2,
    generation,
    expression: treeToString(best),
    population: clone(population)
  });

  if (result.r2 >= targetR2) {
    finish('targetReached', best, result);
    return;
  }

  if (generation >= maxGenerations) {
    finish('maxGenerations', best, result);
    return;
  }

  const plan = generationPlan(populationSize);
  const next = [];

  // Elitism (population is sorted best-first)
  for (let i = 0; i < plan.eliteCount && i < population.length; i++) {
    next.push(clone(population[i]));
  }

  // Breed offspring
  const offspringTarget = next.length + plan.offspringCount;

  while (next.length < offspringTarget) {

    const parentA = tournamentSelection(population, tournamentSize);
    const parentB = tournamentSelection(population, tournamentSize);

    let child = Math.random() < crossoverRate ?
      crossover(parentA, parentB) :
      clone(parentA);

    child = mutate(child);

    next.push(child);
  }

  // Random immigrants keep diversity up
  while (next.length < populationSize) {
    next.push(randomTree());
  }

  population = next;
  fitnessCache.clear();
}

function stopLoop() {
  running = false;

  if (loopTimer !== null) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

function loop() {
  loopTimer = null;

  if (!running) return;

  evolve();

  if (running) {
    loopTimer = setTimeout(loop, LOOP_DELAY_MS);
  }
}

function startLoop() {
  // Never run two loops at once (e.g. a quick Stop -> Resume).
  stopLoop();

  // Already at the generation limit: say so instead of silently
  // doing nothing.
  if (generation >= maxGenerations) {
    sortPopulation();
    const best = population[0];
    finish('maxGenerations', best, getFitness(best));
    return;
  }

  running = true;
  loop();
}

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
  treeDepth = config.treeDepth;
  dataMode = config.dataMode;
  dataset = (config.dataset || []).map(p => ({
    x: Number(p.x),
    y: Number(p.y)
  }));

  points = buildPoints();
  fitnessCache.clear();
}

function ensurePopulation() {
  population = (population || []).filter(Boolean);

  while (population.length < populationSize) {
    population.push(randomTree());
  }
}

onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'start') {
    stopLoop();
    // Apply the config first so the requested population size is used.
    applyConfig(msg.config);
    initPopulation(populationSize);
    startLoop();
  }

  if (msg.type === 'stop') {
    stopLoop();
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
