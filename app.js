// Vue UI for the Browser Genetic Programming playground.
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
  mutationRate: 0.2,
  crossoverRate: 0.8,
  elitismRate: 0.02,
  tournamentSize: 5,
  treeDepth: 4,
  maxTreeDepth: 8,
  linearScaling: true,
  dataMode: 'formula'
};

const MAX_SERIES_POINTS = 1000;
const HISTORY_LENGTH = 5;

const OP_LABELS = { '*': '×', '/': '÷', '-': '−' };

const Home = {
  template: `
  <div class="container">

    <header class="page-header">
      <h1>Browser Genetic Programming</h1>
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
          A header row, then two numeric columns <code>x,y</code>.
        </p>

        <div v-if="uploadedFileName" class="code">
          Loaded {{ uploadedFileName }}: {{ uploadedData.length }} points
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
      </div>

      <template v-if="best">
        <h3>Best program</h3>

        <div class="code expression">y = {{ expression }}</div>

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
          <figcaption>
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
          Orange: operators · green: the variable x · khaki: constants.
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

      // results
      generation: 0,
      best: null,
      bestFitness: null,
      bestR2: null,
      bestSize: null,
      history: [],
      series: [],

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

    expression() {
      return this.best ? toInfix(this.best) : '';
    },

    exportText() {
      return this.best ? exportProgram(this.best, this.exportFormat) : '';
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
      return layoutTree(this.best);
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

    window.addEventListener('beforeunload', () => {
      if (this.evolutionState === 'running') {
        this.saveCheckpoint(true);
      }
    });
  },

  beforeUnmount() {
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
        dataMode: this.dataMode,
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

      // make sure the paused state survives a browser shutdown
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

      this.evolutionState = 'running';
      this.statusMessage = '';
      this.shareUrl = '';

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

        if (msg.type === 'update') {
          this.applyResult(msg);

          this.latestPopulation = msg.population;

          this.recordProgress(msg.generation, msg.r2, msg.medianR2);

          this.history.unshift({
            generation: msg.generation,
            r2: msg.r2,
            expression: toInfix(msg.model)
          });

          if (this.history.length > HISTORY_LENGTH) {
            this.history.pop();
          }

          this.drawCanvas();
          this.drawProgress();

          this.saveBest();
          this.saveCheckpoint();
        }

        if (msg.type === 'finished') {
          this.applyResult(msg);

          this.evolutionState = 'paused';

          this.statusMessage = msg.reason === 'targetReached' ?
            `Target R² reached at generation ${msg.generation}.` :
            `Stopped at Max Generations (${msg.generation}). Increase Max Generations and press Resume to continue.`;

          this.drawCanvas();
          this.saveCheckpoint(true);
        }
      };
    },

    applyResult(msg) {
      this.best = msg.model;
      this.bestFitness = msg.fitness;
      this.bestR2 = msg.r2;
      this.bestSize = msg.size;
      this.generation = msg.generation;
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

      this.uploadedFileName = file.name;

      const reader = new FileReader();

      reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(',');

          if (parts.length < 2) continue;

          const x = Number(parts[0]);
          const y = Number(parts[1]);

          if (Number.isFinite(x) && Number.isFinite(y)) {
            data.push({ x, y });
          }
        }

        this.uploadedData = data;
      };

      reader.readAsText(file);
    },

    // =========================
    // DRAWING
    // =========================

    drawCanvas() {
      const canvas = this.$refs.canvas;

      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const points = this.sampleData || [];

      if (!points.length) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const p of points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }

      if (minX === maxX) {
        minX -= 1;
        maxX += 1;
      }

      if (minY === maxY) {
        minY -= 1;
        maxY += 1;
      }

      const padding = 20;
      const w = canvas.width - padding * 2;
      const h = canvas.height - padding * 2;

      const toScreenX = (x) => padding + ((x - minX) / (maxX - minX)) * w;
      const toScreenY = (y) => canvas.height - padding - ((y - minY) / (maxY - minY)) * h;

      // best program, clipped to the plot area
      if (this.best) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.clip();

        ctx.beginPath();

        let penDown = false;

        for (let px = 0; px <= w; px++) {
          const x = minX + (px / w) * (maxX - minX);
          const y = evaluateTree(this.best, x);

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

        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // data points (downsampled for drawing only)
      const maxPoints = 60;
      const step = Math.max(1, points.length / maxPoints);

      ctx.fillStyle = '#00b7c7';

      for (let i = 0; i < points.length; i += step) {
        const p = points[Math.floor(i)];

        ctx.beginPath();
        ctx.arc(toScreenX(p.x), toScreenY(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    drawProgress() {
      const canvas = this.$refs.progress;

      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;
      const left = 84;
      const right = 12;
      const top = 12;
      const bottom = 28;
      const minLog = -6;

      ctx.clearRect(0, 0, W, H);
      ctx.font = '11px sans-serif';

      const lastG = this.series.length ? this.series[this.series.length - 1].g : 1;
      const maxG = Math.max(lastG, 2);

      const toX = (g) => left + ((g - 1) / (maxG - 1)) * (W - left - right);
      const toY = (r2) => {
        const err = 1 - r2;
        const v = Number.isFinite(err) && err > 0 ? Math.log10(err) : (err <= 0 ? minLog : 0);
        const clamped = Math.min(0, Math.max(minLog, v));
        return top + (clamped / minLog) * (H - top - bottom);
      };

      // y grid: R² = 0, 0.9, 0.99, ...
      ctx.strokeStyle = '#ddd';
      ctx.fillStyle = '#555';
      ctx.textAlign = 'right';

      for (let k = 0; k >= minLog; k--) {
        const r2 = 1 - Math.pow(10, k);
        const y = toY(r2);

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(W - right, y);
        ctx.stroke();

        ctx.fillText(`R² ${k === 0 ? '0' : r2.toFixed(-k)}`, left - 6, y + 4);
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
        ctx.strokeStyle = 'green';
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
        line('median', '#999', 1.5);
        line('best', 'red', 2);

        // mark the latest best so a one-generation run is visible too
        const last = this.series[this.series.length - 1];
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(toX(last.g), toY(last.best), 3.5, 0, Math.PI * 2);
        ctx.fill();
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
      item.label = node === 'x' ? 'x' : formatNumber(node, 4);
      item.color = node === 'x' ? 'lightgreen' : 'khaki';
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

const About = {

  data() {
    return {
      content: 'Loading README.md …'
    };
  },

  async mounted() {
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/bowo-prasetyo/genetic-programming/main/README.md'
      );

      this.content = marked.parse(await response.text());
    } catch (e) {
      this.content = '<p>Failed to load README.md</p>';
      console.error(e);
    }
  },

  template: `
    <div class="container about">
      <div v-html="content"></div>
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

const app = Vue.createApp({});

app.use(router);

app.mount('#app');
