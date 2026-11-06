<p align="center"><img src="assets/logo-mark.svg" width="96" height="96" alt="EquVolve logo: an expression tree shaped like a V"></p>

# EquVolve

*Watch equations evolve.* EquVolve (pronounced **EK-yoo-volve**) joins *equation* and *evolve*.

**A zero-install, in-browser symbolic regression playground.** Give it a formula or a CSV of data and watch Genetic Programming (GP) evolve a mathematical expression that explains the data, live, with the curve fit and expression tree on screen as it happens.

It is built for **learning and exploring** how GP works, with light practical use (fitting a formula to a small dataset) as a secondary goal. Everything runs locally in your browser; there is no backend and your data never leaves your machine.

- Live demo: [bowo-prasetyo.github.io/equvolve](https://bowo-prasetyo.github.io/equvolve/#/)
- Repository: [github.com/bowo-prasetyo/equvolve](https://github.com/bowo-prasetyo/equvolve)

---

## What it does

- **Two data sources:** sample a target formula over an X range, or upload a CSV dataset.
- **Several input variables:** a CSV may have up to 10 input columns; pick which column to predict.
- **Live evolution** in a Web Worker, so the page stays responsive. Fast mode runs many generations between screen updates; slow mode shows every generation.
- **Replay:** step or play through every improvement of a run, watching the formula, fit and tree change.
- **Readable results:** the best program is simplified before it is shown (`(2.469 + ((-2.507 + x*x) - -1.712))` becomes `pow(x, 2) + 1.674`), drawn as an expression tree, and plotted over the data.
- **Progress chart:** the best and median fit of every generation, on a log scale, against your target.
- **Export:** copy the best program as a formula, JavaScript, Python or LaTeX.
- **Share links:** one click copies a link containing the settings, the data (up to 2,000 points) and the best program.
- **Linear scaling** (on by default): evolution only has to find the *shape* of the data; the best offset and scale are fitted exactly.
- **Configurable search:** population, generations, target R², crossover / mutation / elitism rates, tournament size, tree depths, and 23 operators with presets.
- **Light and dark themes:** follows your device's setting by default; the button in the top bar switches between Auto, Light and Dark, and the choice is remembered in this browser.
- **Pause, resume and restore:** stop a run, change settings, and resume. The session is checkpointed to IndexedDB, so it survives closing the tab or restarting the browser.
- **Input validation:** invalid formulas, ranges or settings are reported before a run starts.

---

## Quick start

1. Open the [live demo](https://bowo-prasetyo.github.io/equvolve/#/).
2. Keep the default target `x*x + 2` and press **Start Evolution**. It is solved in the first generation.
3. Now try something harder: set the formula to `sin(x) * exp(x/3)`, pick the **Everything** operator preset and press **Start Evolution**. Watch the progress chart fall towards the dashed target line.
4. When it stops, press **▶ Replay** to watch how the formula improved over the run.

---

## How to use

### 1. Choose a data source

**Generate from formula:** enter a target formula and an X range.

- Formulas are arithmetic expressions in `x`. Every name on JavaScript's `Math` is available, so `sin(x)`, `pow(x, 2)`, `exp(-x*x)`, `abs(x)` and `PI * x` work, as does `Math.sin(x)`.
- Nothing else is allowed (no other names, strings, brackets or statements). This keeps formulas from shared links safe to open.
- Because results use the same syntax, you can paste a result back in as a new target.
- **Sample points** (default 101) are spaced evenly across the X range. The engine trains on exactly these points, and the graph plots exactly these points.
- Points where the formula is not finite (for example `1/x` at `x = 0`) are skipped.

**Upload dataset:** upload a CSV with numeric columns, usually with a header row:

```csv
height,width,depth,price
1.5,4.4,4.1,27.4
2.0,3.0,2.8,22.7
```

- One column is the **target** to predict: the last one by default. With three or more columns, a **Target column** menu lets you choose another.
- Every other column becomes an **input variable** (up to 10), named after its header. Names are cleaned to letters, digits and `_`, so `Height (cm)` becomes `Height_cm`, and a name that clashes with a function or keyword gets a `v_` prefix.
- With a **single input**, the variable is called `x` and the graph plots the data with the fitted curve. With **several inputs** the graph plots each row's prediction against its actual value.
- Commas, semicolons and tabs all work as separators. A first row that is all numbers is treated as data, and the columns are called `x1`, `x2`, … and `y`.
- Rows with missing or non-numeric values are ignored. Every valid row is used for training.

### 2. Configure the run

Every setting has a short explanation under it in the app.

| Setting            | Meaning                                                                                       | Default |
| ------------------ | --------------------------------------------------------------------------------------------- | ------- |
| Population Size    | Programs per generation (constant for the whole run)                                          | 200     |
| Max Generations    | Stop after this many generations                                                              | 500     |
| Target R²          | Stop as soon as the best program reaches this R² (1 = perfect fit)                            | 0.999   |
| Crossover Rate     | Probability that an offspring is made by subtree crossover rather than copying a parent        | 0.7     |
| Mutation Rate      | Probability that an offspring is then mutated                                                 | 0.1     |
| Elitism Rate       | Fraction of the best programs copied unchanged into the next generation                       | 0.05    |
| Tournament Size    | Programs compared in each selection tournament; larger is greedier                            | 5       |
| Initial Tree Depth | Maximum depth of the random programs that start the run (1–12)                                | 4       |
| Max Tree Depth     | Hard depth limit for evolved programs, to stop them bloating (up to 17)                       | 8       |
| Linear scaling     | Score each program as `a + b·f(x)` with the best-fitting `a` and `b`                          | on      |
| Constant optimisation | Experimental: fine-tune the constants of a random 10% of programs each generation. It did not improve results in our benchmark (see [How it works](#constant-optimisation-experimental)). | off |
| Speed              | **Fast:** as many generations as fit in about 40 ms between screen updates. **Slow:** one generation per update, about 6 per second, for watching. | Fast |
| Operators          | The building blocks the search may use                                                        | `+ - *` |

The defaults were checked with the benchmark described under [Example results](#example-results). Crossover 0.8, mutation 0.2 and elitism 0.02 did slightly worse on the harder targets.

**Operator presets:** Polynomial (`+ - *`), Rational (adds `/`), Trigonometric (adds `sin cos`), Exp / Log (adds `exp log`) and Everything.

All operators:

- Binary: `+`, `-`, `*`, `/`, `pow`
- Unary: `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `log` (natural log), `log2`, `log10`, `exp`, `sqrt`, `cbrt`

### 3. Run, stop, resume

| State   | Buttons                                              | Notes                                            |
| ------- | ---------------------------------------------------- | ------------------------------------------------ |
| idle    | **Start Evolution**                                  | Settings are editable.                           |
| running | **Running…** (disabled), **Stop**                    | Settings are locked.                             |
| paused  | **Clear Results**, **Resume**, **Copy share link**   | Settings are editable; Resume applies changes.   |

A run pauses on its own when it reaches the target R² or Max Generations, and a status message says which. To keep going after hitting Max Generations, raise it and press **Resume**.

**Clear Results** stops the worker, clears the results, and deletes the stored session.

### 4. Read the results

- **Best program:** the simplified formula. The tabs switch between a plain formula, JavaScript (`const f = (x) => …`), Python (`def f(x): …` using `math`) and LaTeX. With several inputs the function takes them as parameters, for example `(height, width, depth) => …`. **Copy** puts the current tab on the clipboard. Exported code keeps 12 significant digits; the on-screen formula shows 5.
- **Replay:** after a run (or while paused), **▶ Replay** plays through every improvement of the best program, and the slider jumps to any of them. The formula, export, fit chart and tree all follow the replay; the progress chart marks its generation in blue. **Back to latest** returns to the current best.
- **Fit:** with one input, the data (cyan) and the best program (red). With several inputs, predicted against actual values for each row; points on the red diagonal are predicted exactly.
- **Progress:** 1 − R² of the best (red) and median (grey) program in each generation, on a log scale, so the step from R² 0.99 to 0.9999 is as visible as the step from 0 to 0.9. The dashed green line is your target.
- **Expression tree:** orange operators, green variables, khaki constants. It scales to fit the page.
- **Program size:** the number of nodes in the program as shown.
- **Speed:** generations per second.

### 5. Share a run

After a run, **Copy share link** copies a link to this page that contains the settings, the dataset (if it has at most 2,000 points) and the best program. Opening it loads them, ready to run, without touching the visitor's own saved session. The population is not included, so the recipient starts a new run rather than continuing yours.

### 6. Restore after closing the browser

On load, if a stored session exists, the app asks whether to restore it. A restored session comes back paused with its population, generation, best program, progress chart, replay timeline, settings and dataset. Press **Resume** to continue.

---

## How it works

### Representation

Programs are expression trees. Leaves are input variables (`x`, or the dataset's column names) or random constants drawn from [-10, 10]. Internal nodes are the enabled operators.

The first generation is created with *ramped half-and-half*: depths 2 up to Initial Tree Depth, half of them "full" (every branch to the maximum depth) and half "grow" (branches may stop early), so it starts with a wide variety of shapes.

### Fitness

Each program `f` is evaluated on every training point and scored by R², the fraction of the data's variance it explains.

With **linear scaling** (Keijzer, 2003), the program is scored as `a + b·f(x)`, where `a` and `b` are the least-squares best fit, computed exactly for each program. Evolution only needs to find the right shape; it never has to stumble onto the right offset and scale by mutating constants. The reported program includes `a` and `b`, folded into its own constants by the simplifier.

```
fitness = (1 − R²) + 0.001 × (number of nodes)
```

The small size penalty discourages bloat. A program that produces a non-finite value (for example division by zero) on any training point gets infinite fitness. R² is undefined for a constant target, so constant targets are rejected up front.

### Each generation

1. Sort the population by fitness. If constant optimisation is on, optimise a random 10% of programs first (see below). Record the best and median R² for the progress chart, and add the best program to the replay timeline if it changed.
2. Stop if the best R² ≥ Target R², or the generation limit is reached.
3. Build the next generation of exactly *Population Size* programs:
   - **Elites:** the top *Elitism Rate* fraction, copied unchanged.
   - **Immigrants:** 10% brand-new random programs, to maintain diversity.
   - **Offspring:** the rest. Each picks a parent by tournament selection. With probability *Crossover Rate* a random subtree of that parent is replaced by a random subtree of a second parent (90% of the time an operator node is chosen, so crossover moves real structure). Children deeper than Max Tree Depth are rejected and retried. Then, with probability *Mutation Rate*, the child is mutated.
4. Mutation is either:
   - **subtree mutation:** a random subtree is replaced by a new random one; or
   - **point mutation:** one node changes. An operator becomes another of the same arity, `x` becomes a constant or vice versa, or a constant is nudged by a coarse, medium or fine step (about ±1, ±0.1 or ±0.01 of its size), so constants can be both moved and fine-tuned.

### Constant optimisation (experimental)

Linear scaling fits a program's outer offset and scale, but not constants inside functions, like the `1/3` in `exp(x/3)`. When enabled, constant optimisation tunes them with a short (1+1) evolution strategy:

1. All of a program's constants are perturbed with Gaussian noise.
2. The change is kept if fitness improves.
3. Each constant's step size grows after a success and shrinks after a failure.

The improved constants are written back into the population. Each generation, a random 10% of programs each get 10 steps.

**It is off by default because it did not help.** On the three targets with constants inside non-linear functions (20 runs each; R² ≥ 0.999 within 200 generations):

| Strategy                                   | Reached | Time  |
| ------------------------------------------ | ------- | ----- |
| Off                                        | **31 / 60** | **298 s** |
| Random 10% of programs, 10 steps each      | 26 / 60 | 912 s |
| Best program only, 20 steps                | 21 / 60 | 418 s |
| Best 3 programs, 20 steps                  | 17 / 60 | –     |

Polishing the best programs' constants makes them win most tournaments, so the population loses diversity and stalls. The random strategy harms least but triples the run time. A method that keeps diversity, such as optimising constants only when the search stagnates, remains future work.

### Speed

In **Fast** mode the worker runs generations back to back for about 40 ms, then sends one update covering all of them. Every generation is still added to the progress chart and replay. The full population, needed only for checkpoints, is sent every 10 generations, on Stop and on finish. This replaces Phase 2's fixed 50 ms pause per generation, which capped runs at about 20 generations per second. A population of 200 now runs at roughly 60–100 generations per second in a typical browser, depending on the operators. **Slow** mode sends every generation with a 150 ms pause.

### Simplification

Before a program is shown or exported it is simplified:

- constants are folded;
- like terms are collected (`x + x` becomes `2 * x`, `x * x` becomes `pow(x, 2)`);
- constants are distributed over sums;
- factors cancel across divisions (`(u / v) * v` becomes `u`);
- identities such as `u * 1`, `u - u`, `u / u` and `pow(u, 1)` are removed.

The simplified program is then checked against the original on every training point and only used if it computes the same values. The search itself works on the unsimplified programs.

### Persistence

Sessions are stored in the browser's IndexedDB (`gp-db`; the name predates EquVolve and is kept so older sessions still restore):

- `sessions` holds a single checkpoint of the latest run: settings, dataset, generation, the whole population (trees stored as compact nested arrays), the best program, recent history, the progress chart and the replay timeline (up to 300 snapshots). It is written whenever the best fitness improves, at least every 10 generations, and on Stop, finish, or page unload.
- `bestPrograms` keeps a log of each new best program. It is not shown in the UI yet.

Everything stays in your browser; clearing site data deletes it.

### Known limitations

- **Constants inside non-linear functions** (the `1/3` in `exp(x/3)`) are found by mutation alone, so these targets are solved less reliably than in Phase 1; see [Example results](#example-results). The experimental constant optimisation did not fix this.
- **Formula mode has one variable** (`x`); several variables need a CSV.
- **The simplifier is algebraic only.** It does not know trigonometric or logarithmic identities, and it does not factor expressions.
- **The replay keeps up to 300 snapshots.** In longer runs, intermediate improvements are thinned out; the first and latest are always kept.

---

## Example results

`npm run bench` measures how often the engine reaches R² ≥ 0.999 within 200 generations, using the default settings, population 200, and x in [-3, 3]. Each target is run 20 times. GP is stochastic, so your runs will differ, and a difference of a few runs out of 20 is within noise.

| Target              | Operators         | Phase 1 | Phase 2 | This version | Median generations | Example result (this version)                         |
| ------------------- | ----------------- | ------- | ------- | ------------ | ------------------ | ----------------------------------------------------- |
| `x*x*x - 2*x + 1`   | `+ - *`           | 6       | 20      | **20**       | 9                  | `pow(x, 3) - 2 * x + 1`                               |
| `3*x*x + 2`         | `+ - *`           | 17      | 20      | **20**       | 1                  | `3 * pow(x, 2) + 2`                                   |
| `x*x + 2/x`         | `+ - * /`         | 19      | 20      | **20**       | 14                 | `0.9716 * pow(x, 2) + 2.0113 / x + 0.087772`          |
| `exp(-x*x/2)`       | `+ - * / exp`     | **19**  | 11      | 13           | 22                 | `0.99343 * exp(-0.54735 * pow(x, 2)) + 0.020478`      |
| `sin(x) + sin(x*x)` | `+ - * / sin cos` | **15**  | 12      | 12           | 19                 | `sin(x) + sin(pow(x, 2))`                             |
| `sin(x) * exp(x/3)` | `+ - * / sin exp` | **7**   | 5       | 3            | 12                 | `1.0273 * exp(0.30728 * x) * sin(x) + 0.023183`       |
| **Total (of 120)**  |                   | 83      | 88      | **88**       |                    |                                                       |

What this shows:

- **Polynomial and rational targets are solved every time** (60/60, against 42/60 in Phase 1), usually within a handful of generations. Linear scaling and subtree crossover do the work here.
- **Targets with a constant inside a non-linear function** (the `1/2` in `exp(-x*x/2)`, the `1/3` in `exp(x/3)`) are solved less often than in Phase 1 (28/60, against 41/60). Phase 1 nudged every constant in every offspring, which happened to suit these targets. The experimental [constant optimisation](#constant-optimisation-experimental) did not close this gap.
- **This version searches exactly like Phase 2** (constant optimisation is off by default), so per generation the results match within noise. It is faster per second: generations are batched instead of paused 50 ms each.
- Even when a run misses the strict target, it usually finds an R² above 0.99. The examples show near misses that have the right shape with slightly wrong constants, such as `exp(0.307x)` for `exp(x/3)`.

## Running locally

```bash
git clone https://github.com/bowo-prasetyo/equvolve.git
cd equvolve
python3 -m http.server 8000
```

Then open <http://localhost:8000>. A local web server is needed because browsers do not allow Web Workers to load from `file://` pages. There is no build step.

### Tests

The engine and shared helpers (simplifier, exporters, CSV parsing, share links, formula checks) have a headless test suite that runs the real `worker.js` in Node (version 18 or later), with no browser and no dependencies:

```bash
npm test
```

Tests run on every push and pull request via GitHub Actions.

### Project structure

| File            | Purpose                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `index.html`    | Page shell; loads pinned versions of Vue, Vue Router and Marked from jsDelivr                 |
| `shared.js`     | Code shared by UI and engine: evaluation, formula sampling and checks, simplification, export, share links, config validation |
| `worker.js`     | The GP engine (runs in a Web Worker)                                                           |
| `app.js`        | Vue UI: inputs, visualisation, persistence, About page                                        |
| `style.css`     | Styles                                                                                        |
| `test/`         | Headless Node tests (`node:test`)                                                             |
| `bench/`        | `npm run bench`: how often the engine reaches R² ≥ 0.999 on six targets                       |
| `assets/`       | Logo: `logo-mark.svg` (the icon), and `logo-on-dark.svg` / `logo-on-light.svg` (icon with the EquVolve wordmark) |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | Browser and home-screen icons |

The About page renders this README, fetched live from the `main` branch.

---

## Roadmap

**Done**

- Phase 1, restore trust: engine bug fixes, input validation, tests and CI, accurate documentation.
- Phase 2, a great core loop: subtree crossover and mutation with a depth limit, linear scaling, simplification, progress chart, operator presets, export, share links, and a workflow-ordered layout.
- Phase 3: multi-variable regression, animated replay, batched generations for speed, and experimental constant optimisation (off by default, with the benchmark that justifies it).

**Next**

- Constant optimisation that keeps population diversity, for example applied only when the search stagnates, or to offspring before they compete
- Train/test split for datasets, so users can see whether a formula generalises
- Upload a CSV and fit only some of its columns

**Research ideas (not planned):** strongly typed GP, automatically defined functions, grammar-guided GP, semantic GP, multi-objective GP, island models (including across browsers via WebRTC), WASM/GPU acceleration, neural-GP hybrids, and full program synthesis with control flow.

---

## License

MIT. See [LICENSE](LICENSE).

## Assisted by

[ChatGPT](https://chatgpt.com/) and [Claude Code](https://claude.com/claude-code).
