// Shared GP core used by both the UI (app.js) and the evolution engine
// (worker.js). Keeping these in one place guarantees that the curve the
// user sees is computed exactly the way the engine scores it.

const OP_ARITY = {
  '+': 2,
  '-': 2,
  '*': 2,
  '/': 2,
  'pow': 2,
  'sin': 1,
  'cos': 1,
  'tan': 1,
  'sinh': 1,
  'cosh': 1,
  'tanh': 1,
  'asin': 1,
  'acos': 1,
  'atan': 1,
  'asinh': 1,
  'acosh': 1,
  'atanh': 1,
  'log': 1,
  'log2': 1,
  'log10': 1,
  'exp': 1,
  'sqrt': 1,
  'cbrt': 1
};

const DEFAULT_SAMPLE_COUNT = 101;

// Compile a target formula once. Math functions are in scope, so both
// `Math.sin(x)` and `sin(x)` / `pow(x, 2)` work - which also means an
// evolved expression can be pasted straight back in as a target.
// Throws on syntax errors.
function compileFormula(formula) {
  const source = String(formula == null ? '' : formula).trim();

  if (!source) {
    throw new Error('Formula is empty.');
  }

  // eslint-disable-next-line no-new-func
  const fn = new Function('x', `with (Math) { return (${source}); }`);

  return (x) => Number(fn(x));
}

// Evenly spaced samples over [minX, maxX] (inclusive). Non-finite
// outputs (e.g. 1/x at x = 0) are dropped. Used for both training and
// plotting so they always match.
function generateFormulaSamples(formula, minX, maxX, count = DEFAULT_SAMPLE_COUNT) {
  const f = compileFormula(formula);
  const n = Math.max(2, Math.floor(count));
  const samples = [];

  for (let i = 0; i < n; i++) {
    const x = minX + (i / (n - 1)) * (maxX - minX);

    let y;
    try {
      y = f(x);
    } catch (e) {
      continue;
    }

    if (Number.isFinite(y)) {
      samples.push({ x, y });
    }
  }

  return samples;
}

function evaluateTree(node, x) {

  if (node == null) {
    return NaN;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return node === 'x' ? x : Number(node);
  }

  // unary operators
  if (node.child) {

    const v = evaluateTree(node.child, x);

    switch (node.op) {
      case 'sin': return Math.sin(v);
      case 'cos': return Math.cos(v);
      case 'tan': return Math.tan(v);
      case 'sinh': return Math.sinh(v);
      case 'cosh': return Math.cosh(v);
      case 'tanh': return Math.tanh(v);
      case 'asin': return Math.asin(v);
      case 'acos': return Math.acos(v);
      case 'atan': return Math.atan(v);
      case 'asinh': return Math.asinh(v);
      case 'acosh': return Math.acosh(v);
      case 'atanh': return Math.atanh(v);
      case 'log': return Math.log(v);
      case 'log2': return Math.log2(v);
      case 'log10': return Math.log10(v);
      case 'exp': return Math.exp(v);
      case 'sqrt': return Math.sqrt(v);
      case 'cbrt': return Math.cbrt(v);
    }

    return NaN;
  }

  // binary operators
  const left = evaluateTree(node.left, x);
  const right = evaluateTree(node.right, x);

  switch (node.op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case 'pow': return Math.pow(left, right);
  }

  return NaN;
}

function treeToString(node) {

  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (node.child) {
    return `${node.op}(${treeToString(node.child)})`;
  }

  if (node.op === 'pow') {
    return `pow(${treeToString(node.left)}, ${treeToString(node.right)})`;
  }

  return `(${treeToString(node.left)} ${node.op} ${treeToString(node.right)})`;
}

// Validate a run configuration. Returns a list of human-readable
// problems; an empty list means the config is usable.
function validateConfig(config) {
  const errors = [];
  const isInt = (v) => Number.isInteger(v);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const inUnit = (v) => isNum(v) && v >= 0 && v <= 1;

  if (!isInt(config.populationSize) || config.populationSize < 2) {
    errors.push('Population Size must be a whole number of at least 2.');
  }

  if (!isInt(config.maxGenerations) || config.maxGenerations < 1) {
    errors.push('Max Generations must be a whole number of at least 1.');
  }

  if (!isNum(config.targetR2) || config.targetR2 > 1) {
    errors.push('Target R² must be a number no greater than 1.');
  }

  if (!inUnit(config.mutationRate)) {
    errors.push('Mutation Rate must be between 0 and 1.');
  }

  if (!inUnit(config.crossoverRate)) {
    errors.push('Crossover Rate must be between 0 and 1.');
  }

  if (!inUnit(config.elitismRate)) {
    errors.push('Elitism Rate must be between 0 and 1.');
  }

  if (!isInt(config.tournamentSize) || config.tournamentSize < 1) {
    errors.push('Tournament Size must be a whole number of at least 1.');
  }

  if (!isInt(config.treeDepth) || config.treeDepth < 1 || config.treeDepth > 12) {
    errors.push('Tree Depth must be a whole number between 1 and 12.');
  }

  if (!Array.isArray(config.operators) || config.operators.length === 0) {
    errors.push('Select at least one operator.');
  }

  let points = [];

  if (config.dataMode === 'dataset') {
    points = config.dataset || [];

    if (points.length < 2) {
      errors.push('Upload a CSV dataset with at least 2 valid x,y rows.');
    }
  } else {
    if (!isNum(config.minX) || !isNum(config.maxX) || config.minX >= config.maxX) {
      errors.push('X Range minimum must be smaller than the maximum.');
    }

    if (!isInt(config.sampleCount) || config.sampleCount < 2 || config.sampleCount > 10000) {
      errors.push('Sample Points must be a whole number between 2 and 10000.');
    }

    if (errors.length === 0) {
      try {
        points = generateFormulaSamples(
          config.targetFormula, config.minX, config.maxX, config.sampleCount
        );

        if (points.length < 2) {
          errors.push('Formula produces fewer than 2 finite values in the X Range.');
        }
      } catch (e) {
        errors.push(`Formula is invalid: ${e.message}`);
        points = [];
      }
    }
  }

  if (points.length >= 2) {
    const y0 = points[0].y;

    if (points.every(p => p.y === y0)) {
      errors.push('Target values are constant; R² is undefined for a constant target.');
    }
  }

  return errors;
}

// Older saved sessions stored a "minError" threshold on (1 - R²).
// Convert it so restored runs keep the same stopping behaviour.
function normalizeConfig(config) {
  const c = Object.assign({}, config || {});

  if (typeof c.targetR2 !== 'number' && typeof c.minError === 'number') {
    c.targetR2 = 1 - c.minError;
  }

  delete c.minError;

  if (typeof c.sampleCount !== 'number') {
    c.sampleCount = DEFAULT_SAMPLE_COUNT;
  }

  return c;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OP_ARITY,
    DEFAULT_SAMPLE_COUNT,
    compileFormula,
    generateFormulaSamples,
    evaluateTree,
    treeToString,
    validateConfig,
    normalizeConfig
  };
}
