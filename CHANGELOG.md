# Changelog

All notable changes to EquVolve are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-07

The first release. EquVolve finds a formula that fits your data with genetic programming, and lets you watch it happen, in the browser: nothing to install, no server, and your data never leaves your computer.

Live at [bowo-prasetyo.github.io/equvolve](https://bowo-prasetyo.github.io/equvolve/).

### What you can do

- **Fit a formula or your own data.** Sample a target formula over a range of `x`, or upload a CSV with up to 10 input columns and pick the column to predict.
- **Watch it evolve.** The fitted curve, the formula as an expression tree and a progress chart update live. Fast mode runs about 60–100 generations per second; Slow mode shows every generation.
- **Replay a run** improvement by improvement, with the formula, charts and tree following along.
- **Take the result with you.** Copy the best formula as plain text, JavaScript, Python or LaTeX. With several inputs, the functions take them as named parameters.
- **Share a run** with a link that carries the settings, the data (up to 2,000 rows) and the best formula.
- **Stop, resume, restore.** Runs are saved in the browser and offered back when you return; **Undo** brings back a run you cleared or replaced.
- **Use it in your language and theme:** English, Bahasa Indonesia and 日本語, with Light, Dark or Auto themes.

### Search engine

- Standard subtree crossover and subtree/point mutation, with a Max Tree Depth limit against bloat.
- Ramped half-and-half initialisation, tournament selection, elitism and 10% random immigrants, with every generation exactly *Population Size* programs.
- **Linear scaling** (on by default): each program is scored as `a + b·f(x)` with the least-squares `a` and `b`, so evolution only has to find the shape.
- Stops at a **Target R²** or at Max Generations, and says which.
- Results are **simplified** before they are shown (constant folding, like terms, cancelling factors), and each simplification is checked against the data.
- Generations are batched between screen updates, instead of pausing 50 ms after each.
- **Constant optimisation** is available but **off by default**: in our benchmark every strategy tried made results worse (see the README).

### Data

- Formulas may only use `x`, numbers, arithmetic and maths names (`sin`, `pow`, `PI`, …), so a formula from a share link cannot run code.
- CSV files with commas, semicolons or tabs, decimal commas in semicolon- and tab-separated files, a preview of the first rows, a report of every skipped row and why, and sample data to try.
- Input names come from the column headers, cleaned up so they work in formulas and in exported code.

### Interface

- Settings are checked before a run, with every problem shown next to its setting; a one-click fix when the formula needs an operator that is not ticked; advanced settings tucked away.
- Charts with round axis ticks that fit the screen, stay sharp, follow the theme and switch to *predicted vs actual* for several inputs.
- Built for translation: one message file per language, plurals and number formats per language, and a layout ready for right-to-left languages ([translation guide](https://github.com/bowo-prasetyo/equvolve/blob/main/docs/TRANSLATING.md)).
- Controls at least 44 px tall on phones.

### Reliability and security

- Works in browsers that do not allow storage (some private modes): everything runs; only saving is unavailable.
- The three libraries loaded from a CDN (Vue, Vue Router, Marked) are pinned to exact versions and checked with Subresource Integrity hashes.
- Values shown inside translated messages, such as file names and column headers, are escaped.
- Over 130 unit tests and over 100 browser tests run on every push, plus a reproducible benchmark (`npm run bench`).

### Upgrading from the pre-release app

EquVolve began as *genetic-programming*. If you used it before:

- **Old links still work.** `bowo-prasetyo.github.io/genetic-programming/` and its share links forward to the same place on the new address.
- **Saved runs still restore.** They are stored under the same name in the same browser.
- **Target formulas are stricter.** Only arithmetic and maths names are allowed, not arbitrary JavaScript (for example `x > 0 ? x : 0`).
- **Mutation Rate** now means the probability that a new program is mutated, rather than a per-node probability.
- The engine finds polynomial and rational formulas far more reliably than the original one (60/60 against 42/60 in the benchmark), but formulas with a constant inside a function, such as `exp(-x*x/2)`, less often (28/60 against 41/60). See *Example results* in the README.

### How 1.0 was built

1.0 is the result of an audit of the original app and a series of steps, each a pull request:

- **Restoring trust:** fixing the engine's population sizing, stopping and resume bugs; input validation; tests and CI; a README that matches the code ([#1](https://github.com/bowo-prasetyo/equvolve/pull/1)).
- **The core loop:** subtree crossover and mutation, linear scaling, simplification, the progress chart, operator presets, export and share links ([#2](https://github.com/bowo-prasetyo/equvolve/pull/2)).
- **Next steps:** several input variables, replay, faster runs, and the constant optimisation experiment ([#3](https://github.com/bowo-prasetyo/equvolve/pull/3)).
- **EquVolve:** the new name, logo and light theme; a developer guide; browser tests; usability passes on the run loop, results, restore and CSV upload; European CSV files; and translation into Indonesian and Japanese (#4 to #27).

[1.0.0]: https://github.com/bowo-prasetyo/equvolve/releases/tag/v1.0.0
