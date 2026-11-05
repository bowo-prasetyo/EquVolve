# Browser Genetic Programming

**A zero-install, in-browser symbolic regression playground.** Give it a formula or a CSV of `x,y` points and watch Genetic Programming (GP) evolve a mathematical expression that explains the data, live, with the curve fit and expression tree on screen as it happens.

It is built for **learning and exploring** how GP works, with light practical use (fitting a formula to a small dataset) as a secondary goal. Everything runs locally in your browser; there is no backend and your data never leaves your machine.

- Live demo: [bowo-prasetyo.github.io/genetic-programming](https://bowo-prasetyo.github.io/genetic-programming/#/)
- Repository: [github.com/bowo-prasetyo/genetic-programming](https://github.com/bowo-prasetyo/genetic-programming)

---

## What it does

- **Two data sources:** sample a target formula over an X range, or upload a CSV dataset.
- **Live evolution** in a Web Worker, so the page stays responsive.
- **Live visualisation:** data points and the best program's curve on a canvas, plus the best program drawn as an expression tree.
- **Configurable search:** population size, generations, target R², mutation / crossover / elitism rates, tournament size, tree depth, and 23 selectable operators.
- **Pause, resume and restore:** stop a run, change parameters, and resume it. The session is checkpointed to IndexedDB, so it can be restored after closing the tab or restarting the browser.
- **Input validation:** invalid formulas, ranges or parameters are reported before a run starts.

---

## Quick start

1. Open the [live demo](https://bowo-prasetyo.github.io/genetic-programming/#/).
2. Keep the default target `x*x + 2` and press **Start Evolution**.
3. Watch the red curve converge onto the cyan points, then try a harder target such as `sin(x) * exp(x/3)` with `sin` and `exp` enabled.

---

## How to use

### 1. Choose a data source

**Generate From Formula:** enter a target formula and an X range.

- Formulas are JavaScript expressions in `x`. Math functions and constants are in scope, so `sin(x)`, `pow(x, 2)`, `exp(-x*x)` and `PI * x` work, as does `Math.sin(x)`.
- Because evolved programs use the same syntax, you can paste a result back in as a new target.
- **Sample Points** (default 101) are spaced evenly across the X range. The engine trains on exactly these points, and the graph plots exactly these points.
- Points where the formula is not finite (for example `1/x` at `x = 0`) are skipped.

**Upload Dataset:** upload a CSV with a header row and two numeric columns:

```csv
x,y
-5,12
-4,7
-3,3
```

Rows that are not two finite numbers are ignored. Every valid row is used for training; the graph shows at most 30 of them to keep drawing fast.

### 2. Configure the run

| Parameter       | Meaning                                                                                  | Default |
| --------------- | ---------------------------------------------------------------------------------------- | ------- |
| Population Size | Individuals per generation (kept constant for the whole run)                             | 100     |
| Max Generations | Stop after this many generations                                                         | 1000    |
| Target R²       | Stop as soon as the best program's R² reaches this value (1 = perfect fit)               | 0.99    |
| Mutation Rate   | Per-node probability of mutation                                                         | 0.1     |
| Crossover Rate  | Probability that a child is produced by crossover rather than copying a parent           | 0.7     |
| Elitism Rate    | Fraction of the best individuals copied unchanged into the next generation               | 0.05    |
| Tournament Size | Individuals compared in each tournament selection                                        | 5       |
| Tree Depth      | Maximum depth of randomly generated trees (1–12)                                         | 4       |
| Operators       | The primitive set the search may use                                                     | `+ - *` |

Available operators:

- Binary: `+`, `-`, `*`, `/`, `pow`
- Unary: `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `log` (natural log), `log2`, `log10`, `exp`, `sqrt`, `cbrt`

### 3. Run, stop, resume

| State   | Buttons                       | Notes                                                    |
| ------- | ----------------------------- | -------------------------------------------------------- |
| idle    | **Start Evolution**           | Inputs are editable.                                     |
| running | **Running…** (disabled), **Stop** | Inputs are locked.                                   |
| paused  | **Clear Results**, **Resume** | Inputs are editable; Resume applies any changes.         |

A run pauses on its own when it reaches the target R² or Max Generations, and a status message says which. To keep going after hitting Max Generations, raise it and press **Resume**.

**Clear Results** stops the worker, clears the graph and history, and deletes the stored session.

### 4. Restore after closing the browser

On load, if a stored session exists, the app asks whether to restore it. A restored session comes back paused with its population, generation, best program, settings and dataset. Press **Resume** to continue.

---

## How it works

### Representation

Programs are expression trees. Leaves are the variable `x` or an ephemeral random constant (ERC) drawn from [-10, 10]. Internal nodes are the enabled operators.

### Fitness

Each program is scored on every training point:

```
fitness = (1 − R²) + 0.001 × (number of nodes)
```

R² rewards explaining the shape of the data rather than just its average, and the small size penalty discourages bloat. A program that produces a non-finite value (for example division by zero) on any training point gets infinite fitness. R² is undefined for a constant target, so constant targets are rejected up front.

### Each generation

1. Sort the population by fitness and report the best program.
2. Stop if the best R² ≥ Target R², or the generation limit is reached.
3. Build the next generation of exactly *Population Size* individuals:
   - **Elites:** the top *Elitism Rate* fraction, copied unchanged.
   - **Immigrants:** 10% brand-new random trees, to maintain diversity.
   - **Offspring:** the rest, bred by tournament selection followed by crossover (with probability *Crossover Rate*) and mutation.
4. Mutation can replace a subtree, swap an operator, or nudge a constant by up to ±1.

### Persistence

Sessions are stored in the browser's IndexedDB (`gp-db`):

- `sessions` holds a single checkpoint of the latest run: settings, dataset, generation, the whole population (trees stored as compact nested arrays), the best program and recent history. It is written whenever the best fitness improves, at least every 10 generations, and on Stop, finish, or page unload.
- `bestPrograms` keeps a log of each new best program. It is not shown in the UI yet.

Everything stays in your browser; clearing site data deletes it.

### Known limitations

These are honest constraints of the current engine, and most are on the roadmap:

- **Single input variable** (`x`) only.
- **Crossover is a simplified positional crossover**, not standard subtree crossover. It mixes parents node by node and is weak for trees containing unary operators.
- **Constants are found by mutation alone**, which can produce unwieldy expressions such as `(x * 4.211) * 0.712`.
- **Expressions are not simplified** before being shown.
- **Fixed 50 ms pause between generations**, so the UI can redraw. Long runs are therefore slower than the hardware allows.

---

## Example results

These were measured with the default settings (population 100, depth 4, Target R² 0.99, up to 300 generations). Each target was run 10 times with the operators listed. GP is stochastic, so your results will differ from run to run.

| Target          | Operators          | Reached R² ≥ 0.99 | Median generations | Example result                                      |
| --------------- | ------------------ | ----------------- | ------------------ | --------------------------------------------------- |
| `x*x + 2`       | `+ - *`            | 10 / 10           | 8                  | `(2.469 + ((-2.507 + (x * x)) - -1.712))`           |
| `sin(x)`        | `+ - * / sin`      | 10 / 10           | 1                  | `sin(x)`                                            |
| `exp(x/2)`      | `+ - * / exp`      | 9 / 10            | 49                 | `exp((x * ((-7.609 / 7.460) / (-6.082 + 4.068))))`  |
| `x*x + 2/x`     | `+ - * /`          | 7 / 10            | 31                 | `(x * (x - ((-1.611 / x) / x)))`                    |

The examples also show the "unsimplified constants" limitation: `(2.469 + (-2.507 + x*x) - -1.712)` is just `x*x + 1.674`.

To try a real dataset, export two columns as `x,y` from, for example, the [Salary dataset](https://www.kaggle.com/datasets/abhishek14398/salary-dataset-simple-linear-regression) or the [Student Scores dataset](https://www.kaggle.com/datasets/samira1992/student-scores-simple-dataset). Both are close to linear, so `+ - *` is enough.

---

## Running locally

```bash
git clone https://github.com/bowo-prasetyo/genetic-programming.git
cd genetic-programming
python3 -m http.server 8000
```

Then open <http://localhost:8000>. A local web server is needed because browsers do not allow Web Workers to load from `file://` pages. There is no build step.

### Tests

The engine and shared helpers have a headless test suite that runs the real `worker.js` in Node (version 18 or later), with no browser and no dependencies:

```bash
npm test
```

Tests run on every push and pull request via GitHub Actions.

### Project structure

| File            | Purpose                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `index.html`    | Page shell; loads pinned versions of Vue, Vue Router and Marked from jsDelivr                 |
| `shared.js`     | Code shared by UI and engine: expression evaluation, formula sampling, config validation      |
| `worker.js`     | The GP engine (runs in a Web Worker)                                                           |
| `app.js`        | Vue UI: inputs, visualisation, persistence, About page                                        |
| `style.css`     | Styles                                                                                        |
| `test/`         | Headless Node tests (`node:test`)                                                             |

The About page renders this README, fetched live from the `main` branch.

---

## Roadmap

**Next: make the core loop excellent**

- Standard subtree crossover and mutation with a size/depth limit
- Fit constants with linear scaling, so results like `9.6 * (... )` become clean
- Simplify expressions before displaying them
- Fitness-over-time chart and operator presets (Arithmetic, Trig, Exp/Log)
- Export the best program (JavaScript / Python / LaTeX) and share sessions by URL
- Settings above results; a tree view that scales to fit

**Later: one differentiator at a time**

- Multi-variable regression from multi-column CSVs
- Animated replay of a run, for teaching

**Research ideas (not planned):** strongly typed GP, automatically defined functions, grammar-guided GP, semantic GP, multi-objective GP, island models (including across browsers via WebRTC), WASM/GPU acceleration, neural-GP hybrids, and full program synthesis with control flow.

---

## License

MIT. See [LICENSE](LICENSE).

## Assisted by

[ChatGPT](https://chatgpt.com/) and [Claude Code](https://claude.com/claude-code).
