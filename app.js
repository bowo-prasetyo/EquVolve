// Vue UI for EquVolve, the in-browser genetic programming playground.
// Shared helpers come from shared.js (loaded first in index.html).

const OPERATOR_GROUPS = [
  { name: 'Arithmetic', ops: ['+', '-', '*', '/', 'pow'] },
  { name: 'Trigonometric', ops: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'] },
  { name: 'Hyperbolic', ops: ['sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'] },
  { name: 'Exponential & log', ops: ['exp', 'log', 'log2', 'log10'] },
  { name: 'Roots', ops: ['sqrt', 'cbrt'] }
];

const OPERATOR_PRESETS = [
  { name: 'Polynomial', ops: ['+', '-', '*'] },
  { name: 'Rational', ops: ['+', '-', '*', '/'] },
  { name: 'Trigonometric', ops: ['+', '-', '*', '/', 'sin', 'cos'] },
  { name: 'Exp / Log', ops: ['+', '-', '*', '/', 'exp', 'log'] },
  { name: 'Everything', ops: Object.keys(OP_ARITY) }
];

const SETTING_FIELDS = [
  { key: 'populationSize', label: 'Population Size', step: 1, hint: 'Individuals per generation.' },
  { key: 'maxGenerations', label: 'Max Generations', step: 1, hint: 'Stop after this many generations.' },
  { key: 'targetR2', label: 'Target R²', step: 0.001, hint: 'Stop as soon as the best program reaches this R² (1 = perfect fit).' },
  { key: 'crossoverRate', label: 'Crossover Rate', step: 0.05, hint: 'Probability that an offspring is made by subtree crossover rather than copying a parent.' },
  { key: 'mutationRate', label: 'Mutation Rate', step: 0.05, hint: 'Probability that an offspring is then mutated (subtree or point mutation).' },
  { key: 'elitismRate', label: 'Elitism Rate', step: 0.01, hint: 'Fraction of the best programs copied unchanged to the next generation.' },
  { key: 'tournamentSize', label: 'Tournament Size', step: 1, hint: 'Programs compared in each selection tournament; larger = greedier.' },
  { key: 'treeDepth', label: 'Initial Tree Depth', step: 1, hint: 'Maximum depth of the random programs that start the run.' },
  { key: 'maxTreeDepth', label: 'Max Tree Depth', step: 1, hint: `Hard depth limit for evolved programs (up to ${MAX_TREE_DEPTH_LIMIT}); limits bloat.` }
];

const EXPORT_FORMATS = [
  { key: 'plain', label: 'Formula' },
  { key: 'js', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
  { key: 'latex', label: 'LaTeX' }
];

const DEFAULTS = {
  targetFormula: 'x*x + 2',
  minX: -5,
  maxX: 5,
  sampleCount: DEFAULT_SAMPLE_COUNT,
  populationSize: 200,
  targetR2: 0.999,
  maxGenerations: 500,
  enabledOperators: ['+', '-', '*'],
  mutationRate: 0.1,
  crossoverRate: 0.7,
  elitismRate: 0.05,
  tournamentSize: 5,
  treeDepth: 4,
  maxTreeDepth: 8,
  linearScaling: true,
  constantOptimization: false,
  speed: 'fast',
  dataMode: 'formula',
  variables: ['x'],
  targetName: ''
};

const MAX_SERIES_POINTS = 1000;
const MAX_TIMELINE = 300;
const HISTORY_LENGTH = 5;
const REPLAY_INTERVAL_MS = 450;

// Sent on window whenever the theme is applied (see applyTheme).
const THEME_CHANGE_EVENT = 'equvolve:themechange';

// At most this many data points are drawn on the fit chart (the engine
// still trains on all of them).
const FIT_MAX_POINTS = 60;
const PREDICTED_MAX_POINTS = 400;

const OP_LABELS = { '*': '×', '/': '÷', '-': '−' };

const Home = {
  template: `
  <div class="container">

    <header class="page-header">
      <h1 class="brand">
        <img src="assets/logo-mark.svg" alt="" class="brand-mark">
        <span>Equ<span class="brand-accent">Volve</span></span>
      </h1>
      <p class="tagline">
        Evolve a formula that explains your data, live and entirely in your browser.
      </p>
    </header>

    <!-- ===================== 1. TARGET ===================== -->
    <section class="panel">
      <h2>1. Target</h2>

      <div class="field-row">
        <span class="field-label">Data source</span>

        <label class="inline">
          <input type="radio" value="formula" v-model="dataMode" :disabled="isRunning">
          Generate from formula
        </label>

        <label class="inline">
          <input type="radio" value="dataset" v-model="dataMode" :disabled="isRunning">
          Upload dataset
        </label>
      </div>

      <template v-if="dataMode === 'formula'">
        <div class="field-row">
          <label class="field-label" for="formula">Formula</label>
          <input id="formula" class="wide" v-model="targetFormula" placeholder="x*x + 2" :disabled="isRunning">
        </div>

        <div class="field-row">
          <span class="field-label">X range</span>
          <input type="number" v-model.number="minX" :disabled="isRunning" aria-label="Minimum x">
          <span>to</span>
          <input type="number" v-model.number="maxX" :disabled="isRunning" aria-label="Maximum x">
        </div>

        <div class="field-row">
          <label class="field-label" for="samples">Sample points</label>
          <input id="samples" type="number" min="2" step="1" v-model.number="sampleCount" :disabled="isRunning">
          <span class="hint">evenly spaced across the X range; used for both training and the graph</span>
        </div>

        <p class="hint">
          Write formulas in <code>x</code> with Math functions and constants:
          <code>sin(x)</code>, <code>pow(x, 2)</code>, <code>exp(-x*x)</code>, <code>PI * x</code>, or <code>Math.sin(x)</code>.
        </p>
      </template>

      <template v-else>
        <div class="field-row">
          <label class="field-label" for="csv">CSV file</label>
          <input id="csv" type="file" accept=".csv,text/csv" @change="handleFileUpload" :disabled="isRunning">
        </div>

        <p class="hint">
          A header row, then numeric columns. One column is the target to predict (the last one by default);
          every other column becomes an input variable (up to {{ maxVariables }}).
          With a single input the variable is called <code>x</code>.
        </p>

        <div v-if="csvTable && csvTable.headers.length > 2" class="field-row">
          <label class="field-label" for="target-column">Target column</label>
          <select id="target-column" v-model.number="targetColumn" @change="applyTable" :disabled="isRunning">
            <option v-for="(h, i) in csvTable.headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>

        <div v-if="uploadedFileName" class="code">
          Loaded {{ uploadedFileName }}: {{ uploadedData.length }} rows
          <template v-if="isMultiVariable">
            · inputs: {{ variables.join(', ') }}<template v-if="targetName"> · target: {{ targetName }}</template>
          </template>
        </div>
      </template>
    </section>

    <!-- ===================== 2. SETTINGS ===================== -->
    <section class="panel">
      <details open>
        <summary><h2>2. Settings</h2></summary>

        <div class="settings-grid">
          <label v-for="f in settingFields" :key="f.key" class="setting" :title="f.hint">
            <span class="field-label">{{ f.label }}</span>
            <input type="number" :step="f.step" v-model.number="$data[f.key]" :disabled="isRunning">
            <span class="hint">{{ f.hint }}</span>
          </label>

          <label class="setting">
            <span class="field-label">
              <input type="checkbox" v-model="linearScaling" :disabled="isRunning">
              Linear scaling
            </span>
            <span class="hint">
              Score each program as a + b·f(x) with the best-fitting a and b, so evolution only has to find the shape.
            </span>
          </label>

          <label class="setting">
            <span class="field-label">
              <input type="checkbox" v-model="constantOptimization" :disabled="isRunning">
              Constant optimisation
            </span>
            <span class="hint">
              Each generation, fine-tune the numbers inside a random 10% of programs (such as the 1/3 in exp(x/3)).
              Experimental and off by default: in our benchmark it did not improve results.
            </span>
          </label>

          <label class="setting">
            <span class="field-label">Speed</span>
            <select v-model="speed" :disabled="isRunning">
              <option value="fast">Fast</option>
              <option value="slow">Slow: one generation at a time</option>
            </select>
            <span class="hint">
              Fast runs many generations between screen updates. Slow is for watching each step.
            </span>
          </label>
        </div>

        <h3>Operators</h3>

        <div class="preset-row">
          <span class="hint">Presets:</span>
          <button
            v-for="p in operatorPresets"
            :key="p.name"
            class="small"
            :class="{ active: isPreset(p) }"
            @click="enabledOperators = [...p.ops]"
            :disabled="isRunning"
          >{{ p.name }}</button>
        </div>

        <div class="operator-groups">
          <fieldset v-for="g in operatorGroups" :key="g.name">
            <legend>{{ g.name }}</legend>
            <label v-for="op in g.ops" :key="op" class="inline">
              <input type="checkbox" :value="op" v-model="enabledOperators" :disabled="isRunning">
              {{ op }}
            </label>
          </fieldset>
        </div>
      </details>
    </section>

    <!-- ===================== CONTROLS ===================== -->
    <div v-if="errorMessages.length" class="code error" role="alert">
      <div v-for="(msg, i) in errorMessages" :key="i">{{ msg }}</div>
    </div>

    <div v-if="statusMessage" class="code status" role="status">
      {{ statusMessage }}
    </div>

    <div class="controls">
      <button class="primary" @click="mainAction" :disabled="isRunning">
        {{ mainButtonText }}
      </button>

      <button v-if="!isIdle" @click="secondaryAction">
        {{ secondaryButtonText }}
      </button>

      <button v-if="best && !isRunning" @click="shareRun">
        Copy share link
      </button>
    </div>

    <div v-if="shareUrl" class="field-row">
      <input class="wide" readonly :value="shareUrl" @focus="$event.target.select()" aria-label="Share link">
    </div>

    <!-- ===================== 3. RESULTS ===================== -->
    <section class="panel">
      <h2>3. Results</h2>

      <div class="stat-row">
        <div class="stat"><span>Generation</span><b>{{ generation }}</b></div>
        <div class="stat"><span>Best R²</span><b>{{ formatR2(bestR2) }}</b></div>
        <div class="stat"><span>Program size</span><b>{{ bestSize ?? '–' }}</b></div>
        <div class="stat"><span>Speed</span><b>{{ speedText }}</b></div>
      </div>

      <template v-if="best">
        <h3>{{ replayEntry ? 'Replay: best program at generation ' + replayEntry.g : 'Best program' }}</h3>

        <div class="code expression" :class="{ replaying: replayEntry }">y = {{ expression }}</div>

        <div v-if="timeline.length > 1 && !isRunning" class="replay">
          <button class="small" @click="toggleReplay" :aria-label="replayTimer ? 'Pause replay' : 'Play replay'">
            {{ replayTimer ? '⏸ Pause' : '▶ Replay' }}
          </button>

          <input
            type="range"
            min="0"
            :max="timeline.length - 1"
            step="1"
            :value="replayIndex ?? timeline.length - 1"
            @input="seekReplay(Number($event.target.value))"
            aria-label="Replay position"
          >

          <span class="hint">
            {{ replayEntry ? 'generation ' + replayEntry.g + ' · R² ' + formatR2(replayEntry.r2) : 'latest' }}
            · {{ timeline.length }} improvements
          </span>

          <button v-if="replayEntry" class="small" @click="stopReplay">Back to latest</button>
        </div>

        <div class="export">
          <div class="tabs" role="tablist">
            <button
              v-for="f in exportFormats"
              :key="f.key"
              class="small"
              role="tab"
              :aria-selected="exportFormat === f.key"
              :class="{ active: exportFormat === f.key }"
              @click="exportFormat = f.key"
            >{{ f.label }}</button>

            <button class="small" @click="copyExport">{{ copyLabel }}</button>
          </div>

          <pre class="code export-text">{{ exportText }}</pre>
        </div>
      </template>

      <div class="charts">
        <figure>
          <figcaption v-if="isMultiVariable">
            Fit: <span class="key cyan">predicted vs actual</span> for each row; points on the
            <span class="key red">diagonal</span> are predicted exactly
          </figcaption>
          <figcaption v-else>
            Fit: <span class="key cyan">data</span> and <span class="key red">best program</span>
          </figcaption>
          <canvas ref="canvas" width="600" height="300"></canvas>
        </figure>

        <figure>
          <figcaption>
            Progress per generation (log scale of 1 − R²):
            <span class="key red">best</span>
            <span class="key grey">median</span>
            <span class="key green">target</span>
            <span v-if="replayEntry" class="key blue">replay</span>
          </figcaption>
          <canvas ref="progress" width="600" height="300"></canvas>
        </figure>
      </div>

      <template v-if="best">
        <h3>Expression tree</h3>

        <svg
          class="tree"
          :viewBox="treeLayout.viewBox"
          :style="{ maxWidth: treeLayout.width + 'px' }"
          role="img"
          :aria-label="'Expression tree for y = ' + expression"
        >
          <line
            v-for="(n, i) in treeLayout.nodes"
            v-show="n.parent"
            :key="'e' + i"
            :x1="n.parent && n.parent.x"
            :y1="n.parent && n.parent.y"
            :x2="n.x"
            :y2="n.y"
            class="edge"
          />

          <g v-for="(n, i) in treeLayout.nodes" :key="'n' + i">
            <circle :cx="n.x" :cy="n.y" r="18" :fill="n.color" />
            <text :x="n.x" :y="n.y + 4" text-anchor="middle" :font-size="n.label.length > 4 ? 9 : 12">
              {{ n.label }}
            </text>
          </g>
        </svg>

        <p class="hint">
          Orange: operators · green: variables · khaki: constants.
        </p>
      </template>

      <template v-if="history.length">
        <h3>Recent generations</h3>

        <div v-for="item in history" :key="item.generation" class="code history">
          Generation {{ item.generation }} · R² {{ formatR2(item.r2) }} · {{ item.expression }}
        </div>
      </template>
    </section>

  </div>
  `,

  data() {
    return {
      worker: null,
      db: null,

      // run settings
      ...JSON.parse(JSON.stringify(DEFAULTS)),
      uploadedData: [],
      uploadedFileName: '',
      csvTable: null,
      targetColumn: 0,
      maxVariables: MAX_VARIABLES,

      // results
      generation: 0,
      best: null,
      bestFitness: null,
      bestR2: null,
      bestSize: null,
      history: [],
      series: [],
      timeline: [],
      replayIndex: null,
      replayTimer: null,
      gensPerSecond: null,

      // ui
      evolutionState: 'idle', // idle | running | paused
      statusMessage: '',
      errorMessages: [],
      exportFormat: 'plain',
      copyLabel: 'Copy',
      shareUrl: '',

      // a checkpoint is written whenever the best fitness improves,
      // and at least every `checkpointInterval` generations regardless
      checkpointInterval: 10,
      lastCheckpointGeneration: 0,
      lastCheckpointFitness: Infinity,
      lastSavedBestFitness: Infinity,

      settingFields: SETTING_FIELDS,
      operatorGroups: OPERATOR_GROUPS,
      operatorPresets: OPERATOR_PRESETS,
      exportFormats: EXPORT_FORMATS
    };
  },

  computed: {

    activeVariables() {
      return this.dataMode === 'dataset' ? this.variables : ['x'];
    },

    isMultiVariable() {
      return this.activeVariables.length > 1;
    },

    replayEntry() {
      return this.replayIndex === null ? null : this.timeline[this.replayIndex] || null;
    },

    // the program on screen: the replay position, or the latest best
    displayModel() {
      return this.replayEntry ? this.replayEntry.model : this.best;
    },

    expression() {
      return this.displayModel ? toInfix(this.displayModel) : '';
    },

    exportText() {
      return this.displayModel ?
        exportProgram(this.displayModel, this.exportFormat, this.activeVariables) :
        '';
    },

    speedText() {
      if (!this.gensPerSecond) return '–';
      return `${this.gensPerSecond >= 10 ? Math.round(this.gensPerSecond) : this.gensPerSecond.toFixed(1)} gen/s`;
    },

    sampleData() {

      if (this.dataMode === 'dataset') {
        return this.uploadedData;
      }

      // formula mode: the exact grid the engine trains on
      try {
        return generateFormulaSamples(
          this.targetFormula,
          this.minX,
          this.maxX,
          this.sampleCount
        );
      } catch (e) {
        return [];
      }
    },

    treeLayout() {
      return layoutTree(this.displayModel);
    },

    isRunning() {
      return this.evolutionState === 'running';
    },

    isPaused() {
      return this.evolutionState === 'paused';
    },

    isIdle() {
      return this.evolutionState === 'idle';
    },

    mainButtonText() {
      switch (this.evolutionState) {
        case 'paused': return 'Clear Results';
        case 'running': return 'Running…';
        default: return 'Start Evolution';
      }
    },

    secondaryButtonText() {
      return this.evolutionState === 'paused' ? 'Resume' : 'Stop';
    }
  },

  watch: {
    // redraw the target when its inputs change (before a run starts)
    sampleData() {
      this.drawCanvas();
    },

    targetR2() {
      this.drawProgress();
    },

    displayModel() {
      this.drawCanvas();
    },

    replayIndex() {
      this.drawProgress();
    }
  },

  created() {
    // Kept off the reactive data on purpose: it is replaced every
    // generation and is only needed for checkpoints.
    this.latestPopulation = [];
  },

  mounted() {
    const sharedCode = this.$route.query.run;

    this.initDB(!sharedCode);

    if (sharedCode) {
      this.loadSharedRun(String(sharedCode));
    }

    this.drawCanvas();
    this.drawProgress();

    // redraw the charts in the new colours when the theme changes
    this.redrawCharts = () => {
      this.drawCanvas();
      this.drawProgress();
    };
    window.addEventListener(THEME_CHANGE_EVENT, this.redrawCharts);

    window.addEventListener('beforeunload', () => {
      if (this.evolutionState === 'running') {
        this.saveCheckpoint(true);
      }
    });
  },

  beforeUnmount() {
    this.pauseReplay();
    window.removeEventListener(THEME_CHANGE_EVENT, this.redrawCharts);

    if (this.worker) {
      this.worker.terminate();
    }
  },

  methods: {

    formatR2(r2) {
      if (r2 == null || !Number.isFinite(r2)) return '–';
      return r2 >= 0.99 ? r2.toFixed(6) : r2.toFixed(4);
    },

    isPreset(preset) {
      return preset.ops.length === this.enabledOperators.length &&
        preset.ops.every(op => this.enabledOperators.includes(op));
    },

    // =========================
    // STORAGE
    // =========================

    initDB(offerRestore = true) {

      // The name predates EquVolve; keep it so sessions saved before the rename still restore.
      const request = indexedDB.open('gp-db', 2);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('bestPrograms')) {
          db.createObjectStore('bestPrograms', { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;

        if (offerRestore) {
          this.checkRestorableSession();
        }
      };
    },

    saveBest() {

      if (!this.db || this.bestFitness >= this.lastSavedBestFitness) {
        return;
      }

      this.lastSavedBestFitness = this.bestFitness;

      this.db
        .transaction(['bestPrograms'], 'readwrite')
        .objectStore('bestPrograms')
        .add({
          timestamp: Date.now(),
          fitness: this.bestFitness,
          r2: this.bestR2,
          tree: compressTree(this.best),
          generation: this.generation
        });
    },

    saveCheckpoint(force = false) {

      if (!this.db || !this.worker) {
        return;
      }

      const improved = this.bestFitness < this.lastCheckpointFitness;
      const due = this.generation - this.lastCheckpointGeneration >= this.checkpointInterval;

      if (!force && !improved && !due) {
        return;
      }

      this.lastCheckpointFitness = Math.min(this.lastCheckpointFitness, this.bestFitness);
      this.lastCheckpointGeneration = this.generation;

      const state = {
        id: 'latest',
        timestamp: Date.now(),
        generation: this.generation,
        population: (this.latestPopulation || []).map(compressTree),
        model: compressTree(this.best),
        bestFitness: this.bestFitness,
        bestR2: this.bestR2,
        bestSize: this.bestSize,
        history: JSON.parse(JSON.stringify(this.history)),
        series: this.series.map(p => [p.g, p.best, p.median]),
        timeline: this.timeline.map(t => [t.g, t.r2, t.fitness, compressTree(t.model)]),
        config: {
          ...this.buildConfig(),
          uploadedFileName: this.uploadedFileName
        }
      };

      this.db
        .transaction(['sessions'], 'readwrite')
        .objectStore('sessions')
        .put(state);
    },

    checkRestorableSession() {

      if (!this.db) {
        return;
      }

      const request = this.db
        .transaction(['sessions'], 'readonly')
        .objectStore('sessions')
        .get('latest');

      request.onsuccess = () => {
        const result = request.result;

        if (result && confirm('Restore previous GP evolution session?')) {
          this.restoreSession(result);
        }
      };
    },

    applySettings(config) {
      // use ?? so legitimate zero values (e.g. mutation rate 0) survive
      for (const key of Object.keys(DEFAULTS)) {
        const source = key === 'enabledOperators' ? 'operators' : key;
        const value = config[source] ?? DEFAULTS[key];
        this[key] = Array.isArray(value) ? [...value] : value;
      }
    },

    restoreSession(state) {

      // fills settings that older sessions did not have
      const config = normalizeConfig(state.config);

      this.applySettings(config);

      this.uploadedData = config.dataset ?? [];
      this.uploadedFileName = config.uploadedFileName || 'Restored Dataset';

      this.generation = state.generation || 0;
      // older sessions stored the raw best program as `best`
      this.best = decompressTree(state.model ?? state.best);
      this.bestFitness = state.bestFitness ?? null;
      this.bestR2 = state.bestR2 ?? null;
      this.bestSize = state.bestSize ?? (this.best ? treeSize(this.best) : null);
      this.history = (state.history || []).slice(0, HISTORY_LENGTH);
      this.series = (state.series || []).map(([g, best, median]) => ({ g, best, median }));
      this.timeline = (state.timeline || []).map(([g, r2, fitness, model]) => ({
        g, r2, fitness, model: decompressTree(model)
      }));
      this.replayIndex = null;

      this.evolutionState = 'paused';
      this.statusMessage = `Restored session at generation ${this.generation}. Press Resume to continue.`;

      this.latestPopulation = (state.population || [])
        .map(decompressTree)
        .filter(Boolean);

      this.lastCheckpointFitness = this.bestFitness ?? Infinity;
      this.lastCheckpointGeneration = this.generation;
      this.lastSavedBestFitness = this.bestFitness ?? Infinity;

      this.worker = new Worker('worker.js');
      this.bindWorker();

      this.worker.postMessage({
        type: 'restore',
        state: {
          generation: this.generation,
          population: this.latestPopulation,
          config
        }
      });

      this.drawCanvas();
      this.drawProgress();
    },

    // =========================
    // RUN CONTROL
    // =========================

    buildConfig() {
      return {
        targetFormula: this.targetFormula,
        minX: this.minX,
        maxX: this.maxX,
        sampleCount: this.sampleCount,
        populationSize: this.populationSize,
        targetR2: this.targetR2,
        maxGenerations: this.maxGenerations,
        operators: [...this.enabledOperators],
        mutationRate: this.mutationRate,
        crossoverRate: this.crossoverRate,
        elitismRate: this.elitismRate,
        tournamentSize: this.tournamentSize,
        treeDepth: this.treeDepth,
        maxTreeDepth: this.maxTreeDepth,
        linearScaling: this.linearScaling,
        constantOptimization: this.constantOptimization,
        speed: this.speed,
        dataMode: this.dataMode,
        variables: [...this.activeVariables],
        targetName: this.targetName,
        dataset: JSON.parse(JSON.stringify(this.uploadedData))
      };
    },

    // Returns the config if valid, otherwise shows the problems and
    // returns null.
    validatedConfig() {
      const config = this.buildConfig();
      const errors = validateConfig(config);

      this.errorMessages = errors;

      return errors.length ? null : config;
    },

    resetResults() {
      this.best = null;
      this.bestFitness = null;
      this.bestR2 = null;
      this.bestSize = null;
      this.history = [];
      this.series = [];
      this.timeline = [];
      this.stopReplay();
      this.gensPerSecond = null;
      this.speedMark = null;
      this.generation = 0;
      this.latestPopulation = [];
      this.lastCheckpointFitness = Infinity;
      this.lastSavedBestFitness = Infinity;
      this.lastCheckpointGeneration = 0;
      this.shareUrl = '';
    },

    startEvolution() {

      const config = this.validatedConfig();

      if (!config) {
        return;
      }

      if (this.worker) {
        this.worker.terminate();
      }

      this.resetResults();
      this.evolutionState = 'running';
      this.statusMessage = '';

      this.worker = new Worker('worker.js');
      this.bindWorker();

      this.worker.postMessage({ type: 'start', config });
    },

    stopEvolution() {

      if (!this.worker) {
        return;
      }

      this.worker.postMessage({ type: 'stop' });

      this.evolutionState = 'paused';
      this.statusMessage = 'Paused.';

      // make sure the paused state survives a browser shutdown (saved
      // again with the exact population when the worker confirms)
      this.saveCheckpoint(true);
    },

    resumeEvolution() {

      if (!this.worker) {
        return;
      }

      const config = this.validatedConfig();

      if (!config) {
        return;
      }

      this.stopReplay();
      this.evolutionState = 'running';
      this.statusMessage = '';
      this.shareUrl = '';
      this.speedMark = null;

      this.worker.postMessage({ type: 'resume', config });
    },

    mainAction() {
      if (this.evolutionState === 'idle') {
        this.startEvolution();
      } else if (this.evolutionState === 'paused') {
        this.clearResults();
      }
    },

    secondaryAction() {
      if (this.evolutionState === 'running') {
        this.stopEvolution();
      } else if (this.evolutionState === 'paused') {
        this.resumeEvolution();
      }
    },

    clearResults() {

      if (!confirm('Clear all evolution results?')) {
        return;
      }

      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      this.resetResults();
      this.statusMessage = '';
      this.errorMessages = [];
      this.evolutionState = 'idle';

      this.drawCanvas();
      this.drawProgress();

      if (this.db) {
        const tx = this.db.transaction(['bestPrograms', 'sessions'], 'readwrite');
        tx.objectStore('bestPrograms').clear();
        tx.objectStore('sessions').delete('latest');
      }
    },

    bindWorker() {

      this.worker.onmessage = (e) => {
        const msg = e.data;

        if (msg.type !== 'update' && msg.type !== 'finished' && msg.type !== 'stopped') {
          return;
        }

        this.ingest(msg);

        if (msg.type === 'update') {
          this.saveBest();
          this.saveCheckpoint();
          return;
        }

        if (msg.type === 'finished') {
          this.evolutionState = 'paused';

          this.statusMessage = msg.reason === 'targetReached' ?
            `Target R² reached at generation ${msg.generation}.` :
            `Stopped at Max Generations (${msg.generation}). Increase Max Generations and press Resume to continue.`;
        }

        this.saveBest();
        this.saveCheckpoint(true);
      };
    },

    // Take in one worker message: it may cover several generations.
    ingest(msg) {
      this.best = msg.model;
      this.bestFitness = msg.fitness;
      this.bestR2 = msg.r2;
      this.bestSize = msg.size;

      this.measureSpeed(msg.generation);
      this.generation = msg.generation;

      if (msg.population) {
        this.latestPopulation = msg.population;
      }

      for (const [g, best, median] of msg.progress || []) {
        this.recordProgress(g, best, median);
      }

      for (const entry of msg.timeline || []) {
        this.recordTimeline(entry);
      }

      if (!this.history.length || this.history[0].generation !== msg.generation) {
        this.history.unshift({
          generation: msg.generation,
          r2: msg.r2,
          expression: toInfix(msg.model)
        });

        if (this.history.length > HISTORY_LENGTH) {
          this.history.pop();
        }
      }

      this.drawCanvas();
      this.drawProgress();
    },

    measureSpeed(generation) {
      const now = performance.now();
      const mark = this.speedMark;

      this.speedMark = { t: now, g: generation };

      if (!mark || generation <= mark.g || now <= mark.t) return;

      const rate = (generation - mark.g) / ((now - mark.t) / 1000);

      // smooth so the number is readable
      this.gensPerSecond = this.gensPerSecond ? 0.8 * this.gensPerSecond + 0.2 * rate : rate;
    },

    recordProgress(g, best, median) {
      this.series.push({ g, best, median });

      // keep the chart cheap on long runs: halve the resolution
      if (this.series.length > MAX_SERIES_POINTS) {
        const last = this.series[this.series.length - 1];
        this.series = this.series.filter((_, i) => i % 2 === 0);

        if (this.series[this.series.length - 1] !== last) {
          this.series.push(last);
        }
      }
    },

    recordTimeline(entry) {
      this.timeline.push(entry);

      // keep the first and latest entries, thin out the middle
      if (this.timeline.length > MAX_TIMELINE) {
        const last = this.timeline.length - 1;
        this.timeline = this.timeline.filter((_, i) => i === 0 || i === last || i % 2 === 1);
      }
    },

    // =========================
    // REPLAY
    // =========================

    seekReplay(index) {
      this.pauseReplay();
      this.replayIndex = index >= this.timeline.length - 1 ? null : index;
    },

    toggleReplay() {
      if (this.replayTimer) {
        this.pauseReplay();
        return;
      }

      // start from the beginning unless paused part-way
      if (this.replayIndex === null) {
        this.replayIndex = 0;
      }

      this.replayTimer = setInterval(() => {
        if (this.replayIndex === null || this.replayIndex >= this.timeline.length - 1) {
          this.stopReplay();
          return;
        }

        this.replayIndex++;
      }, REPLAY_INTERVAL_MS);
    },

    pauseReplay() {
      if (this.replayTimer) {
        clearInterval(this.replayTimer);
        this.replayTimer = null;
      }
    },

    stopReplay() {
      this.pauseReplay();
      this.replayIndex = null;
    },

    // =========================
    // EXPORT & SHARE
    // =========================

    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        return false;
      }
    },

    async copyExport() {
      const ok = await this.copyText(this.exportText);

      this.copyLabel = ok ? 'Copied!' : 'Copy failed: select the text manually';

      setTimeout(() => { this.copyLabel = 'Copy'; }, 2000);
    },

    async shareRun() {
      const payload = buildSharePayload({
        config: this.buildConfig(),
        model: this.best,
        r2: this.bestR2,
        generation: this.generation,
        fileName: this.uploadedFileName
      });

      const code = await encodeShare(payload);
      const url = `${location.origin}${location.pathname}#/?run=${code}`;

      this.shareUrl = url;

      const copied = await this.copyText(url);

      this.statusMessage = [
        copied ? 'Share link copied to the clipboard.' : 'Share link created below.',
        payload.datasetOmitted ?
          `The dataset has more than ${MAX_SHARED_POINTS} points, so it is not included; the recipient needs to upload it.` :
          'It contains the settings, the data and the best program, but not the population.'
      ].join(' ');
    },

    async loadSharedRun(code) {
      try {
        const shared = await decodeShare(code);
        const config = normalizeConfig({ ...this.buildConfig(), ...shared.config });

        this.applySettings(config);

        if (shared.config.dataset) {
          this.uploadedData = shared.config.dataset;
          this.uploadedFileName = shared.fileName || 'Shared dataset';
          this.csvTable = null;
        }

        this.resetResults();

        if (shared.model) {
          this.best = shared.model;
          this.bestR2 = shared.r2 ?? null;
          this.bestSize = treeSize(shared.model);
          this.generation = shared.generation ?? 0;
        }

        this.statusMessage = [
          shared.model ?
            `Loaded a shared run: R² ${this.formatR2(this.bestR2)} after ${this.generation} generation${this.generation === 1 ? '' : 's'}.` :
            'Loaded shared settings.',
          shared.datasetOmitted ?
            'Its dataset was too large to include; upload it to run.' :
            'Press Start Evolution to evolve it yourself.'
        ].join(' ');

        this.drawCanvas();
      } catch (e) {
        console.error(e);
        this.errorMessages = ['This share link could not be read. It may be incomplete; try copying it again.'];
      }

      // drop the code from the address bar so a reload is a clean start
      this.$router.replace({ query: {} });
    },

    // =========================
    // DATA
    // =========================

    handleFileUpload(event) {

      const file = event.target.files[0];

      if (!file) return;

      const reader = new FileReader();

      reader.onload = (e) => {
        const table = parseCsv(e.target.result);

        if (table.headers.length < 2 || !table.rows.length) {
          this.errorMessages = ['The CSV needs a header row and at least two numeric columns.'];
          return;
        }

        this.errorMessages = [];
        this.uploadedFileName = file.name;
        this.csvTable = table;
        this.targetColumn = table.headers.length - 1;
        this.applyTable();
      };

      reader.readAsText(file);
    },

    // Rebuild the training data from the uploaded table and the chosen
    // target column.
    applyTable() {
      if (!this.csvTable) return;

      const { variables, dataset } = datasetFromTable(this.csvTable, this.targetColumn);

      this.variables = variables;
      this.uploadedData = dataset;
      this.targetName = String(this.csvTable.headers[this.targetColumn] ?? '');
    },

    // =========================
    // DRAWING
    // =========================

    // The theme's chart colours, read when drawing so they follow a
    // theme switch.
    chartColors() {
      const style = getComputedStyle(document.documentElement);
      return chartColors((name) => style.getPropertyValue(name));
    },

    drawCanvas() {
      const canvas = this.$refs.canvas;

      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const points = this.sampleData || [];

      if (!points.length) return;

      const colors = this.chartColors();

      if (this.isMultiVariable) {
        this.drawPredictedVsActual(ctx, canvas, points, colors);
        return;
      }

      const { min: minX, max: maxX } = valueRange(points.map(p => p.x));
      const { min: minY, max: maxY } = valueRange(points.map(p => p.y));

      const padding = 20;
      const w = canvas.width - padding * 2;
      const h = canvas.height - padding * 2;

      const toScreenX = linearScale(minX, maxX, padding, padding + w);
      const toScreenY = linearScale(minY, maxY, canvas.height - padding, canvas.height - padding - h);

      // best program (or replay position), clipped to the plot area
      const model = this.displayModel;

      if (model) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.clip();

        ctx.beginPath();

        let penDown = false;

        for (let px = 0; px <= w; px++) {
          const x = minX + (px / w) * (maxX - minX);
          const y = evaluateTree(model, x);

          if (!Number.isFinite(y)) {
            penDown = false;
            continue;
          }

          if (penDown) {
            ctx.lineTo(toScreenX(x), toScreenY(y));
          } else {
            ctx.moveTo(toScreenX(x), toScreenY(y));
            penDown = true;
          }
        }

        ctx.strokeStyle = colors.model;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // data points (downsampled for drawing only)
      ctx.fillStyle = colors.data;

      for (const i of sampleIndices(points.length, FIT_MAX_POINTS)) {
        const p = points[i];

        ctx.beginPath();
        ctx.arc(toScreenX(p.x), toScreenY(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // With several inputs there is no single x axis: plot each row's
    // prediction against its actual value instead.
    drawPredictedVsActual(ctx, canvas, points, colors) {
      const model = this.displayModel;
      const pairs = sampleIndices(points.length, PREDICTED_MAX_POINTS).map((i) => {
        const p = points[i];
        return [p.y, model ? evaluateTree(model, p.v) : NaN];
      });

      const { min: lo, max: hi } = valueRange(points.map(p => p.y));

      const pad = 30;
      const size = Math.min(canvas.width, canvas.height) - pad * 2;
      const left = (canvas.width - size) / 2;
      const toX = linearScale(lo, hi, left, left + size);
      const toY = linearScale(lo, hi, canvas.height - pad, canvas.height - pad - size);

      ctx.save();

      // axes box and labels
      ctx.strokeStyle = colors.frame;
      ctx.strokeRect(left, pad, size, size);
      ctx.fillStyle = colors.text;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('actual', left + size / 2, canvas.height - 8);
      ctx.save();
      ctx.translate(left - 12, pad + size / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('predicted', 0, 0);
      ctx.restore();

      // perfect-prediction diagonal
      ctx.strokeStyle = colors.model;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(lo), toY(lo));
      ctx.lineTo(toX(hi), toY(hi));
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(left, pad, size, size);
      ctx.clip();

      ctx.fillStyle = colors.data;

      for (const [actual, predicted] of pairs) {
        if (!Number.isFinite(predicted)) continue;
        ctx.beginPath();
        ctx.arc(toX(actual), toY(predicted), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },

    drawProgress() {
      const canvas = this.$refs.progress;

      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const colors = this.chartColors();
      const W = canvas.width;
      const H = canvas.height;
      const left = 84;
      const right = 12;
      const top = 12;
      const bottom = 28;

      ctx.clearRect(0, 0, W, H);
      ctx.font = '11px sans-serif';

      const lastG = this.series.length ? this.series[this.series.length - 1].g : 1;
      const maxG = Math.max(lastG, 2);

      const toX = linearScale(1, maxG, left, W - right);
      const levelToY = linearScale(0, PROGRESS_MIN_LOG, top, H - bottom);
      const toY = (r2) => levelToY(progressLevel(r2));

      // y grid: R² = 0, 0.9, 0.99, ...
      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'right';

      for (const { r2, label } of progressGrid()) {
        const y = toY(r2);

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(W - right, y);
        ctx.stroke();

        ctx.fillText(label, left - 6, y + 4);
      }

      ctx.textAlign = 'center';
      ctx.fillText('generation', (left + W - right) / 2, H - 6);
      ctx.textAlign = 'left';
      ctx.fillText('1', left, H - 6);
      ctx.textAlign = 'right';
      ctx.fillText(String(maxG), W - right, H - 6);

      // target line
      if (Number.isFinite(this.targetR2) && this.targetR2 < 1) {
        const y = toY(this.targetR2);

        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = colors.target;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(W - right, y);
        ctx.stroke();
        ctx.restore();
      }

      const line = (key, color, width) => {
        ctx.beginPath();
        let started = false;

        for (const p of this.series) {
          const x = toX(p.g);
          const y = toY(p[key]);

          if (started) {
            ctx.lineTo(x, y);
          } else {
            ctx.moveTo(x, y);
            started = true;
          }
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.lineWidth = 1;
      };

      if (this.series.length) {
        line('median', colors.median, 1.5);
        line('best', colors.model, 2);

        // mark the latest best so a one-generation run is visible too
        const last = this.series[this.series.length - 1];
        ctx.fillStyle = colors.model;
        ctx.beginPath();
        ctx.arc(toX(last.g), toY(last.best), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // replay position
      if (this.replayEntry) {
        const x = toX(this.replayEntry.g);

        ctx.strokeStyle = colors.replay;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, H - bottom);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  }
};

// Tidy tree layout: leaves are spaced evenly left to right, each parent
// sits above the middle of its children, and the SVG viewBox is sized
// to fit, so any tree scales to the available width.
function layoutTree(root) {
  const nodes = [];
  const unit = 46;
  const level = 64;
  const pad = 24;
  let nextLeaf = 0;
  let maxDepth = 0;

  const place = (node, depth, parent) => {
    maxDepth = Math.max(maxDepth, depth);

    const item = { x: 0, y: pad + depth * level, parent, label: '', color: '' };
    nodes.push(item);

    if (typeof node === 'string' || typeof node === 'number') {
      item.x = pad + nextLeaf * unit;
      nextLeaf++;
      item.label = isVariable(node) ? node : formatNumber(node, 4);
      item.color = isVariable(node) ? 'lightgreen' : 'khaki';
      return item;
    }

    item.label = OP_LABELS[node.op] || node.op;
    item.color = 'orange';

    const kids = node.child !== undefined ?
      [place(node.child, depth + 1, item)] :
      [place(node.left, depth + 1, item), place(node.right, depth + 1, item)];

    item.x = (kids[0].x + kids[kids.length - 1].x) / 2;

    return item;
  };

  if (root != null) {
    place(root, 0, null);
  }

  const width = Math.max(1, nextLeaf - 1) * unit + pad * 2;
  const height = maxDepth * level + pad * 2;

  return {
    nodes,
    width,
    viewBox: `0 0 ${width} ${height}`
  };
}

const README_URL = 'https://raw.githubusercontent.com/bowo-prasetyo/equvolve/main/README.md';

// The anchor GitHub gives a heading, so the README's in-page links
// (such as #example-results) work here as they do on GitHub:
// lowercase, punctuation removed, spaces as hyphens, and -1, -2, ...
// added to repeated headings.
function headingSlug(text, used) {
  const base = text.trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');

  let slug = base;
  for (let k = 1; used.has(slug); k++) slug = `${base}-${k}`;

  used.add(slug);
  return slug;
}

const About = {

  data() {
    return {
      content: 'Loading README.md …'
    };
  },

  async mounted() {
    try {
      const response = await fetch(README_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.content = marked.parse(await response.text());

      await this.$nextTick();
      this.addHeadingIds();
    } catch (e) {
      this.content = '<p>Failed to load README.md</p>';
      console.error(e);
    }
  },

  methods: {
    addHeadingIds() {
      const used = new Set();

      for (const h of this.$refs.content.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
        h.id = headingSlug(h.textContent, used);
      }
    },

    // The app's routes live in the URL hash (#/about), so a plain
    // "#section" link would be read as a route and show a blank page.
    // Scroll to the section instead.
    followInPageLink(event) {
      const link = event.target.closest('a');
      const href = link && link.getAttribute('href');

      if (!href || !href.startsWith('#') || href.startsWith('#/')) return;

      event.preventDefault();

      const target = document.getElementById(decodeURIComponent(href.slice(1)));

      if (target) {
        target.scrollIntoView();
      }
    }
  },

  template: `
    <div class="container about">
      <div ref="content" v-html="content" @click="followInPageLink"></div>
    </div>
  `
};

const routes = [
  { path: '/', component: Home },
  { path: '/about', component: About }
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes
});

// ---------- theme ----------
// 'auto' follows the device's light/dark setting; 'light' and 'dark' are the
// visitor's own choice, remembered in this browser. index.html applies a
// stored choice before the first paint.

const THEME_KEY = 'equvolve-theme';
const THEME_ORDER = ['auto', 'light', 'dark'];
const THEME_LABELS = { auto: '🖥️ Auto', light: '☀️ Light', dark: '🌙 Dark' };
const THEME_TITLES = {
  auto: 'Theme follows your device. Click for light.',
  light: 'Light theme. Click for dark.',
  dark: 'Dark theme. Click to follow your device.'
};

function readThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch (e) {
    return 'auto';
  }
}

function applyTheme(preference) {
  const root = document.documentElement;
  if (preference === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);

  // Keep the mobile browser's toolbar colour in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim();

  // Canvas drawings do not follow CSS, so tell the charts to redraw.
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

const app = Vue.createApp({
  data() {
    return { themePreference: readThemePreference() };
  },

  computed: {
    themeLabel() {
      return THEME_LABELS[this.themePreference];
    },
    themeTitle() {
      return THEME_TITLES[this.themePreference];
    }
  },

  methods: {
    cycleTheme() {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(this.themePreference) + 1) % THEME_ORDER.length];
      this.themePreference = next;
      try {
        if (next === 'auto') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        // Storage can be blocked; the choice then lasts until the page closes.
      }
      applyTheme(next);
    }
  },

  mounted() {
    applyTheme(this.themePreference);
    // In auto mode, follow the device when it switches between light and dark.
    window.matchMedia('(prefers-color-scheme: light)')
      .addEventListener('change', () => applyTheme(this.themePreference));
  }
});

app.use(router);

app.mount('#app');
