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
const MAX_TREE_DEPTH_LIMIT = 17;

// =========================================================
// TARGET FORMULAS
// =========================================================

// Names allowed in a target formula besides `x`: everything on Math
// (sin, pow, PI, E, abs, ...). Nothing else is reachable, so a formula,
// including one arriving in a shared link, cannot run arbitrary code.
const MATH_NAMES = new Set(Object.getOwnPropertyNames(Math));

const FORMULA_TOKEN =
  /\s+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|Math\.[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*|\*\*|[-+*/%(),]/y;

function checkFormulaSyntax(source) {
  FORMULA_TOKEN.lastIndex = 0;

  while (FORMULA_TOKEN.lastIndex < source.length) {
    const start = FORMULA_TOKEN.lastIndex;
    const match = FORMULA_TOKEN.exec(source);

    if (!match) {
      throw new Error(`unexpected character "${source[start]}"`);
    }

    const token = match[0];

    if (/^[A-Za-z_$]/.test(token)) {
      const name = token.startsWith('Math.') ? token.slice(5) : token;

      if (token !== 'x' && !MATH_NAMES.has(name)) {
        throw new Error(`unknown name "${token}"`);
      }
    }
  }
}

// Compile a target formula once. Math functions are in scope, so both
// `Math.sin(x)` and `sin(x)` / `pow(x, 2)` work - which also means an
// evolved expression can be pasted straight back in as a target.
// Throws on anything that is not a plain arithmetic expression in x.
function compileFormula(formula) {
  const source = String(formula == null ? '' : formula).trim();

  if (!source) {
    throw new Error('Formula is empty.');
  }

  checkFormulaSyntax(source);

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

// =========================================================
// TREES
// =========================================================
// A tree is a terminal string - a variable name ('x', or a column name
// for multi-variable data) or a numeric constant such as '3.141' - or
// {op, child} (unary) or {op, left, right} (binary).

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isTerminal(node) {
  return typeof node === 'string' || typeof node === 'number';
}

function isVariable(node) {
  return typeof node === 'string' && IDENTIFIER.test(node);
}

function isConstant(node) {
  return isTerminal(node) && !isVariable(node);
}

// The input of a training point: a number (single variable x) or an
// object of named values (multi-variable data).
function pointInput(p) {
  return p.v !== undefined ? p.v : p.x;
}

// `input` is a number (the value of the single variable) or an object
// mapping variable names to values.
function evaluateTree(node, input) {

  if (node == null) {
    return NaN;
  }

  if (isTerminal(node)) {
    if (isVariable(node)) {
      return typeof input === 'number' ? input : input[node];
    }
    return Number(node);
  }

  // unary operators
  if (node.child) {

    const v = evaluateTree(node.child, input);

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
  const left = evaluateTree(node.left, input);
  const right = evaluateTree(node.right, input);

  switch (node.op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case 'pow': return Math.pow(left, right);
  }

  return NaN;
}

function treeSize(node) {
  if (isTerminal(node)) return 1;
  if (node.child) return 1 + treeSize(node.child);
  return 1 + treeSize(node.left) + treeSize(node.right);
}

// A terminal has depth 0.
function treeDepth(node) {
  if (isTerminal(node)) return 0;
  if (node.child) return 1 + treeDepth(node.child);
  return 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
}

function containsVariable(node) {
  if (isTerminal(node)) return isVariable(node);
  if (node.child) return containsVariable(node.child);
  return containsVariable(node.left) || containsVariable(node.right);
}

function treeVariables(node, out = new Set()) {
  if (isTerminal(node)) {
    if (isVariable(node)) out.add(node);
  } else if (node.child) {
    treeVariables(node.child, out);
  } else {
    treeVariables(node.left, out);
    treeVariables(node.right, out);
  }
  return out;
}

// Fully parenthesised form; also used as a structural key.
function treeToString(node) {

  if (node == null) {
    return '';
  }

  if (isTerminal(node)) {
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

// Compact nested-array form used for storage and share links:
// 'x' | '1.5' | [op, child] | [op, left, right]
function compressTree(node) {
  if (node == null) return null;
  if (isTerminal(node)) return node;
  if (node.child) return [node.op, compressTree(node.child)];
  return [node.op, compressTree(node.left), compressTree(node.right)];
}

function decompressTree(node) {
  if (isTerminal(node)) return node;
  if (!Array.isArray(node)) return null;
  if (node.length === 2) {
    return { op: node[0], child: decompressTree(node[1]) };
  }
  return {
    op: node[0],
    left: decompressTree(node[1]),
    right: decompressTree(node[2])
  };
}

// Strictly check an untrusted tree (e.g. from a share link). Variables
// must be among `variables`.
function isValidTree(node, variables = ['x'], depth = 0) {
  if (depth > 64) return false;
  if (typeof node === 'string') {
    return isVariable(node) ? variables.includes(node) : Number.isFinite(Number(node));
  }
  if (!node || typeof node !== 'object' || !OP_ARITY[node.op]) return false;
  if (OP_ARITY[node.op] === 1) return isValidTree(node.child, variables, depth + 1);
  return isValidTree(node.left, variables, depth + 1) &&
    isValidTree(node.right, variables, depth + 1);
}

// =========================================================
// LINEAR SCALING
// =========================================================
// Keijzer (2003): evolve the *shape* f(x) and fit the best a + b*f(x)
// by least squares, so the search never has to discover the right
// offset and scale through random constants.

function scaledTree(tree, a, b) {
  return {
    op: '+',
    left: String(a),
    right: { op: '*', left: String(b), right: tree }
  };
}

// =========================================================
// SIMPLIFICATION
// =========================================================

function num(v) {
  // -0 prints as "0"
  return String(v === 0 ? 0 : v);
}

function constValue(node) {
  return isConstant(node) ? Number(node) : null;
}

// Split a term into coefficient * rest (rest is null for a constant).
function splitCoefficient(node) {
  const c = constValue(node);

  if (c !== null) {
    return { coef: c, rest: null };
  }

  if (node.op === '*' && constValue(node.left) !== null) {
    return { coef: Number(node.left), rest: node.right };
  }

  return { coef: 1, rest: node };
}

function collectSum(node, sign, terms) {
  if (!isTerminal(node) && (node.op === '+' || node.op === '-')) {
    collectSum(node.left, sign, terms);
    collectSum(node.right, node.op === '+' ? sign : -sign, terms);
    return;
  }

  terms.push({ sign, node });
}

function buildSum(node) {
  const raw = [];
  collectSum(node, 1, raw);

  let constant = 0;
  const groups = new Map();

  for (const { sign, node: term } of raw) {
    const { coef, rest } = splitCoefficient(term);

    if (rest === null) {
      constant += sign * coef;
      continue;
    }

    const key = treeToString(rest);
    const g = groups.get(key);

    if (g) {
      g.coef += sign * coef;
    } else {
      groups.set(key, { coef: sign * coef, rest });
    }
  }

  const termNode = (coef, rest) =>
    coef === 1 ? rest : { op: '*', left: num(coef), right: rest };

  let out = null;

  for (const { coef, rest } of groups.values()) {
    if (coef === 0) continue;

    if (out === null) {
      out = termNode(coef, rest);
    } else if (coef < 0) {
      out = { op: '-', left: out, right: termNode(-coef, rest) };
    } else {
      out = { op: '+', left: out, right: termNode(coef, rest) };
    }
  }

  if (out === null) {
    return num(constant);
  }

  if (constant > 0) {
    out = { op: '+', left: out, right: num(constant) };
  } else if (constant < 0) {
    out = { op: '-', left: out, right: num(-constant) };
  }

  return out;
}

// Flatten products and quotients into factors with a sign: +1 for the
// numerator, -1 for the denominator (u / v = u * v^-1).
function collectProduct(node, factors, sign = 1) {
  if (!isTerminal(node) && (node.op === '*' || node.op === '/')) {
    collectProduct(node.left, factors, sign);
    collectProduct(node.right, factors, node.op === '*' ? sign : -sign);
    return;
  }

  factors.push({ node, sign });
}

function productOf(factors) {
  let out = null;

  for (const { power, node: f } of factors) {
    const factor = power === 1 ? f : { op: 'pow', left: f, right: num(power) };
    out = out === null ? factor : { op: '*', left: out, right: factor };
  }

  return out;
}

function buildProduct(node) {
  const raw = [];
  collectProduct(node, raw);

  let constant = 1;
  const groups = new Map();

  for (const { node: f, sign } of raw) {
    const c = constValue(f);

    if (c !== null) {
      if (sign < 0 && c === 0) {
        return node; // division by zero: leave it alone
      }

      constant = sign > 0 ? constant * c : constant / c;
      continue;
    }

    // pow(u, k) with a constant k counts as k factors of u
    const exponent = !isTerminal(f) && f.op === 'pow' ? constValue(f.right) : null;
    const base = exponent !== null ? f.left : f;
    const power = (exponent !== null ? exponent : 1) * sign;

    const key = treeToString(base);
    const g = groups.get(key);

    if (g) {
      g.power += power;
    } else {
      groups.set(key, { power, node: base });
    }
  }

  if (constant === 0) {
    return '0';
  }

  const kept = [...groups.values()].filter(g => g.power !== 0);
  const numerator = productOf(kept.filter(g => g.power > 0));
  const denominator = productOf(
    kept.filter(g => g.power < 0).map(g => ({ power: -g.power, node: g.node }))
  );

  let out = denominator === null ?
    numerator :
    { op: '/', left: numerator === null ? '1' : numerator, right: denominator };

  if (out === null) {
    return num(constant);
  }

  if (constant === 1) {
    return out;
  }

  // c * (u + v - w)  ->  c*u + c*v - c*w, so the a + b*(...) wrapper
  // from linear scaling folds into the program's own coefficients
  if (kept.length === 1 && !isTerminal(out) && (out.op === '+' || out.op === '-')) {
    const terms = [];
    collectSum(out, 1, terms);

    let sum = null;

    for (const { sign, node: term } of terms) {
      const scaled = buildProduct({ op: '*', left: num(sign * constant), right: term });
      sum = sum === null ? scaled : { op: '+', left: sum, right: scaled };
    }

    return buildSum(sum);
  }

  return { op: '*', left: num(constant), right: out };
}

function simplifyOnce(node) {

  if (isTerminal(node)) {
    return isVariable(node) ? node : num(Number(node));
  }

  const n = node.child ?
    { op: node.op, child: simplifyOnce(node.child) } :
    { op: node.op, left: simplifyOnce(node.left), right: simplifyOnce(node.right) };

  // constant folding
  if (!containsVariable(n)) {
    const v = evaluateTree(n, 0);

    if (Number.isFinite(v)) {
      return num(v);
    }

    return n;
  }

  switch (n.op) {
    case '+':
    case '-':
      return buildSum(n);

    case '*':
      return buildProduct(n);

    case '/':
      // as a product with negative powers: coefficients move out
      // (c*u / v -> c * (u / v)), so 2/x + 3/x combine, and common
      // factors cancel ((u / v) * v -> u, u / u -> 1)
      return buildProduct(n);

    case 'pow': {
      const e = constValue(n.right);

      if (e === 1) return n.left;
      if (e === 0) return '1';
      if (constValue(n.left) === 1) return '1';

      return n;
    }
  }

  return n;
}

// Algebraic simplification for display and export. If `points` are
// given, the result is only accepted when it computes the same values
// as the original on every point; otherwise the original is returned.
function simplifyTree(tree, points = null) {
  let current = tree;

  for (let i = 0; i < 8; i++) {
    const next = simplifyOnce(current);

    if (treeToString(next) === treeToString(current)) {
      break;
    }

    current = next;
  }

  if (points && points.length) {
    for (const p of points) {
      const a = evaluateTree(tree, pointInput(p));
      const b = evaluateTree(current, pointInput(p));

      if (!Number.isFinite(a)) continue;

      if (!Number.isFinite(b) || Math.abs(a - b) > 1e-7 * Math.max(1, Math.abs(a))) {
        return tree;
      }
    }
  }

  return current;
}

// =========================================================
// PRINTING & EXPORT
// =========================================================

// Significant digits for constants: short for reading, full for export.
const DISPLAY_DIGITS = 5;
const EXPORT_DIGITS = 12;

function formatNumber(value, digits) {
  const v = Number(Number(value).toPrecision(digits));
  return num(v);
}

const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

// u * (1 / v): printed as u / v
function isReciprocalProduct(node) {
  return !isTerminal(node) && node.op === '*' &&
    !isTerminal(node.right) && node.right.op === '/' &&
    constValue(node.right.left) === 1;
}

// -1 * u: printed as -u
function isNegation(node) {
  return !isTerminal(node) && node.op === '*' && constValue(node.left) === -1;
}

// 0 marks a leading minus sign (negative constant or -u), which needs
// parentheses anywhere but the leftmost position.
function precedenceOf(node) {
  if (isTerminal(node)) {
    return isConstant(node) && Number(node) < 0 ? 0 : 9;
  }
  if (isNegation(node)) return 0;
  if (node.op === 'pow') return 3;
  return PRECEDENCE[node.op] || 9; // unary function calls are atomic
}

const FUNCTION_NAMES = {
  plain: (op) => op,
  js: (op) => `Math.${op}`,
  python: (op) => `math.${op}`
};

// The positive part of a negative constant or -u, otherwise null.
function negatedPart(node) {
  if (isConstant(node) && Number(node) < 0) return num(-Number(node));
  if (isNegation(node)) return node.right;
  return null;
}

// a + (-u)  ->  a - u   and   a - (-u)  ->  a + u
function foldSigns(node) {
  if (!isTerminal(node) && (node.op === '+' || node.op === '-')) {
    const pos = negatedPart(node.right);

    if (pos !== null) {
      return { op: node.op === '+' ? '-' : '+', left: node.left, right: pos };
    }
  }

  return node;
}

function infix(node, format, digits) {
  node = foldSigns(node);

  const fn = FUNCTION_NAMES[format];

  const wrap = (child, needParens) => {
    const s = infix(child, format, digits);
    return needParens ? `(${s})` : s;
  };

  if (isTerminal(node)) {
    return isVariable(node) ? node : formatNumber(node, digits);
  }

  if (node.child) {
    return `${fn(node.op)}(${infix(node.child, format, digits)})`;
  }

  if (node.op === 'pow') {
    if (format === 'python') {
      return `${wrap(node.left, precedenceOf(node.left) <= 3)} ** ${wrap(node.right, precedenceOf(node.right) <= 3)}`;
    }

    return `${fn('pow')}(${infix(node.left, format, digits)}, ${infix(node.right, format, digits)})`;
  }

  if (isReciprocalProduct(node)) {
    return infix({ op: '/', left: node.left, right: node.right.right }, format, digits);
  }

  if (isNegation(node)) {
    return `-${wrap(node.right, precedenceOf(node.right) < 2)}`;
  }

  const p = PRECEDENCE[node.op];
  const lp = precedenceOf(node.left);
  const rp = precedenceOf(node.right);

  // a negative constant may stay bare only as the leftmost operand
  const left = wrap(node.left, lp < p && !(lp === 0 && p <= 2));
  const right = wrap(node.right, node.op === '-' || node.op === '/' ? rp <= p : rp < p);

  return `${left} ${node.op} ${right}`;
}

// Coefficients that print as 1 or -1 at the chosen precision (e.g.
// 0.9999999) are dropped or turned into a minus sign, so the printed
// formula never shows "1 * u".
function roundCoefficients(node, digits) {
  if (isTerminal(node)) return node;

  if (node.child) {
    return { op: node.op, child: roundCoefficients(node.child, digits) };
  }

  const left = roundCoefficients(node.left, digits);
  const right = roundCoefficients(node.right, digits);

  if (node.op === '*' && isConstant(left)) {
    const shown = formatNumber(left, digits);

    if (shown === '1') return right;
    if (shown === '-1') return { op: '*', left: '-1', right };
  }

  return { op: node.op, left, right };
}

// Infix with only the parentheses that are needed.
// format: 'plain' (default; also valid as a target formula), 'js', 'python'
function toInfix(node, format = 'plain', digits = DISPLAY_DIGITS) {
  return infix(roundCoefficients(node, digits), format, digits);
}

function toLatex(node, digits = DISPLAY_DIGITS) {
  return latex(roundCoefficients(node, digits), digits);
}

const LATEX_FUNCTIONS = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
  asinh: '\\operatorname{arsinh}', acosh: '\\operatorname{arcosh}', atanh: '\\operatorname{artanh}',
  log: '\\ln', log2: '\\log_{2}', log10: '\\log_{10}'
};

function latex(node, digits) {
  node = foldSigns(node);

  if (isReciprocalProduct(node)) {
    return latex({ op: '/', left: node.left, right: node.right.right }, digits);
  }

  if (isNegation(node)) {
    const inner = latex(node.right, digits);
    return `-${precedenceOf(node.right) < 2 ? `\\left(${inner}\\right)` : inner}`;
  }

  const paren = (s) => `\\left(${s}\\right)`;

  if (isTerminal(node)) {
    if (isVariable(node)) {
      const name = node.replace(/_/g, '\\_');
      return node.length === 1 ? node : `\\mathit{${name}}`;
    }

    const s = formatNumber(node, digits);
    const m = s.match(/^(-?[\d.]+)e([+-]?\d+)$/);

    return m ? `${m[1]} \\times 10^{${Number(m[2])}}` : s;
  }

  if (node.child) {
    const inner = latex(node.child, digits);

    switch (node.op) {
      case 'exp': return `e^{${inner}}`;
      case 'sqrt': return `\\sqrt{${inner}}`;
      case 'cbrt': return `\\sqrt[3]{${inner}}`;
    }

    return `${LATEX_FUNCTIONS[node.op]}${paren(inner)}`;
  }

  const left = latex(node.left, digits);
  const right = latex(node.right, digits);
  const lp = precedenceOf(node.left);
  const rp = precedenceOf(node.right);

  switch (node.op) {
    case '/':
      return `\\frac{${left}}{${right}}`;

    case 'pow':
      return `{${isTerminal(node.left) && lp !== 0 ? left : paren(left)}}^{${right}}`;

    case '*':
      return `${lp < 2 && !(lp === 0) ? paren(left) : left} \\cdot ${rp < 2 ? paren(right) : right}`;

    case '+':
      return `${left} + ${rp === 0 ? paren(right) : right}`;

    case '-':
      return `${left} - ${rp <= 1 ? paren(right) : right}`;
  }

  return '';
}

function usesOp(node, op) {
  if (isTerminal(node)) return false;
  if (node.op === op) return true;
  if (node.child) return usesOp(node.child, op);
  return usesOp(node.left, op) || usesOp(node.right, op);
}

// `variables` are the function's parameters, in order.
function exportProgram(tree, format, variables = ['x']) {
  const params = variables.join(', ');

  switch (format) {
    case 'js':
      return `const f = (${params}) => ${toInfix(tree, 'js', EXPORT_DIGITS)};`;

    case 'python': {
      const note = usesOp(tree, 'cbrt') ? '  # math.cbrt needs Python 3.11+' : '';
      return `import math\n\n\ndef f(${params}):\n    return ${toInfix(tree, 'python', EXPORT_DIGITS)}${note}\n`;
    }

    case 'latex':
      return `y = ${toLatex(tree, DISPLAY_DIGITS)}`;

    default:
      return toInfix(tree, 'plain', DISPLAY_DIGITS);
  }
}

// =========================================================
// CSV DATASETS
// =========================================================

const MAX_VARIABLES = 10;

// Words that cannot be used as names in the JavaScript or Python export.
const RESERVED_NAMES = new Set((
  'break case catch class const continue debugger default delete do else ' +
  'export extends false finally for function if import in instanceof new ' +
  'null return super switch this throw true try typeof var void while with ' +
  'yield let static enum await implements package protected interface ' +
  'private public arguments eval undefined NaN Infinity ' +
  'and as assert async def del elif except from global is lambda nonlocal ' +
  'not or pass raise None True False math f'
).split(' '));

// Turn CSV column headers into unique, safe variable names:
// "Years of experience" -> "Years_of_experience". Names that clash with
// Math functions or reserved words get a "v_" prefix.
function variableNames(headers) {
  const used = new Set();

  return headers.map((h, i) => {
    let name = String(h == null ? '' : h).trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!name) name = `x${i + 1}`;
    if (/^[0-9]/.test(name)) name = `v_${name}`;
    if (MATH_NAMES.has(name) || RESERVED_NAMES.has(name)) name = `v_${name}`;

    name = name.slice(0, 40);

    let unique = name;
    for (let k = 2; used.has(unique); k++) unique = `${name}_${k}`;

    used.add(unique);
    return unique;
  });
}

function splitCsvLine(line) {
  return line.split(/[,;\t]/).map(cell => cell.trim().replace(/^"(.*)"$/, '$1'));
}

// Parse CSV text into a header row and numeric rows. A first row that
// is not all numbers is treated as the header.
function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim());

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const first = splitCsvLine(lines[0]);
  const hasHeader = first.some(cell => cell === '' || !Number.isFinite(Number(cell)));
  const width = first.length;

  const headers = hasHeader ?
    first :
    first.map((_, i) => (i === width - 1 ? 'y' : `x${i + 1}`));

  const rows = [];

  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitCsvLine(line);

    if (cells.length < width) continue;

    const kept = cells.slice(0, width);

    // Number('') is 0, so an empty cell would otherwise count as a 0
    if (kept.some(cell => cell === '')) continue;

    const values = kept.map(Number);

    if (values.every(Number.isFinite)) {
      rows.push(values);
    }
  }

  return { headers, rows };
}

// Build training points from a parsed CSV: `targetIndex` is the column
// to predict, every other column becomes an input variable. With one
// input the variable is called x (so the 2-D graph and formulas work
// as before); with several, inputs are named after their headers.
function datasetFromTable(table, targetIndex = table.headers.length - 1) {
  const inputIndexes = table.headers
    .map((_, i) => i)
    .filter(i => i !== targetIndex)
    .slice(0, MAX_VARIABLES);

  if (inputIndexes.length <= 1) {
    const xi = inputIndexes[0];
    return {
      variables: ['x'],
      dataset: table.rows.map(r => ({ x: r[xi], y: r[targetIndex] }))
    };
  }

  const variables = variableNames(inputIndexes.map(i => table.headers[i]));

  return {
    variables,
    dataset: table.rows.map(r => {
      const v = {};
      inputIndexes.forEach((col, k) => { v[variables[k]] = r[col]; });
      return { v, y: r[targetIndex] };
    })
  };
}

// =========================================================
// CONFIG
// =========================================================

// Validate a run configuration. Returns every problem at once, each as
// { field, message }, where `field` names the setting to fix: a config
// key (populationSize, targetFormula, ...), 'xRange' for the X range,
// 'operators', or 'dataset'. An empty list means the config is usable.
function validateConfigFields(config) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const isInt = (v) => Number.isInteger(v);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const inUnit = (v) => isNum(v) && v >= 0 && v <= 1;

  if (!isInt(config.populationSize) || config.populationSize < 2) {
    add('populationSize', 'Population Size must be a whole number of at least 2.');
  }

  if (!isInt(config.maxGenerations) || config.maxGenerations < 1) {
    add('maxGenerations', 'Max Generations must be a whole number of at least 1.');
  }

  if (!isNum(config.targetR2) || config.targetR2 > 1) {
    add('targetR2', 'Target R² must be a number no greater than 1.');
  }

  if (!inUnit(config.mutationRate)) {
    add('mutationRate', 'Mutation Rate must be between 0 and 1.');
  }

  if (!inUnit(config.crossoverRate)) {
    add('crossoverRate', 'Crossover Rate must be between 0 and 1.');
  }

  if (!inUnit(config.elitismRate)) {
    add('elitismRate', 'Elitism Rate must be between 0 and 1.');
  }

  if (!isInt(config.tournamentSize) || config.tournamentSize < 1) {
    add('tournamentSize', 'Tournament Size must be a whole number of at least 1.');
  }

  const treeDepthOk = isInt(config.treeDepth) && config.treeDepth >= 1 && config.treeDepth <= 12;

  if (!treeDepthOk) {
    add('treeDepth', 'Initial Tree Depth must be a whole number between 1 and 12.');
  }

  if (
    config.maxTreeDepth !== undefined &&
    (!isInt(config.maxTreeDepth) ||
      (treeDepthOk && config.maxTreeDepth < config.treeDepth) ||
      config.maxTreeDepth < 1 ||
      config.maxTreeDepth > MAX_TREE_DEPTH_LIMIT)
  ) {
    add('maxTreeDepth', `Max Tree Depth must be a whole number between Initial Tree Depth and ${MAX_TREE_DEPTH_LIMIT}.`);
  }

  if (!Array.isArray(config.operators) || config.operators.length === 0) {
    add('operators', 'Select at least one operator.');
  }

  let points = [];
  let dataField = 'dataset';

  if (config.dataMode === 'dataset') {
    points = config.dataset || [];
    const variables = config.variables || ['x'];

    if (points.length < 2) {
      add('dataset', 'Upload a CSV dataset with at least 2 valid rows.');
    }

    if (
      !Array.isArray(variables) || variables.length < 1 ||
      variables.length > MAX_VARIABLES || !variables.every(v => IDENTIFIER.test(v))
    ) {
      add('dataset', `The dataset needs between 1 and ${MAX_VARIABLES} input columns.`);
    } else if (variables.length > 1 && !points.every(p => p.v && variables.every(n => Number.isFinite(p.v[n])))) {
      add('dataset', 'Every dataset row needs a numeric value for each input column.');
    }
  } else {
    dataField = 'targetFormula';
    const rangeOk = isNum(config.minX) && isNum(config.maxX) && config.minX < config.maxX;
    const countOk = isInt(config.sampleCount) && config.sampleCount >= 2 && config.sampleCount <= 10000;

    if (!rangeOk) {
      add('xRange', 'X Range minimum must be smaller than the maximum.');
    }

    if (!countOk) {
      add('sampleCount', 'Sample Points must be a whole number between 2 and 10000.');
    }

    // The formula is checked on its own; only its sampling needs a
    // usable range and point count.
    try {
      if (rangeOk && countOk) {
        points = generateFormulaSamples(
          config.targetFormula, config.minX, config.maxX, config.sampleCount
        );

        if (points.length < 2) {
          add('targetFormula', 'Formula produces fewer than 2 finite values in the X Range.');
        }
      } else {
        compileFormula(config.targetFormula);
      }
    } catch (e) {
      add('targetFormula', `Formula is invalid: ${e.message}`);
      points = [];
    }
  }

  if (points.length >= 2) {
    const y0 = points[0].y;

    if (points.every(p => p.y === y0)) {
      add(dataField, 'Target values are constant; R² is undefined for a constant target.');
    }
  }

  return errors;
}

// The problems of validateConfigFields, as messages only.
function validateConfig(config) {
  return validateConfigFields(config).map(e => e.message);
}

// Which of the evolvable operators (OP_ARITY) a target formula uses, so
// the page can point out operators that are not ticked. `unsupported`
// lists Math functions the formula calls that are not operators at all
// (such as abs), which a run can only approximate. A formula that does
// not parse gives empty lists; validation reports it.
//   formulaOperators('x*x + 2/x') -> { ops: ['*', '+', '/'], unsupported: [] }
// A leading minus (-x) needs no '-' operator: linear scaling and the
// constants can flip a sign.
function formulaOperators(formula) {
  const source = String(formula == null ? '' : formula);
  const tokens = [];

  try {
    checkFormulaSyntax(source);
  } catch (e) {
    return { ops: [], unsupported: [] };
  }

  FORMULA_TOKEN.lastIndex = 0;

  while (FORMULA_TOKEN.lastIndex < source.length) {
    const token = FORMULA_TOKEN.exec(source)[0];
    if (!/^\s+$/.test(token)) tokens.push(token);
  }

  const ops = [];
  const unsupported = [];
  const addTo = (list, item) => { if (!list.includes(item)) list.push(item); };
  const isOperand = (t) => t === ')' || /^[\w.$]/.test(t);

  // A small whole power (x**2, pow(x, 3)) is only repeated
  // multiplication, so it needs '*' rather than 'pow'.
  const smallPower = (t) => /^\d+$/.test(t || '') && Number(t) >= 2 && Number(t) <= 10;

  const powExponent = (open) => {
    let depth = 0;

    for (let j = open; j < tokens.length; j++) {
      if (tokens[j] === '(') depth++;
      else if (tokens[j] === ')') depth--;
      else if (tokens[j] === ',' && depth === 1) {
        return tokens[j + 2] === ')' ? tokens[j + 1] : null;
      }
    }

    return null;
  };

  tokens.forEach((token, i) => {
    const prev = tokens[i - 1];

    if (token === '**') {
      addTo(ops, smallPower(tokens[i + 1]) ? '*' : 'pow');
    } else if (token === '+' || token === '-') {
      if (prev !== undefined && isOperand(prev)) addTo(ops, token);
    } else if (token === '*' || token === '/') {
      addTo(ops, token);
    } else if (/^[A-Za-z_$]/.test(token) && tokens[i + 1] === '(') {
      const name = token.startsWith('Math.') ? token.slice(5) : token;

      if (name === 'pow' && smallPower(powExponent(i + 1))) addTo(ops, '*');
      else addTo(name in OP_ARITY ? ops : unsupported, name);
    }
  });

  return { ops, unsupported };
}

// Fill in settings added after a session was saved, and convert the
// old "minError" threshold on (1 - R²), so restored runs keep working.
function normalizeConfig(config) {
  const c = Object.assign({}, config || {});

  if (typeof c.targetR2 !== 'number' && typeof c.minError === 'number') {
    c.targetR2 = 1 - c.minError;
  }

  delete c.minError;

  if (typeof c.sampleCount !== 'number') {
    c.sampleCount = DEFAULT_SAMPLE_COUNT;
  }

  if (typeof c.maxTreeDepth !== 'number') {
    const d = typeof c.treeDepth === 'number' ? c.treeDepth : 4;
    c.maxTreeDepth = Math.min(MAX_TREE_DEPTH_LIMIT, Math.max(8, 2 * d));
  }

  if (typeof c.linearScaling !== 'boolean') {
    c.linearScaling = true;
  }

  // off by default: in benchmarks it did not improve results
  if (typeof c.constantOptimization !== 'boolean') {
    c.constantOptimization = false;
  }

  // formula mode always has the single variable x
  if (!Array.isArray(c.variables) || !c.variables.length || c.dataMode !== 'dataset') {
    c.variables = ['x'];
  }

  return c;
}

// =========================================================
// SHARE LINKS
// =========================================================
// Payload JSON -> deflate (when available) -> base64url.
// 'z' prefix = compressed, 'j' = plain JSON.

const SHARE_VERSION = 1;
const MAX_SHARED_POINTS = 2000;

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipeThrough(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

async function encodeShare(payload) {
  const json = new TextEncoder().encode(JSON.stringify({ v: SHARE_VERSION, ...payload }));

  if (typeof CompressionStream !== 'undefined') {
    const packed = await pipeThrough(json, new CompressionStream('deflate-raw'));
    return 'z' + bytesToBase64Url(packed);
  }

  return 'j' + bytesToBase64Url(json);
}

async function decodeShare(code) {
  const kind = code[0];
  let bytes = base64UrlToBytes(code.slice(1));

  if (kind === 'z') {
    bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'j') {
    throw new Error('unknown link format');
  }

  const payload = JSON.parse(new TextDecoder().decode(bytes));

  if (!payload || payload.v !== SHARE_VERSION) {
    throw new Error('unsupported link version');
  }

  return sanitizeShare(payload);
}

// Share links are untrusted input: keep only known, well-typed fields.
function sanitizeShare(payload) {
  const c = payload.config || {};
  const config = {};
  const numbers = [
    'minX', 'maxX', 'sampleCount', 'populationSize', 'targetR2',
    'maxGenerations', 'mutationRate', 'crossoverRate', 'elitismRate',
    'tournamentSize', 'treeDepth', 'maxTreeDepth'
  ];

  for (const k of numbers) {
    if (typeof c[k] === 'number' && Number.isFinite(c[k])) config[k] = c[k];
  }

  if (typeof c.targetFormula === 'string' && c.targetFormula.length <= 500) {
    config.targetFormula = c.targetFormula;
  }

  if (typeof c.targetName === 'string') {
    config.targetName = c.targetName.slice(0, 100);
  }

  if (c.speed === 'fast' || c.speed === 'slow') {
    config.speed = c.speed;
  }

  if (c.dataMode === 'formula' || c.dataMode === 'dataset') {
    config.dataMode = c.dataMode;
  }

  for (const k of ['linearScaling', 'constantOptimization']) {
    if (typeof c[k] === 'boolean') config[k] = c[k];
  }

  if (Array.isArray(c.operators)) {
    config.operators = c.operators.filter(op => OP_ARITY[op]);
  }

  let variables = ['x'];

  if (
    Array.isArray(c.variables) && c.variables.length >= 1 &&
    c.variables.length <= MAX_VARIABLES &&
    c.variables.every(v => typeof v === 'string' && IDENTIFIER.test(v)) &&
    new Set(c.variables).size === c.variables.length
  ) {
    variables = c.variables;
  }

  if (Array.isArray(c.dataset)) {
    const width = variables.length + 1;
    const rows = c.dataset
      .slice(0, MAX_SHARED_POINTS)
      .filter(p => Array.isArray(p) && p.length === width && p.every(Number.isFinite));

    config.variables = variables;
    config.dataset = variables.length === 1 ?
      rows.map(([x, y]) => ({ x, y })) :
      rows.map(r => {
        const v = {};
        variables.forEach((name, i) => { v[name] = r[i]; });
        return { v, y: r[width - 1] };
      });
  }

  const result = { config };

  const model = decompressTree(payload.model);

  if (model && isValidTree(model, config.variables || ['x'])) {
    result.model = model;
  }

  if (typeof payload.r2 === 'number') result.r2 = payload.r2;
  if (Number.isInteger(payload.generation)) result.generation = payload.generation;
  if (typeof payload.datasetOmitted === 'boolean') result.datasetOmitted = payload.datasetOmitted;
  if (typeof payload.fileName === 'string') result.fileName = payload.fileName.slice(0, 200);

  return result;
}

// Build a share payload from a run. Datasets are packed as [x, y]
// pairs and left out when too large for a link.
function buildSharePayload({ config, model, r2, generation, fileName }) {
  const { dataset, ...rest } = config;
  const payload = { config: rest, r2, generation };

  if (model) {
    payload.model = compressTree(model);
  }

  if (config.dataMode === 'dataset') {
    const variables = config.variables || ['x'];

    if ((dataset || []).length <= MAX_SHARED_POINTS) {
      payload.config.dataset = variables.length === 1 ?
        dataset.map(p => [p.x, p.y]) :
        dataset.map(p => [...variables.map(n => p.v[n]), p.y]);
    } else {
      payload.datasetOmitted = true;
    }

    payload.fileName = fileName;
  }

  return payload;
}

// =========================================================
// CHARTS
// =========================================================
// The geometry of the fit and progress charts drawn in app.js, kept as
// plain functions so it can be tested without a canvas.

// The charts' colours come from the theme: each role is a CSS custom
// property on <html>, the same ones the charts' caption keys use, so the
// lines and points always match their keys. The canvas background is
// --chart-bg (see style.css).
const CHART_COLOR_TOKENS = {
  data: '--key-cyan',    // data points
  model: '--key-red',    // best program, perfect-prediction diagonal
  median: '--key-grey',  // median program on the progress chart
  target: '--key-green', // dashed target R² line
  replay: '--key-blue',  // replay position on the progress chart
  grid: '--chart-grid',
  frame: '--chart-frame',
  text: '--chart-text'
};

// Used when a token is not defined (for example outside the page).
const CHART_COLOR_FALLBACKS = {
  data: '#00b7c7',
  model: '#ff5a5a',
  median: '#bbb',
  target: '#4c4',
  replay: '#6b9bff',
  grid: '#333',
  frame: '#555',
  text: '#aaa'
};

// The chart colours, resolving each token with `read(name)`, which
// returns the property's value or an empty string. In the page:
//   chartColors(name => getComputedStyle(document.documentElement).getPropertyValue(name))
function chartColors(read) {
  const colors = {};

  for (const [role, token] of Object.entries(CHART_COLOR_TOKENS)) {
    const value = String(read(token) || '').trim();
    colors[role] = value || CHART_COLOR_FALLBACKS[role];
  }

  return colors;
}

// The progress chart shows 1 - R² on a log scale from 1 (R² = 0) down to
// 10^PROGRESS_MIN_LOG (R² = 0.999999).
const PROGRESS_MIN_LOG = -6;

// The smallest and largest of `values`, widened by 1 either way when
// they are equal, so a scale over the range never divides by zero.
function valueRange(values) {
  let min = Infinity;
  let max = -Infinity;

  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (min === max) {
    min -= 1;
    max += 1;
  }

  return { min, max };
}

// Maps [min, max] linearly onto [from, to] (to may be below from, as
// for a y axis that grows upwards on screen).
function linearScale(min, max, from, to) {
  return (v) => from + ((v - min) / (max - min)) * (to - from);
}

// The indices drawn when about `maxCount` of `count` items are shown:
// evenly spread, always starting with the first. Floating-point steps
// can fit in one more than `maxCount`.
function sampleIndices(count, maxCount) {
  const step = Math.max(1, count / maxCount);
  const out = [];

  for (let i = 0; i < count; i += step) {
    out.push(Math.floor(i));
  }

  return out;
}

// The progress chart's height for an R²: log10(1 - R²), clamped to
// [minLog, 0]. A perfect fit (R² >= 1) sits on the bottom edge, and an
// R² that is not a number (or -Infinity) on the top edge.
function progressLevel(r2, minLog = PROGRESS_MIN_LOG) {
  const err = 1 - r2;
  const v = Number.isFinite(err) && err > 0 ? Math.log10(err) : (err <= 0 ? minLog : 0);

  return Math.min(0, Math.max(minLog, v));
}

// The progress chart's grid lines: R² = 0, 0.9, 0.99, … with labels.
function progressGrid(minLog = PROGRESS_MIN_LOG) {
  const lines = [];

  for (let k = 0; k >= minLog; k--) {
    const r2 = 1 - Math.pow(10, k);
    lines.push({ r2, label: `R² ${k === 0 ? '0' : r2.toFixed(-k)}` });
  }

  return lines;
}

// ---------- chart layout ----------
// The charts are drawn in CSS pixels at the size the page gives them
// (sharp on high-density screens), so their layout is computed here
// from the canvas size. The page and the browser tests share it.

const CHART_FONT = '12px sans-serif';

// The size (CSS px) a chart is drawn at for the width it has: half as
// tall as wide, but never so short that phones get an unreadable sliver.
function chartSize(width) {
  const w = Math.max(160, Math.round(Number(width) || 600));
  return { width: w, height: Math.round(Math.min(340, Math.max(240, w / 2))) };
}

// Round axis ticks covering [min, max]: steps of 1, 2 or 5 times a power
// of ten, at most about `maxCount` of them.
function niceTicks(min, max, maxCount = 6) {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [];

  const rough = (max - min) / Math.max(1, maxCount);
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map(m => m * power).find(s => s >= rough);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks = [];

  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(decimals)) || 0);
  }

  return ticks;
}

// A tick label: short, with no floating-point noise.
function formatTick(value) {
  const a = Math.abs(value);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return value.toExponential(1).replace('e+', 'e');
  return String(Number(value.toPrecision(6)));
}

// [min, max] widened by `fraction` of its span on both sides, so points
// at the extremes are not drawn on the frame.
function paddedRange({ min, max }, fraction = 0.04) {
  const pad = (max - min) * fraction;
  return { min: min - pad, max: max + pad };
}

// The fit chart (one input): data and best program over x.
function fitGeometry(xRange, yRange, width, height) {
  const plot = { left: 62, top: 12, right: width - 14, bottom: height - 42 };
  const xr = paddedRange(xRange);
  const yr = paddedRange(yRange);

  return {
    plot,
    xRange: xr,
    yRange: yr,
    toX: linearScale(xr.min, xr.max, plot.left, plot.right),
    toY: linearScale(yr.min, yr.max, plot.bottom, plot.top),
    xTicks: niceTicks(xr.min, xr.max, Math.max(3, Math.floor((plot.right - plot.left) / 70))),
    yTicks: niceTicks(yr.min, yr.max, Math.max(3, Math.floor((plot.bottom - plot.top) / 40)))
  };
}

// The predicted-against-actual chart (several inputs): a square plot
// with the same scale on both axes, centred in the width.
function predictedGeometry(range, width, height) {
  const margin = { left: 62, top: 12, right: 14, bottom: 42 };
  const size = Math.max(10, Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom));
  const left = margin.left + Math.max(0, (width - margin.left - margin.right - size) / 2);
  const plot = { left, top: margin.top, right: left + size, bottom: margin.top + size };
  const r = paddedRange(range);
  const ticks = niceTicks(r.min, r.max, Math.max(3, Math.floor(size / 50)));

  return {
    plot,
    range: r,
    toX: linearScale(r.min, r.max, plot.left, plot.right),
    toY: linearScale(r.min, r.max, plot.bottom, plot.top),
    ticks
  };
}

// The progress chart: generations across, log-scaled 1 - R² down.
function progressGeometry(maxGeneration, width, height) {
  const plot = { left: 84, top: 12, right: width - 12, bottom: height - 30 };
  const maxG = Math.max(maxGeneration, 2);
  const level = linearScale(0, PROGRESS_MIN_LOG, plot.top, plot.bottom);

  return {
    plot,
    maxG,
    toX: linearScale(1, maxG, plot.left, plot.right),
    toY: (r2) => level(progressLevel(r2))
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CHART_COLOR_TOKENS,
    CHART_COLOR_FALLBACKS,
    chartColors,
    PROGRESS_MIN_LOG,
    valueRange,
    linearScale,
    sampleIndices,
    progressLevel,
    progressGrid,
    CHART_FONT,
    chartSize,
    niceTicks,
    formatTick,
    paddedRange,
    fitGeometry,
    predictedGeometry,
    progressGeometry,
    OP_ARITY,
    DEFAULT_SAMPLE_COUNT,
    MAX_TREE_DEPTH_LIMIT,
    MAX_SHARED_POINTS,
    MAX_VARIABLES,
    compileFormula,
    generateFormulaSamples,
    evaluateTree,
    pointInput,
    isVariable,
    treeVariables,
    treeSize,
    treeDepth,
    treeToString,
    compressTree,
    decompressTree,
    isValidTree,
    scaledTree,
    simplifyTree,
    toInfix,
    toLatex,
    exportProgram,
    variableNames,
    parseCsv,
    datasetFromTable,
    validateConfig,
    validateConfigFields,
    formulaOperators,
    normalizeConfig,
    encodeShare,
    decodeShare,
    buildSharePayload
  };
}
