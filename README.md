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

- Formulas are arithmetic expressions in `x` using numbers, parentheses, commas and the operators `+ - * / % **`. Every name on JavaScript's `Math` is available, so `sin(x)`, `pow(x, 2)`, `exp(-x*x)`, `abs(x)` and `PI * x` work, as does `Math.sin(x)`.
- Nothing else is allowed (no other names, strings, square brackets or statements). This keeps formulas from shared links safe to open.
- Because results use the same syntax, you can paste a result back in as a new target.
- **Sample points** (default 101, from 2 to 10,000) are spaced evenly across the X range, both ends included. The engine trains on exactly these points. The graph draws the same points, thinned to about 60 markers when there are more.
- Points where the formula is not finite (for example `1/x` at `x = 0`) are skipped. At least two finite points are needed.

**Upload dataset:** upload a CSV with numeric columns, usually with a header row:

```csv
height,width,depth,price
1.5,4.4,4.1,27.4
2.0,3.0,2.8,22.7
```

- One column is the **target** to predict: the last one by default. With three or more columns, a **Target column** menu lets you choose another.
- Every other column becomes an **input variable**, named after its header. Only the first 10 input columns are used; any after that are ignored. Names are cleaned to letters, digits and `_`, so `Height (cm)` becomes `Height_cm`. A name that starts with a digit, or clashes with a `Math` name or a JavaScript or Python keyword, gets a `v_` prefix (`sin` becomes `v_sin`). Repeated names get `_2`, `_3`, … appended.
- With a **single input**, the variable is called `x` and the graph plots the data with the fitted curve. With **several inputs** the graph plots each row's prediction against its actual value (up to 400 rows are drawn).
- Commas, semicolons and tabs all work as separators, and can be mixed. Quoted cells are unquoted, but a quoted cell cannot contain a separator. A first row that is all numbers is treated as data, and the columns are called `x1`, `x2`, … and `y`.
- Rows with too few cells, an empty cell (as in `1.5,,3`) or a non-numeric value are skipped, and cells beyond the header's width are ignored. Every other row is used for training.

### 2. Configure the run

Every setting has a short explanation under it in the app.

| Setting            | Meaning                                                                                       | Default |
| ------------------ | --------------------------------------------------------------------------------------------- | ------- |
| Population Size    | Programs per generation (constant for the whole run; at least 2)                              | 200     |
| Max Generations    | Stop after this many generations                                                              | 500     |
| Target R²          | Stop as soon as the best program reaches this R² (1 = perfect fit; at most 1)                 | 0.999   |
| Crossover Rate     | Probability (0–1) that an offspring is made by subtree crossover rather than copying a parent  | 0.7     |
| Mutation Rate      | Probability (0–1) that an offspring is then mutated                                           | 0.1     |
| Elitism Rate       | Fraction (0–1) of the best programs copied unchanged into the next generation                 | 0.05    |
| Tournament Size    | Programs compared in each selection tournament (at least 1); larger is greedier               | 5       |
| Initial Tree Depth | Maximum depth of the random programs that start the run (1–12)                                | 4       |
| Max Tree Depth     | Hard depth limit for evolved programs, to stop them bloating (from Initial Tree Depth to 17)  | 8       |
| Linear scaling     | Score each program as `a + b·f(x)` with the best-fitting `a` and `b`                          | on      |
| Constant optimisation | Experimental: fine-tune the constants of a random 10% of programs each generation. It did not improve results in our benchmark (see [How it works](#constant-optimisation-experimental)). | off |
| Speed              | **Fast:** as many generations as fit in about 40 ms per screen update. **Slow:** one generation per update with a 150 ms pause (at most about 6 per second), for watching. | Fast |
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

**Copy share link** appears whenever a best program is shown and no run is going, including in the idle state after you open a share link. Settings are checked when you press **Start Evolution** or **Resume**, and any problems are listed above the buttons.

A run pauses on its own when it reaches the target R² or Max Generations, and a status message says which. To keep going after hitting Max Generations, raise it and press **Resume**.

**Clear Results** asks for confirmation, then stops the worker, clears the results, and deletes the stored session and the best-program log (see [Persistence](#persistence)).

### 4. Read the results

- **Best program:** the simplified formula. The tabs switch between a plain formula, JavaScript (`const f = (x) => …`), Python (`def f(x): …` using `math`) and LaTeX. With several inputs the function takes them as parameters, for example `(height, width, depth) => …`. **Copy** puts the current tab on the clipboard. The JavaScript and Python exports keep 12 significant digits; the formula and LaTeX tabs, like the on-screen formula, show 5. Python writes powers as `**`, and a program that uses `cbrt` gets a comment that `math.cbrt` needs Python 3.11 or later.
- **Replay:** after a run (or while paused), **▶ Replay** plays through every improvement of the best program, and the slider jumps to any of them. The formula, export, fit chart and tree all follow the replay; the progress chart marks its generation in blue. **Back to latest** returns to the current best.
- **Fit:** with one input, the data (cyan) and the best program (red). With several inputs, predicted against actual values for each row; points on the red diagonal are predicted exactly.
- **Progress:** 1 − R² of the best (red) and median (grey) program in each generation, on a log scale, so the step from R² 0.99 to 0.9999 is as visible as the step from 0 to 0.9. The axis runs from 1 − R² = 1 down to 10⁻⁶, and values outside that range are drawn at the edge. The dashed green line is your target.
- **Expression tree:** orange operators, green variables, khaki constants. It scales to fit the page.
- **Program size:** the number of nodes in the program as shown.
- **Speed:** generations per second, smoothed.
- **Recent generations:** the best program from each of the last five screen updates, newest first. In Fast mode one update covers many generations.

### 5. Share a run

After a run, **Copy share link** copies a link to this page that contains the settings, the uploaded dataset (if it has at most 2,000 rows) and the best program. In formula mode the link carries the formula, not the sampled points. If the dataset is larger, the link leaves it out and the recipient is asked to upload it. The link is also shown in a text box below the buttons, so it can be copied by hand if the clipboard is unavailable.

Opening a link loads its contents, ready to run. It does not offer to restore the visitor's own saved session, and it leaves that session alone until the visitor starts a run. The population is not included, so the recipient starts a new run rather than continuing yours.

### 6. Restore after closing the browser

On load, if a stored session exists, the app asks (in a browser confirmation dialog) whether to restore it. A restored session comes back paused with its population, generation, best program, recent generations, progress chart, replay timeline, settings and dataset. Press **Resume** to continue. Declining keeps the stored session; it is replaced when the next run saves a checkpoint.

---

## How it works

### Representation

Programs are expression trees. Leaves are input variables (`x`, or the dataset's column names) or random constants drawn uniformly from [-10, 10] with three decimals; a new leaf is a variable or a constant with equal probability. Internal nodes are the enabled operators. A leaf has depth 0.

The first generation is created with *ramped half-and-half*: depths 2 up to Initial Tree Depth (just 1 if Initial Tree Depth is 1), half of them "full" (every branch to the maximum depth) and half "grow" (branches may stop early), so it starts with a wide variety of shapes.

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
   - **Offspring:** the rest. Each picks a parent by tournament selection. With probability *Crossover Rate* a random subtree of that parent is replaced by a random subtree of a second parent (90% of the time an operator node is chosen, so crossover moves real structure). A child deeper than Max Tree Depth is rejected and the crossover retried; after 5 failed attempts the first parent is copied instead. Otherwise the parent is copied unchanged. Then, with probability *Mutation Rate*, the child is mutated.
4. Mutation is, with equal probability, either:
   - **subtree mutation:** a random node is replaced by a new random "grow" subtree, no deeper than Initial Tree Depth and never pushing the program past Max Tree Depth; or
   - **point mutation:** one random node changes. An operator becomes another enabled operator of the same arity (if there is one). A constant is usually (70% of the time) nudged by a random coarse, medium or fine step (up to ±1×, ±0.1× or ±0.01× its size; sizes below 1 count as 1), so constants can be both moved and fine-tuned. Any other leaf is replaced by a new random leaf: a variable or a constant.

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

In **Fast** mode the worker runs generations back to back for about 40 ms, then sends one update covering all of them and pauses for 5 ms. Every generation is still added to the progress chart and replay (subject to the limits under [Known limitations](#known-limitations)). The full population, needed only for checkpoints, is sent every 10 generations, on Stop and on finish. This replaces Phase 2's fixed 50 ms pause per generation, which capped runs at about 20 generations per second. A population of 200 now runs at roughly 60–100 generations per second in a typical browser, depending on the operators. **Slow** mode sends every generation with a 150 ms pause.

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

- `sessions` holds a single checkpoint of the latest run, under the key `latest`: settings, dataset, generation, the whole population (trees stored as compact nested arrays), the best program, the recent generations, the progress chart and the replay timeline (up to 300 snapshots). It is checked on every update from the worker and written when the best fitness has improved or at least 10 generations have passed since the last write. It is also written on Stop, when a run finishes, and if the page is closed during a run. The population saved on Stop or finish is exact; between those, it may be up to 10 generations older than the rest of the checkpoint.
- `bestPrograms` keeps a log of each new best program (time, fitness, R², generation and tree). It is not shown in the UI yet.

**Clear Results** empties both stores. The theme choice is stored separately, in `localStorage` under `equvolve-theme`. Everything stays in your browser; clearing site data deletes it.

### Known limitations

- **Constants inside non-linear functions** (the `1/3` in `exp(x/3)`) are found by mutation alone, so these targets are solved less reliably than in Phase 1; see [Example results](#example-results). The experimental constant optimisation did not fix this.
- **Formula mode has one variable** (`x`); several variables need a CSV.
- **The simplifier is algebraic only.** It does not know trigonometric or logarithmic identities, and it does not factor expressions.
- **The replay keeps up to 300 snapshots.** In longer runs, intermediate improvements are thinned out; the first and latest are always kept.
- **The progress chart keeps up to 1,000 points.** Beyond that, every other point is dropped (the latest is always kept), so very long runs are drawn at a coarser resolution.
- **The charts do not follow the theme.** They are drawn on a white background in both themes, in fixed colours that differ slightly from the colour keys in their captions.
---

## Example results

`npm run bench` measures how often the engine reaches R² ≥ 0.999 within 200 generations, using the default settings (population 200, linear scaling on, constant optimisation off), 101 sample points and x in [-3, 3]. Each target is run 20 times. A full run takes about 15 minutes; see [Benchmark](#benchmark) for shorter runs. GP is stochastic, so your runs will differ, and a difference of a few runs out of 20 is within noise.

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

To run one file:

```bash
node --test test/shared.test.js
```

The engine tests seed the engine's random numbers, so they give the same result on every run. To run them with another seed, or unseeded:

```bash
GP_TEST_SEED=42 npm test
```

```bash
GP_TEST_SEED=random npm test
```

The UI has browser tests for CSV upload, Start / Stop / Resume, restoring a saved session, replay, operator presets, the Copy buttons, the About page, the theme toggle and what the charts draw. They serve the app locally and drive it in headless Chromium with [Playwright](https://playwright.dev/), the project's only (development) dependency. They need network access, because the page loads Vue, Vue Router and Marked from jsDelivr:

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run test:ui
```

Both suites run on Node 22 on every push and pull request via GitHub Actions (`.github/workflows/test.yml`). The browser suite takes under a minute. How the tests are set up is described in the [developer guide](docs/DEVELOPMENT.md#browser-tests).

### Benchmark

```bash
npm run bench
```

This prints a Markdown table like the one under [Example results](#example-results). Two optional arguments set the number of runs per target and pick a single target by its 0-based index, for example to run targets in parallel:

```bash
node bench/benchmark.js 5 3
```

For how the engine, UI and tests fit together, see the [developer guide](docs/DEVELOPMENT.md).

### Project structure

| File            | Purpose                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `index.html`    | Page shell; applies the saved theme before the first paint, and loads pinned versions of Vue, Vue Router and Marked from jsDelivr |
| `shared.js`     | Code shared by UI and engine: evaluation, formula sampling and checks, simplification, export, share links, config validation |
| `worker.js`     | The GP engine (runs in a Web Worker)                                                           |
| `app.js`        | Vue UI: inputs, visualisation, persistence, replay, share links, theme toggle, About page     |
| `style.css`     | Styles, with light and dark colour tokens                                                     |
| `test/`         | Headless Node tests (`node:test`); `helpers.js` loads `worker.js` in a simulated Web Worker. `test/ui/` holds the browser tests |
| `bench/`        | `npm run bench`: how often the engine reaches R² ≥ 0.999 on six targets                       |
| `assets/`       | Logo: `logo-mark.svg` (the icon), and `logo-on-dark.svg` / `logo-on-light.svg` (icon with the EquVolve wordmark) |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | Browser and home-screen icons |
| `docs/`         | [Developer guide](docs/DEVELOPMENT.md): architecture, worker messages, data formats       |
| `.github/workflows/test.yml` | CI: runs `npm test` and `npm run test:ui` on Node 22                            |

The About page renders this README, fetched live from the `main` branch. Its in-page links (such as [Example results](#example-results)) scroll to their section there, as they do on GitHub.

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
