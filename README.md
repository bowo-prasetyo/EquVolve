<p align="center"><img src="assets/logo-mark.svg" width="96" height="96" alt="EquVolve logo: an expression tree shaped like a V"></p>

# EquVolve

*Watch equations evolve.* EquVolve (pronounced **EK-yoo-volve**) joins *equation* and *evolve*.

> Other languages: [Bahasa Indonesia](https://github.com/bowo-prasetyo/equvolve/blob/main/README.id.md) · [日本語](https://github.com/bowo-prasetyo/equvolve/blob/main/README.ja.md)

**EquVolve finds a formula that fits your data, and lets you watch it happen.** Give it a formula or a CSV file of numbers, and it breeds candidate formulas, keeps the ones that fit best, and improves them generation by generation, with the fitted curve and the formula's tree on screen as it goes. The method is called *genetic programming* (GP), and finding a formula this way is called *symbolic regression*.

It is built for **learning and exploring** how GP works, and for light practical use, such as fitting a formula to a small dataset. Everything runs in your browser: nothing to install, no server, and your data never leaves your computer.

- Live demo: [bowo-prasetyo.github.io/equvolve](https://bowo-prasetyo.github.io/equvolve/#/)
- Repository: [github.com/bowo-prasetyo/equvolve](https://github.com/bowo-prasetyo/equvolve)

---

## What it does

- **Two kinds of data:** a target formula sampled over a range of `x`, or your own CSV file.
- **Several inputs:** a CSV may have up to 10 input columns; you pick which column to predict.
- **Live evolution** in the background, so the page stays responsive. Fast mode runs many generations between screen updates; slow mode shows every generation.
- **Replay:** step or play through every improvement of a run, watching the formula, fit and tree change.
- **Readable results:** the best formula is simplified before it is shown (`(2.469 + ((-2.507 + x*x) - -1.712))` becomes `pow(x, 2) + 1.674`), drawn as a tree, and plotted over the data.
- **Progress chart:** how well the best and the typical formula fit, generation by generation, against your target.
- **Export:** copy the best formula as plain text, JavaScript, Python or LaTeX.
- **Share links:** one click copies a link with the settings, the data (up to 2,000 rows) and the best formula.
- **Adjustable search:** population, generations, target fit, the evolution rates, tree depths, and 23 operators with presets.
- **English, Indonesian and Japanese:** the interface follows your browser's language; the menu in the top bar switches language at once, and the choice is remembered in this browser. The About page shows this README in the chosen language when there is a translation.
- **Light and dark themes:** the whole page, charts included, follows your device's setting by default; the button in the top bar switches between Auto, Light and Dark, and the choice is remembered in this browser.
- **Stop, resume and restore:** stop a run, change settings and carry on. Your run is saved in the browser, so it survives closing the tab.
- **Checks before running:** invalid formulas, ranges or settings are reported before a run starts, all at once and next to the setting to fix. If your formula uses an operator that is not ticked (such as `/` in `x*x + 2/x`), the app says so and ticks it for you in one click.

---

## Quick start

1. Open the [live demo](https://bowo-prasetyo.github.io/equvolve/#/).
2. Keep the default formula `x*x + 2` and press **Start Evolution**. It is found in the first generation.
3. Now one that takes a little longer: set the formula to `x*x + 2/x`. The app points out that it uses `/`, which is not ticked: press **Tick /** (or the **Rational** operator preset), then **Start Evolution**. On the progress chart, the red line steps down towards the dashed green target line, usually within 100 generations.
4. When it stops, press **▶ Replay** to watch how the formula improved over the run.
5. Ready for something hard? Try `sin(x) * exp(x/3)` with the **Everything** preset. It usually stops at Max Generations just short of the target; [When a run does not reach the target](#when-a-run-does-not-reach-the-target) explains what to do next.

---

## Key ideas

- **Program:** one candidate formula, built from operators (such as `+` or `sin`), the input variables and numbers. EquVolve shows each one as a formula and as a tree.
- **Population:** all the programs being tried at once (200 by default).
- **Generation:** one round of evolution. The best programs are kept, combined and changed a little to make the next population.
- **R² (the fit):** how well a program matches the data. 1 is a perfect fit, 0 is no better than always predicting the average, and below 0 is worse than that. A run stops as soon as the best program reaches the **Target R²** (0.999 by default).
- **Best program:** the program with the best fit so far. Each program's score includes a small penalty for its size, so results stay short and readable.

---

## How to use

The app has three numbered panels: **1. Data**, **2. Settings** and **3. Results**, with the run buttons between Settings and Results. Until you scroll down to them, the run buttons stay at the bottom of the window, so **Start Evolution** is always one click away, on a phone too.

### 1. Data: what to fit

Choose a **data source**.

**Generate from formula:** enter a formula and an X range.

- Write formulas in `x`, with numbers, brackets `( )`, `+ - * /` and maths functions such as `sin(x)`, `pow(x, 2)`, `exp(-x*x)`, `abs(x)` or `PI * x`. Every name on JavaScript's `Math` works, with or without `Math.` in front.
- Results use the same notation, so you can paste a result back in as a new formula.
- **Sample points** (101 by default) are spaced evenly across the X range, both ends included. These are the points the run tries to fit.

<details>
<summary>Formula details</summary>

- Also allowed: commas (as in `pow(x, 2)`), `%` and `**`. Nothing else is accepted (no other names, strings, square brackets or statements), so a formula in a shared link cannot run other code.
- Sample Points can be from 2 to 10,000. The chart marks at most about 60 of them, but the run uses all of them.
- Points where the formula has no finite value (for example `1/x` at `x = 0`) are skipped. At least two must remain.

</details>

**Upload dataset:** choose a CSV file of numbers, usually with a header row:

```csv
height,width,depth,price
1.5,4.4,4.1,27.4
2.0,3.0,2.8,22.7
```

- One column is the **target**, the value to predict: the last column by default. With three or more columns, the **Target column** menu lets you choose another.
- Every other column is an **input**, named after its header (up to 10 inputs).
- With **one input**, it is called `x`, and the chart shows the data with the fitted curve. With **several inputs**, the chart shows each row's predicted value against its actual value.
- Rows with an empty cell, missing or extra cells, or text instead of a number are skipped. The app says how many, and which lines of the file, with the reason (for example *Skipped 2 rows: line 4 (an empty cell); line 9 (text instead of a number).*).
- Once loaded, a **preview** shows the first five rows as EquVolve reads them, with the target column marked, so you can check the columns before a run.
- No file to hand? **Use sample data** loads a small example (the price of boxes from their height, width and depth), and **Download sample CSV** saves it, to see the format or use as a template.

<details>
<summary>CSV details</summary>

- Commas, semicolons and tabs all work as separators. A file uses one separator throughout, found from its first line (a tab if there is one, else a semicolon, else a comma); when it is not a comma, the app says which it found under the loaded file.
- **Decimal commas** work in semicolon- and tab-separated files, as saved by spreadsheets set to a language such as German, French or Indonesian: `1,5` is read as 1.5. In a comma-separated file numbers must use a decimal point. Thousands separators (`1.234,5`) are not supported; such rows are reported as text.
- A cell in double quotes may contain the separator (`"Height, cm"`), and `""` inside quotes is a quote. A UTF-8 byte order mark, which Excel adds to *CSV UTF-8* files, is ignored.
- If the first row is all numbers, it is treated as data, and the columns are called `x1`, `x2`, … and `y`.
- Only the first 10 input columns are used; any after that are ignored, and the app names them under the loaded file. A row with more cells than the header is skipped (*too many cells*), as its values do not line up with the columns; a single trailing separator is fine.
- Input names are cleaned to letters, digits and `_`, so `Height (cm)` becomes `Height_cm`. A name that starts with a digit, or clashes with a `Math` name or a JavaScript or Python keyword, gets a `v_` prefix (`sin` becomes `v_sin`). Repeated names get `_2`, `_3`, … added.
- With several inputs the chart draws up to 400 rows.
- Every row is used in every generation, so runs slow down as rows × inputs grow: a few thousand rows run comfortably, while 10,000 rows with 3 inputs run at about 2 generations per second.

</details>

### 2. Settings: how to search

Every setting has a short explanation under it in the app. Most of the time you only need **Max Generations**, **Target R²**, **Speed** and **Operators**, so only these are shown. The others are for exploring how GP behaves and sit under **Advanced settings**, which says how many of them you have changed from the defaults. It opens by itself when one of them has a problem.

| Setting            | What it does                                                                                     | Default |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------- |
| Max Generations    | The run pauses after this many generations. You can raise it and press **Resume**.               | 500     |
| Target R²          | The run stops as soon as the best program fits this well (1 = perfect, at most 1).               | 0.999   |
| Speed              | **Fast:** as many generations as fit in about 40 ms per screen update. **Slow:** one generation per update, about 6 per second, for watching. | Fast |
| Operators          | The building blocks programs may use.                                                             | `+ - *` |
| Population Size *(advanced)* | How many programs are tried at once. More can find harder formulas, but each generation is slower (at least 2). | 200     |
| Crossover Rate *(advanced)* | How often (0–1) a new program combines parts of two good programs, instead of copying one.        | 0.7     |
| Mutation Rate *(advanced)* | How often (0–1) a new program then gets a small random change.                                   | 0.1     |
| Elitism Rate *(advanced)* | The share (0–1) of the best programs kept unchanged for the next generation.                      | 0.05    |
| Tournament Size *(advanced)* | Parents are chosen by letting this many random programs compete. Larger values favour the best programs more strongly (at least 1). | 5 |
| Initial Tree Depth *(advanced)* | How deeply nested the random programs at the start may be (1–12).                                 | 4       |
| Max Tree Depth *(advanced)* | How deeply nested any program may become (from Initial Tree Depth to 17). This stops programs growing ever larger without fitting better. | 8 |
| Linear scaling *(advanced)* | Lets every program be stretched and shifted (`a + b·f(x)`) to fit the data, so evolution only has to find the right shape. Leave it on unless you are studying GP without it. | on |
| Constant optimisation *(advanced)* | Experimental: fine-tune the numbers inside a random 10% of programs each generation. It did not improve results in our benchmark (see [How it works](#constant-optimisation-experimental)). | off |

**If the formula needs an operator that is not ticked**, a note above the run buttons names it, with a button that ticks it (for example **Tick /**). A whole power such as `pow(x, 2)` or `x**3` only needs `*`. Maths functions that are not operators, such as `abs`, are pointed out too: a run can only approximate them.

**Operator presets:** Polynomial (`+ - *`), Rational (adds `/`), Trigonometric (adds `sin cos`), Exp / Log (adds `exp log`) and Everything. Pick the preset that matches the shape of your data; fewer, well-chosen operators usually find a formula faster than Everything.

<details>
<summary>All 23 operators</summary>

- Binary: `+`, `-`, `*`, `/`, `pow`
- Unary: `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `log` (natural log), `log2`, `log10`, `exp`, `sqrt`, `cbrt`

The default rates were chosen with the benchmark described under [Example results](#example-results). Crossover 0.8, mutation 0.2 and elitism 0.02 did slightly worse on the harder targets.

</details>

### Start, stop and resume

| State   | Buttons                                                              | Settings                                          |
| ------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| idle    | **Start Evolution**                                                  | Editable.                                         |
| running | **Running…** (disabled), **Stop**                                    | Locked.                                           |
| paused  | **Resume**, **New run**, **Copy share link**, and a quieter **Clear Results** | Editable; **Resume** continues with your changes. |

- The highlighted button is the useful next step. After **Stop** it is **Resume**. When resuming would stop again at once, because the run is at Max Generations or already reaches the Target R², it is **New run**, and a note under the buttons says which setting to raise to continue instead. After a perfect fit (R² 1) there is nothing left to improve, so the note suggests **New run**.
- A run pauses on its own when it reaches the Target R² or Max Generations, and a message says which. To keep going after Max Generations, raise it and press **Resume**.
- **New run** starts again from scratch with the current settings.
- **Clear Results** clears the results and the saved run straight away, ready for a new one.
- After **New run** or **Clear Results**, an undo button (**Undo new run** or **Undo**) brings the previous run back, paused, with the settings it ran with, until you start or resume another run.
- Settings are checked when you press **Start Evolution**, **New run** or **Resume**. Every problem is listed above the buttons and shown next to its setting, and the cursor moves to the first one. The list updates as you fix them; click a problem to go to its setting.
- **Copy share link** appears whenever a result is shown and no run is going, including after you open a share link.

### 3. Results: reading them

- **Best R²:** how well the best program fits, with what that means in words: *Excellent fit* (0.999 or more), *Very good fit* (0.99), *Good fit* (0.9), *Rough fit* (0.5), *Poor fit* (0 or more) or *Worse than guessing the average* (below 0).

- **Best program:** the best formula so far. The tabs show it as a plain formula, JavaScript, Python or LaTeX, and **Copy** puts the current tab on the clipboard. With several inputs, the exported function takes them as parameters, for example `(height, width, depth) => …`.
- **Replay:** after a run (or while paused), **▶ Replay** plays through every improvement, and the slider jumps to any of them. The formula, export, fit chart and tree all follow the replay, and the progress chart marks its generation in blue. **Back to latest** returns to the current best.
- **Fit chart:** with one input, the data (cyan dots) and the best program (red curve). The axes have round tick values and are titled with the input's and the target's names (`x` and `y`, or the CSV's column names). With several inputs, each row's predicted value against its actual value, on axes titled *actual* and *predicted* (with the target's name); points on the red diagonal are predicted exactly. Both charts fit the width of the screen and stay sharp on high-resolution displays.
- **Progress chart:** how close the best (red) and the median (grey) program are to a perfect fit in each generation. The scale shows R² 0.9, 0.99, 0.999 … at equal steps, so late, small improvements are as visible as early, large ones. The dashed green line is your Target R².
- **Expression tree:** the best program as a tree. Each node is labelled with its operator, variable or number; operators are orange, variables green and numbers khaki. Nodes grow to fit their label, and long numbers are shortened (`1.76e-6`): point at one to see all its digits.
- **Program size:** how many nodes the tree has.
- **Speed:** generations per second.
- **Recent generations:** the best program at each of the last five screen updates, newest first.

<details>
<summary>Export details</summary>

- The JavaScript and Python exports keep 12 significant digits; the plain formula and LaTeX show 5, like the formula on screen.
- Python writes powers as `**`, and a program that uses `cbrt` gets a comment that `math.cbrt` needs Python 3.11 or later.
- In Fast mode one screen update covers many generations, so **Recent generations** skips some.
- The progress chart's scale stops at R² 0.999999; better fits are drawn on its bottom edge.

</details>

### Share a run

After a run, **Copy share link** copies a link that opens EquVolve with your settings, your data and the best formula, ready to run. The link is also shown in a box below the buttons, to copy by hand if needed.

- An uploaded dataset is included if it has at most 2,000 rows; otherwise the person you share it with is asked to upload the file.
- The run's population is not included, so they start a new run rather than continuing yours.
- Opening a link does not touch the visitor's own saved run until they start a new one.

### Restore after closing the browser

Your run is saved in this browser as it goes. When you come back, a banner at the top of the page offers it, saying what it fits, how far it got and when it was saved. **Restore run** brings it back paused, with its results, charts, replay, settings and data: press **Resume** to continue. **Not now** keeps it saved for your next visit, and the page can be used straight away while the banner is shown; starting a new run replaces the saved one. See [Persistence](#persistence) for what is stored.

---

## When a run does not reach the target

Runs are random, and some formulas are hard to find. Stopping at Max Generations is not an error: the best program so far is still shown, and an R² of 0.99 is often already a close fit (check the fit chart). To get closer, try these in order:

1. **Raise Max Generations and press Resume.** The run continues where it stopped. Hard targets can take 1,000 generations or more.
2. **Choose operators that match the shape of the data:** Trigonometric for waves, Exp / Log for growth, decay or bell curves, Rational for formulas with division. A few fitting operators usually beat Everything.
3. **Start again** with **New run** (**Undo** brings the old run back if the new one does worse). Every run is different, and a new one may find the formula quickly.
4. **Increase Population Size**, for example to 500. Each generation is slower, but the search tries more at once.
5. **Accept a slightly lower Target R²**, for example 0.99, if a close fit is enough.

### Messages

| Message                                                        | What to do                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Stopped at Max Generations (…)                                 | See the list above.                                                                          |
| Formula is invalid: unknown name "…"                           | Use `x` as the variable, and only maths names such as `sin`, `exp` or `PI`.                   |
| Formula produces fewer than 2 finite values in the X Range     | Change the X range: for example, `log(x)` and `sqrt(x)` need positive `x`.                    |
| Target values are constant                                     | The data must vary; a flat line has nothing to fit.                                           |
| The CSV needs at least two columns of numbers                  | Check that the file has at least two columns of numbers, separated by commas, semicolons or tabs. |
| Upload a CSV dataset with at least 2 valid rows                | Upload a file, or check its rows: rows with empty cells or text are skipped.                  |
| Skipped … rows: … (too many cells)                             | The row has more values than the header has columns. In a comma-separated file this usually means numbers written with decimal commas: save the file with semicolons as separators instead, or use decimal points. |
| Select at least one operator                                   | Tick an operator, or press a preset.                                                         |
| Your formula uses …, which is not ticked under Operators       | Press the **Tick …** button next to it, or a preset that includes it. Without it a run can only approximate the formula. |
| … is not available as an operator, so a run can only approximate it | The formula uses a maths function that is not one of the 23 operators, such as `abs`. Nothing to fix: the run still works, but finds an approximation built from the ticked operators. |
| This share link could not be read                              | The link is probably incomplete; copy it again.                                               |

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

In **Fast** mode the worker runs generations back to back for about 40 ms, then sends one update covering all of them and pauses for 5 ms. Every generation is still added to the progress chart and replay (subject to the limits under [Known limitations](#known-limitations)). The full population, needed only for checkpoints, is sent every 10 generations, on Stop and on finish. Versions before 1.0 paused a fixed 50 ms after every generation, which capped runs at about 20 generations per second. A population of 200 now runs at roughly 60–100 generations per second in a typical browser, depending on the operators. **Slow** mode sends every generation with a 150 ms pause.

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

**Clear Results** empties both stores (**Undo** writes the checkpoint back). The theme and language choices are stored separately, in `localStorage` under `equvolve-theme` and `equvolve-language`. Everything stays in your browser; clearing site data deletes it. If the browser does not allow storage (some private browsing modes, or with site data turned off), EquVolve works as usual but cannot save runs, so there is nothing to restore later.

### Known limitations

- **Constants inside non-linear functions** (the `1/3` in `exp(x/3)`) are found by mutation alone, so these targets are solved less reliably than by the original engine (the version before the rewrite that led to 1.0); see [Example results](#example-results). The experimental constant optimisation did not fix this.
- **Formula mode has one variable** (`x`); several variables need a CSV.
- **The simplifier is algebraic only.** It does not know trigonometric or logarithmic identities, and it does not factor expressions.
- **The replay keeps up to 300 snapshots.** In longer runs, intermediate improvements are thinned out; the first and latest are always kept.
- **The progress chart keeps up to 1,000 points.** Beyond that, every other point is dropped (the latest is always kept), so very long runs are drawn at a coarser resolution.
---

## Example results

`npm run bench` measures how often the engine reaches R² ≥ 0.999 within 200 generations, using the default settings (population 200, linear scaling on, constant optimisation off), 101 sample points and x in [-3, 3]. Each target is run 20 times. A full run takes about 15 minutes; see [Benchmark](#benchmark) for shorter runs. GP is stochastic, so your runs will differ, and a difference of a few runs out of 20 is within noise.

The *original engine* is the version from before the rewrite that led to 1.0, measured with the same benchmark.

| Target              | Operators         | Original engine | 1.0     | Median generations (1.0) | Example result (1.0)                              |
| ------------------- | ----------------- | --------------- | ------- | ------------------------ | ------------------------------------------------- |
| `x*x*x - 2*x + 1`   | `+ - *`           | 6               | **20**  | 9                        | `pow(x, 3) - 2 * x + 1`                           |
| `3*x*x + 2`         | `+ - *`           | 17              | **20**  | 1                        | `3 * pow(x, 2) + 2`                               |
| `x*x + 2/x`         | `+ - * /`         | 19              | **20**  | 14                       | `0.9716 * pow(x, 2) + 2.0113 / x + 0.087772`      |
| `exp(-x*x/2)`       | `+ - * / exp`     | **19**          | 13      | 22                       | `0.99343 * exp(-0.54735 * pow(x, 2)) + 0.020478`  |
| `sin(x) + sin(x*x)` | `+ - * / sin cos` | **15**          | 12      | 19                       | `sin(x) + sin(pow(x, 2))`                         |
| `sin(x) * exp(x/3)` | `+ - * / sin exp` | **7**           | 3       | 12                       | `1.0273 * exp(0.30728 * x) * sin(x) + 0.023183`   |
| **Total (of 120)**  |                   | 83              | **88**  |                          |                                                   |

What this shows:

- **Polynomial and rational targets are solved every time** (60/60, against 42/60 for the original engine), usually within a handful of generations. Linear scaling and subtree crossover do the work here.
- **Targets with a constant inside a non-linear function** (the `1/2` in `exp(-x*x/2)`, the `1/3` in `exp(x/3)`) are solved less often than by the original engine (28/60, against 41/60). The original engine nudged every constant in every offspring, which happened to suit these targets. The experimental [constant optimisation](#constant-optimisation-experimental) did not close this gap.
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
| `index.html`    | Page shell; applies the saved theme before the first paint, and loads pinned versions of Vue, Vue Router and Marked from jsDelivr, checked with integrity hashes |
| `i18n.js`       | Translation: chooses the interface language, loads its messages and formats them (plurals, lists) |
| `locales/`      | The interface's text, one ICU JSON file per language (`en.json` is the source; `id.json` Indonesian, `ja.json` Japanese) |
| `README.id.md`, `README.ja.md` | This README in Indonesian and Japanese, shown on the About page in those languages |
| `shared.js`     | Code shared by UI and engine: evaluation, formula sampling and checks (including the operators a formula needs), simplification, export, CSV parsing and the sample data, share links, config validation, R² in words, and the charts' layout and colours |
| `worker.js`     | The GP engine (runs in a Web Worker)                                                           |
| `app.js`        | Vue UI: inputs, visualisation, persistence, replay, share links, theme toggle, About page     |
| `style.css`     | Styles, with light and dark colour tokens                                                     |
| `test/`         | Headless Node tests (`node:test`); `helpers.js` loads `worker.js` in a simulated Web Worker. `test/ui/` holds the browser tests |
| `bench/`        | `npm run bench`: how often the engine reaches R² ≥ 0.999 on six targets                       |
| `assets/`       | Logo: `logo-mark.svg` (the icon), and `logo-on-dark.svg` / `logo-on-light.svg` (icon with the EquVolve wordmark) |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | Browser and home-screen icons |
| `CHANGELOG.md`  | What each release contains |
| `docs/`         | [Developer guide](docs/DEVELOPMENT.md): architecture, worker messages, data formats; [translation guide](docs/TRANSLATING.md) |
| `.github/workflows/test.yml` | CI: runs `npm test` and `npm run test:ui` on Node 22                            |

The About page renders this README (or its translation, in the interface's language), fetched live from the `main` branch. Its in-page links (such as [Example results](#example-results)) scroll to their section there, as they do on GitHub.

---

## Roadmap

**Done:** everything in version 1.0. See the [changelog](https://github.com/bowo-prasetyo/equvolve/blob/main/CHANGELOG.md) for what it contains and how it was built.

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
