# EquVolve developer guide

This guide is for people changing EquVolve's code. For what the app does and how to use it, see the [README](../README.md).

EquVolve is a static site with no build step and no runtime dependencies besides three pinned CDN scripts (Vue, Vue Router, Marked). Everything runs in the browser.

## Architecture

```
index.html ──loads──▶ shared.js ──▶ app.js (Vue UI, main thread)
                                      │  postMessage({type, config, ...})
                                      ▼
                                   worker.js (GP engine, Web Worker)
                                      └─ importScripts('shared.js')
```

- **`shared.js`** holds the code both sides need: the operator table, formula checks and sampling, tree evaluation, simplification, printing and export, CSV parsing, config validation and normalisation, share links, and the charts' geometry and colours (`valueRange`, `linearScale`, `sampleIndices`, `progressLevel`, `progressGrid`, `CHART_COLOR_TOKENS`, `chartColors`), which `app.js` draws with. The UI draws curves with the same `evaluateTree` the engine scores with, so what you see is what was scored. In Node it exports its functions through `module.exports` for the tests. In the browser they are globals.
- **`worker.js`** is the engine. It owns the population and the training points, runs generations, and sends results to the page. It never touches the DOM or storage.
- **`app.js`** is the UI: inputs, validation messages, charts (canvas), the expression tree (SVG), replay, export, share links, IndexedDB persistence, the theme toggle and the About page. The About page fetches `README.md` from the `main` branch on GitHub (`README_URL`) and renders it with Marked. A README change shows up in the live app only once it is merged to `main`. Marked adds no heading IDs, so `addHeadingIds()` gives each heading the anchor GitHub would (`headingSlug()`: lowercase, punctuation removed, spaces as hyphens, `-1`, `-2`, … on repeats). A click on a `#section` link scrolls to it instead of navigating: the routes live in the URL hash, so `#example-results` would otherwise be read as a route and show a blank page.

Routing uses hash history (`#/`, `#/about`), so the site works on any static host, including GitHub Pages. Workers cannot load from `file://`, so serve the folder over HTTP (`python3 -m http.server 8000`).

## Programs (trees)

A program is a plain JSON tree:

| Form | Meaning |
| --- | --- |
| `'x'`, `'height'` | A variable: any string matching `^[A-Za-z_][A-Za-z0-9_]*$` |
| `'3.141'` | A constant: any other string (or number) |
| `{ op: 'sin', child }` | Unary operator |
| `{ op: '+', left, right }` | Binary operator |

`treeToString` gives a fully parenthesised form. The engine also uses it as the key of its fitness cache (up to 50,000 entries, cleared when the training data changes).

For storage and share links, trees are packed with `compressTree` into nested arrays (`'x'`, `['sin', child]`, `['+', left, right]`) and unpacked with `decompressTree`. Trees from share links are untrusted: `isValidTree` checks operators, variables, constants and a maximum nesting of 64.

## Worker messages

### Page → worker

| `type` | Payload | Effect |
| --- | --- | --- |
| `start` | `config` | Apply the config, create a new ramped half-and-half population at generation 0, and run. |
| `stop` | none | Stop after the current batch. If a run was going, reply with `stopped`. |
| `resume` | `config` | Apply the (possibly edited) config, top the population up to Population Size if needed, and continue. If the run is already at Max Generations, reply with `finished` straight away. |
| `restore` | `state: { config, generation, population }` | Load a checkpoint without running, and reply with `restored`. |

Applying a config always rebuilds the training points and clears the fitness cache.

### Worker → page

`update`, `finished` and `stopped` share one shape:

| Field | Meaning |
| --- | --- |
| `best` | The raw best program, as it was scored |
| `model` | What the user sees: `best` wrapped in `a + b·f` when linear scaling is on, then simplified |
| `fitness`, `rawError`, `r2` | Fitness of `best`: `(1 − R²) + 0.001 × size`, `1 − R²`, and R² |
| `medianR2` | R² of the median program |
| `size` | Node count of `model` |
| `generation` | Latest generation number (counting from 1) |
| `expression` | `treeToString(best)` |
| `progress` | `[generation, bestR2, medianR2]` for every generation since the last message |
| `timeline` | `{ g, r2, fitness, model }` each time the best program changed since the last message |
| `population` | The full population. Only sent every 10 generations (`populationEvery`), and always on `stopped` and `finished` |
| `reason` | `finished` only: `'targetReached'` or `'maxGenerations'` |

`restored` carries `generation` and `populationSize`.

The page needs every `progress` and `timeline` entry, because one `update` can cover many generations.

## Config

`buildConfig()` in `app.js` produces the config, `validateConfig()` in `shared.js` lists problems with it as user-facing strings, and `normalizeConfig()` fills in settings that older checkpoints and share links lack (for example `maxTreeDepth`, `linearScaling`, and `targetR2` from the old `minError`). When you add a setting, add it to all of these places:

1. `DEFAULTS` and `buildConfig()` in `app.js` (plus a control, often a `SETTING_FIELDS` entry);
2. `validateConfig()` if it has limits, and `normalizeConfig()` with a default, so old sessions still restore;
3. `sanitizeShare()` in `shared.js` if share links should carry it (unknown fields are dropped);
4. `applyConfig()` in `worker.js`;
5. the settings table in the README.

These config fields are read only by the engine and exist for tests and the benchmark. The UI never sets them:

| Field | Default | Meaning |
| --- | --- | --- |
| `batchMs` | 40 (fast) / 0 (slow) | How long to run generations before sending an update |
| `delayMs` | 5 (fast) / 150 (slow) | Pause between batches |
| `populationEvery` | 10 | Send the population every this many generations |
| `constOpt` | `{ mode: 'random', rate: 0.1, steps: 10, programs: 3 }` | Constant optimisation strategy. `mode: 'top'` optimises the best `programs` instead of a random `rate` share |

## Persistence

IndexedDB database `gp-db`, version 2 (the name predates EquVolve; keep it so old sessions restore):

- **`sessions`** (key path `id`): one record, `id: 'latest'`, with `timestamp`, `generation`, `population` (compressed trees), `model`, `bestFitness`, `bestR2`, `bestSize`, `history`, `series` (`[g, best, median]`), `timeline` (`[g, r2, fitness, compressedModel]`), and `config` (the full config, dataset included, plus `uploadedFileName`). Older records may store the best program as `best` instead of `model`; `restoreSession` accepts both.
- **`bestPrograms`** (auto-increment `id`): `{ timestamp, fitness, r2, tree, generation }` for each improvement. Written but not read by the UI.

The theme preference lives in `localStorage` under `equvolve-theme` (`'light'` or `'dark'`; absent means Auto). A small inline script in `index.html` applies it before the first paint.

## Share links

`#/?run=<code>`, where `<code>` is one prefix character and then base64url:

- `z`: the payload JSON compressed with `deflate-raw` (`CompressionStream`), used when the browser supports it;
- `j`: the payload JSON uncompressed.

The payload is `{ v: 1, config, model, r2, generation, datasetOmitted?, fileName? }`, where `config` is the run config and `model` the compressed best program. A dataset is packed as rows of numbers, `[x, y]` or `[...inputs, y]` in the order of `config.variables`, and is left out (`datasetOmitted: true`) when it has more than 2,000 rows. `decodeShare` rejects other versions and passes everything through `sanitizeShare`, which keeps only known, well-typed fields. The target formula is limited to 500 characters and is checked again by `compileFormula` before use. If you change the payload in a way older links cannot follow, increase `SHARE_VERSION`.

## Formulas

`compileFormula` first tokenises the source and allows only numbers, `x`, names on `Math` (with or without `Math.`), `+ - * / % **`, parentheses and commas. It then compiles it with `new Function` inside `with (Math)`. The token check is what makes formulas from share links safe, so keep it strict.

## Adding an operator

1. Add it to `OP_ARITY` and to the `switch` in `evaluateTree` (`shared.js`).
2. Printing: plain, JavaScript and Python print unary operators as `name(...)`, `Math.name(...)` and `math.name(...)`. Check that the name exists in both languages. Add a LaTeX form to `LATEX_FUNCTIONS`, or a special case in `latex()`.
3. Add it to an `OPERATOR_GROUPS` entry in `app.js` so it gets a checkbox. The **Everything** preset picks it up from `OP_ARITY` automatically.
4. If it should be usable in target formulas, it must be a `Math` name.
5. Update the operator list and count in the README, and add tests.

## Tests

```bash
npm test
```

`test/helpers.js` runs the real `worker.js` in a Node `vm` context that provides `importScripts`, `postMessage` and `onmessage`. Timers are manual: `tick(n)` runs `n` timer callbacks. `baseConfig()` sets `batchMs: 0`, `delayMs: 0` and `populationEvery: 1`, so each tick is exactly one generation and every update carries the population. Its default `targetR2` is 2, which can never be reached, so runs last until Max Generations unless a test overrides it.

**Seeded randomness.** `loadWorker()` replaces `Math.random` inside the engine's `vm` context with a seeded generator (mulberry32, seed 1 by default; the host's `Math.random` is untouched). Every engine test therefore replays the same evolution each time, on every machine, and cannot pass or fail by luck. Before this, *multi-variable data: finds y = 2a + 3b² − c* failed in about 1 of 6 runs: across 24 seeds, 4 runs ended just short of R² 0.9999 within 300 generations.

- `GP_TEST_SEED=42 npm test` runs the suite with another seed, and `GP_TEST_SEED=random npm test` unseeded. Use these to check that a test is robust rather than tuned to one seed. A failure under a given seed reproduces exactly with that seed.
- A change to the engine that consumes random numbers differently (an extra `Math.random()` call, a different order) changes every seeded run. If a search test then fails, check it with a few seeds before concluding the engine got worse.
- `loadWorker({ seed })` sets the seed for one worker; `seed: null` leaves it unseeded. The benchmark uses `null`, because it measures how often truly random runs succeed.

| File | Covers |
| --- | --- |
| `engine.test.js` | Run lifecycle: target reached, max generations, stop/resume, restore, formula and dataset training points |
| `shared.test.js` | Target formula syntax and round-tripping, non-finite samples, config validation, legacy `minError` |
| `phase2-engine.test.js` | Depth limit, well-formed crossover and mutation, ramped initialisation, linear scaling, reported model and R² |
| `phase2-shared.test.js` | Simplifier, printing, JavaScript/Python/LaTeX export, formula safety, share links, `normalizeConfig` |
| `phase3-engine.test.js` | Batching and speed, population cadence, replay timeline, constant optimisation, multi-variable runs |
| `phase3-shared.test.js` | Multiple variables, CSV parsing and variable names, multi-variable export, validation and share links |
| `charts.test.js` | Chart geometry: value ranges, linear scales (including upside-down y axes), point thinning, the progress chart's clamped log scale and its grid labels; the chart colour tokens, their fallbacks, and every token being defined in each theme of `style.css` |

### Browser tests

```bash
npm run test:ui
```

`test/ui/` tests the page itself in headless Chromium, driven by [Playwright](https://playwright.dev/) (pinned in `devDependencies`) and run with `node:test` like the rest. Install it with `npm install` and `npx playwright install chromium` first. `npm test` does not need it.

- `server.js` serves the repository on a free local port, because workers cannot load from `file://`.
- `helpers.js` holds the shared setup: `useBrowser()` starts the server and Chromium for a test file, and `openApp(t, options)` opens the app in a new browser context, so no IndexedDB session, restore prompt or theme choice carries over between tests. Any uncaught page error fails the test.
- Dialogs (the restore prompt, Clear Results' confirmation) are dismissed unless a test sets `openApp(t, { dialogs: 'accept' })` or `page.answerDialogs = 'accept'`. Every dialog's message is recorded in `page.dialogs`.
- `openTab(page, url)` opens another tab in the same context, and `reload(page)` reloads, both sharing IndexedDB and `localStorage`, to test what survives closing the page. `storedSession(page)` reads the saved checkpoint without creating or upgrading the database.
- The About page's README request is answered with this checkout's `README.md`, so the tests check the README being changed and do not depend on what is merged. Pass `openApp(t, { readme: handler })` with a Playwright route handler to simulate a failure. Because every in-page link must point at a heading, renaming a README heading without updating its links fails `about.test.js`.
- Clipboard access is off by default. `openApp(t, { clipboard: 'grant' })` allows it, so a test can read what was copied with `navigator.clipboard.readText()`. `{ clipboard: 'fail' }` makes every write fail, to test the fallbacks; denying permission alone does not reliably make writes fail in headless Chromium.
- The page loads its libraries from jsDelivr, so the tests need network access.

| File | Covers |
| --- | --- |
| `csv-upload.test.js` | Single- and multi-input files, the Target column menu, cleaned header names, skipped rows, headerless and rejected files, validation without a file, a full run with JavaScript and Python export, and a share link carrying the dataset |
| `run-controls.test.js` | Start, Stop and Resume (settings locked while running, the engine really stopped, Resume continuing rather than restarting), Max Generations and target R² endings, validation on Resume, and Clear Results with its confirmation |
| `restore-session.test.js` | Restoring a finished or stopped run (settings, results, dataset and file name) and resuming it, declining the restore, Clear Results deleting the session, and share links not offering a restore |
| `replay.test.js` | Stepping through improvements with the slider (formula, export and tree follow), Back to latest, playing to the end, pausing, and the replay hiding during a run |
| `about.test.js` | The README rendering (logo and tables included), GitHub-style heading anchors, every in-page link pointing at a heading, links scrolling instead of changing the route, and the message when the README cannot be loaded |
| `operator-presets.test.js` | A checkbox for each of the 23 operators, each preset ticking exactly its operators, the highlight following hand-made changes, the at-least-one-operator check, locking during a run, and a run using only the chosen operators |
| `copy-buttons.test.js` | Copy putting exactly the selected export (all four formats) on the clipboard and its label resetting, Copy share link copying the link it shows, and both buttons' fallbacks when the clipboard fails |
| `chart-theme.test.js` | In both themes: the canvases' background is `--chart-bg`, points and lines are drawn in their caption keys' colours, and every chart colour is readable on the background; the toggle and a device switch (in Auto) redraw the charts in the new colours |
| `charts.test.js` | What the canvases draw, read back pixel by pixel: the fit chart's markers and curve, predicted against actual with several inputs, the progress chart's grid, dashed target line (following the setting), best and median lines, and the replay marker |
| `theme.test.js` | Auto following the device (also when it switches), the Auto → Light → Dark cycle, the saved choice surviving a reload and overriding the device, the `<head>` script applying it before the app starts, and the toggle on the About page |

Write tests that cannot pass by luck. Runs that must finish use data that linear scaling solves in a few generations. Runs that must not finish use Target R² 1 with a target the operators cannot fit exactly, such as `sin(x)` with `+ - *`. To prove that a resumed run continues, `recordGenerations(page)` records every value the Generation counter shows. Use Slow speed when the generations in question would otherwise arrive in a single Fast batch.

Prefer finding elements by role, label or visible text, as these tests do, over CSS classes, so styling changes do not break them. Note that an `aria-label` replaces a button's visible text as its name (the replay button is "Play replay", not "▶ Replay").

**Chart tests** read pixels back from the canvases (`colorNear`, `countColor`, `greenNear`) at positions computed with the same `shared.js` functions the page draws with; they never compare screenshots, so fonts and anti-aliasing do not matter. The canvases are transparent, so a pixel that a line only partly covers keeps the line's colour at a lower alpha. Lines that cross blend, such as the target line on a grid line, which is why it is checked as "clearly green" rather than an exact colour. `storeSession(page, state)` writes a checkpoint into IndexedDB so that a reload restores a run with a fixed progress history, which makes the progress chart deterministic. The canvas layout (sizes and margins) is repeated in the test, so update both when it changes.

**Chart colours follow the theme.** A canvas is not styled by CSS, so `app.js` reads the colours when it draws: `chartColors()` resolves each role in `CHART_COLOR_TOKENS` to a CSS custom property on `<html>`. Lines and points use the same `--key-*` tokens as the caption keys, so they always match; the background, grid, frame and labels use `--chart-bg`, `--chart-grid`, `--chart-frame` and `--chart-text`. Each theme block in `style.css` defines all of them. `applyTheme()` sends an `equvolve:themechange` event on `window`, and the Home page redraws both charts when it arrives, so a toggle or a device switch recolours them at once. To change a chart colour, change its token in all three theme blocks; `chart-theme.test.js` checks that every line colour keeps a 3:1 contrast (labels 4.5:1) with the chart background.

## Benchmark

`npm run bench` (`bench/benchmark.js`) runs six targets with the app's default settings through the same worker harness, and prints a Markdown table. Arguments: `node bench/benchmark.js [runsPerTarget=20] [targetIndex]`. A full run takes about 15 minutes. When you change the engine, rerun it and update the [Example results](../README.md#example-results) table. A difference of a few runs out of 20 is within noise.
