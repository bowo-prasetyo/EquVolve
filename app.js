const Home = {
  template: `
  <div class="container">

    <h1>Browser Genetic Programming</h1>
    
    <div style="margin-top:20px; margin-bottom:20px; padding:15px; border:1px solid #444; border-radius:8px;">
    
      <h2>Target Input</h2>
  
      <div style="margin-bottom:15px;">
        <label><b>Data Source:</b></label>
      
        <label style="margin-left:10px;">
          <input
            type="radio"
            value="formula"
            v-model="dataMode"
            :disabled="isRunning"
          >
          Generate From Formula
        </label>
      
        <label style="margin-left:10px;">
          <input
            type="radio"
            value="dataset"
            v-model="dataMode"
            :disabled="isRunning"
          >
          Upload Dataset
        </label>
      </div>

      <div v-if="dataMode === 'formula'">
        <div style="margin-bottom:10px;">
          <label><b>Formula:</b></label>
      
          <input
            v-model="targetFormula"
            placeholder="x*x + 2"
            style="width:300px; padding:8px; margin-left:10px;"
            :disabled="isRunning"
          />
        </div>
      
        <div style="margin-bottom:10px;">
          <label><b>X Range:</b></label>
      
          <input
            type="number"
            v-model.number="minX"
            style="width:80px; padding:8px; margin-left:10px;"
            :disabled="isRunning"
          />
      
          <span style="margin:0 10px;">to</span>
      
          <input
            type="number"
            v-model.number="maxX"
            style="width:80px; padding:8px;"
            :disabled="isRunning"
          />
        </div>
      
        <div style="margin-bottom:10px;">
          <label><b>Sample Points:</b></label>

          <input
            type="number"
            v-model.number="sampleCount"
            min="2"
            step="1"
            style="width:80px; padding:8px; margin-left:10px;"
            :disabled="isRunning"
          />

          <span style="margin-left:10px; color:#aaa;">
            evenly spaced across the X Range; used for both training and the graph
          </span>
        </div>

        <div class="code" style="margin-top:15px;">
          Current Target: y = {{ targetFormula }}
          <br>
          <span style="color:#aaa;">
            Math functions can be written as sin(x), pow(x, 2), PI ... or Math.sin(x).
          </span>
        </div>
      </div>

      <div v-if="dataMode === 'dataset'">
        <div style="margin-bottom:10px;">
          <label><b>Upload CSV:</b></label>
      
          <input
            type="file"
            accept=".csv"
            @change="handleFileUpload"
            style="margin-left:10px;"
            :disabled="isRunning"
          />
        </div>
      
        <div class="code">
          Expected CSV format:
          x,y
          -5,12
          -4,7
          ...
        </div>
      
        <div
          v-if="uploadedFileName"
          class="code"
          style="margin-top:10px;"
        >
          Loaded:
          {{ uploadedFileName }}
      
          | Points:
          {{ uploadedData.length }}
        </div>
      </div>
    </div>

<div v-if="errorMessages.length" class="code error">
  <div v-for="(msg, i) in errorMessages" :key="i">{{ msg }}</div>
</div>

<div v-if="statusMessage" class="code status">
  {{ statusMessage }}
</div>

<button
  @click="mainAction"
  :disabled="isRunning"
>
  {{ mainButtonText }}
</button>

<button
  v-if="!isIdle"
  @click="secondaryAction"
>
  {{ secondaryButtonText }}
</button>

    <div>
    <canvas ref="canvas" width="600" height="300"></canvas>
    </div>

    <div>
    <svg width="1200" height="600">
    
      <g v-if="best">
        <template
          v-for="(item, index) in renderTree(best, 600, 40, 300)"
          :key="index"
        >
    
          <!-- edges -->
          <line
            v-if="item.parent"
            :x1="item.parent.x"
            :y1="item.parent.y"
            :x2="item.x"
            :y2="item.y"
            stroke="white"
          />
    
          <!-- node -->
          <circle
            :cx="item.x"
            :cy="item.y"
            r="20"
            :fill="item.color"
          />
    
          <!-- label -->
          <text
            :x="item.x"
            :y="item.y + 5"
            text-anchor="middle"
            fill="black"
            font-size="12"
          >
            {{ item.label }}
          </text>
    
        </template>
      </g>
    
    </svg>
    </div>

    <div class="stats">
      <div><b>Generation:</b> {{ generation }}</div>
      <div><b>Best R<sup>2</sup>:</b> {{ bestR2 }}</div>
      <div><b>Best Fitness:</b> {{ bestFitness }}</div>
      <div><b>Best Program:</b></div>

      <div class="code">
        {{ expression }}
      </div>

      <h3>Evolution History</h3>

      <div
        v-for="(item, index) in history"
        :key="index"
        class="code"
        style="margin-top:8px"
      >
        Generation {{ item.generation }}
        | Fitness: {{ item.fitness }}
        | R<sup>2</sup>: {{ item.r2 }}
        | Error: {{ item.error }}
        | {{ item.expression }}
      </div>

    </div>

    <div style="margin-top:20px; margin-bottom:20px; padding:15px; border:1px solid #444; border-radius:8px;">
    
      <h2>GP Parameters Settings</h2>
        <div style="margin-bottom:10px;">
          <label><b>Population Size:</b></label>
      
          <input
            type="number"
            v-model.number="populationSize"
            style="width:120px; padding:8px; margin-left:10px;"
            :disabled="isRunning"
          />
        </div>
      
        <div style="margin-bottom:10px;">
          <label><b>Max Generations:</b></label>
      
          <input
            type="number"
            v-model.number="maxGenerations"
            style="width:120px; padding:8px; margin-left:10px;"
            :disabled="isRunning"
          />
        </div>
  
        <div style="margin-bottom:10px;">
        <label><b>Target R<sup>2</sup>:</b></label>

        <input
          type="number"
          v-model.number="targetR2"
          step="0.001"
          max="1"
          style="width:120px; padding:8px; margin-left:10px;"
          :disabled="isRunning"
        />

        <span style="margin-left:10px; color:#aaa;">
          evolution stops once the best program reaches this R² (1 = perfect fit)
        </span>
      </div>
      
      <div style="margin-bottom:10px;">
        <label><b>Operators:</b></label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="+" :disabled="isRunning"> +
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="-" :disabled="isRunning"> -
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="*" :disabled="isRunning"> *
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="/" :disabled="isRunning"> /
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="pow" :disabled="isRunning"> pow
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="sin" :disabled="isRunning"> sin
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="cos" :disabled="isRunning"> cos
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="tan" :disabled="isRunning"> tan
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="sinh" :disabled="isRunning"> sinh
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="cosh" :disabled="isRunning"> cosh
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="tanh" :disabled="isRunning"> tanh
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="asin" :disabled="isRunning"> asin
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="acos" :disabled="isRunning"> acos
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="atan" :disabled="isRunning"> atan
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="asinh" :disabled="isRunning"> asinh
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="acosh" :disabled="isRunning"> acosh
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="atanh" :disabled="isRunning"> atanh
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="log" :disabled="isRunning"> log
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="log2" :disabled="isRunning"> log2
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="log10" :disabled="isRunning"> log10
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="exp" :disabled="isRunning"> exp
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="sqrt" :disabled="isRunning"> sqrt
        </label>
    
        <label style="margin-left:10px;">
          <input type="checkbox" v-model="enabledOperators" value="cbrt" :disabled="isRunning"> cbrt
        </label>
      </div>
    
      <div style="margin-bottom:10px;">
        <label><b>Mutation Rate:</b></label>
    
        <input
          type="number"
          v-model.number="mutationRate"
          step="0.1"
          style="width:120px; padding:8px; margin-left:10px;"
          :disabled="isRunning"
        />
      </div>
    
      <div style="margin-bottom:10px;">
        <label><b>Crossover Rate:</b></label>
    
        <input
          type="number"
          v-model.number="crossoverRate"
          step="0.1"
          style="width:120px; padding:8px; margin-left:10px;"
          :disabled="isRunning"
        />
      </div>

      <div style="margin-bottom:10px;">
        <label><b>Elitism Rate:</b></label>
    
        <input
          type="number"
          v-model.number="elitismRate"
          step="0.01"
          style="width:120px; padding:8px; margin-left:10px;"
          :disabled="isRunning"
        />
      </div>

      <div style="margin-bottom:10px;">
        <label><b>Tournament Size:</b></label>
    
        <input
          type="number"
          v-model.number="tournamentSize"
          style="width:120px; padding:8px; margin-left:10px;"
          :disabled="isRunning"
        />
      </div>

      <div style="margin-bottom:10px;">
        <label><b>Tree Depth:</b></label>
    
        <input
          type="number"
          v-model.number="treeDepth"
          style="width:120px; padding:8px; margin-left:10px;"
          :disabled="isRunning"
        />
      </div>

    </div>
    
  </div>
  `,

  data() {
    return {
      worker: null,
      generation: 0,
      history: [],
      best: {
        left: 'x',
        op: '+',
        right: '1'
      },
      bestFitness: 0,
      bestR2: null,
      db: null,
      expressionText: '',
      targetFormula: 'x*x + 2',
      minX: -5,
      maxX: 5,
      populationSize: 100,
      targetR2: 0.99,
      sampleCount: DEFAULT_SAMPLE_COUNT,
      maxGenerations: 1000,
      enabledOperators: ['+', '-', '*'],
      mutationRate: 0.1,
      crossoverRate: 0.7,
      elitismRate: 0.05,
      tournamentSize: 5,
      treeDepth: 4,
      dataMode: 'formula', // formula | dataset
      uploadedData: [],
      uploadedFileName: '',
      evolutionState: 'idle',
      // idle
      // running
      // paused
      // a checkpoint is written whenever the best fitness improves,
      // and at least every `checkpointInterval` generations regardless
      checkpointInterval: 10,
      lastCheckpointGeneration: 0,
      lastCheckpointFitness: Infinity,
      lastSavedBestFitness: Infinity,
      statusMessage: '',
      errorMessages: []
    };
  },

  computed: {

    expression() {
      return this.expressionText;
    },

    sampleData() {

      // uploaded dataset mode
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

        case 'idle':
          return 'Start Evolution';

        case 'paused':
          return 'Clear Results';

        case 'running':
          return 'Running...';
      }
    },

    secondaryButtonText() {

      switch (this.evolutionState) {

        case 'idle':
          return 'Stop';

        case 'running':
          return 'Stop';

        case 'paused':
          return 'Resume';
      }
    }

  },

  created() {
    // Kept off the reactive data on purpose: it is replaced every
    // generation and is only needed for checkpoints.
    this.latestPopulation = [];
  },

  mounted() {
    this.initDB();
    this.drawCanvas();
    window.addEventListener(
      'beforeunload',
      () => {

        if (
          this.evolutionState === 'running'
        ) {
          this.saveCheckpoint(true);
        }
      }
    );
  },

  methods: {

    initDB() {

      const request = indexedDB.open('gp-db', 2);

      request.onupgradeneeded = (e) => {

        const db = e.target.result;

        if (!db.objectStoreNames.contains('bestPrograms')) {

          db.createObjectStore('bestPrograms', {
            keyPath: 'id',
            autoIncrement: true
          });
        }

        if (!db.objectStoreNames.contains('sessions')) {

          db.createObjectStore('sessions', {
            keyPath: 'id'
          });
        }
      };

      request.onsuccess = async (e) => {

        this.db = e.target.result;

        await this.checkRestorableSession();
      };
    },

    renderTree(
      node,
      x = 600,
      y = 40,
      spread = 300,
      parent = null,
      result = []
    ) {

      if (node == null) {
        return result;
      }

      // =========================
      // TERMINAL NODE
      // =========================

      if (typeof node === 'string') {

        result.push({
          x,
          y,
          label: node,
          // variable vs. ERC constant
          color: node === 'x' ? 'lightgreen' : 'khaki',
          parent
        });

        return result;
      }

      // ERC number node
      if (typeof node === 'number') {

        result.push({
          x,
          y,
          label: node.toFixed(2),
          color: 'khaki',
          parent
        });

        return result;
      }

      // =========================
      // OPERATOR NODE
      // =========================

      result.push({
        x,
        y,
        label: node.op,
        color: 'orange',
        parent
      });

      // unary operator
      if (node.child) {

        this.renderTree(
          node.child,
          x,
          y + 80,
          spread / 1.5, {
            x,
            y
          },
          result
        );

        return result;
      }

      // binary operator
      this.renderTree(
        node.left,
        x - spread,
        y + 80,
        spread / 2, {
          x,
          y
        },
        result
      );

      this.renderTree(
        node.right,
        x + spread,
        y + 80,
        spread / 2, {
          x,
          y
        },
        result
      );

      return result;
    },

    saveBest() {

      if (!this.db) return;

      if (
        this.bestFitness >=
        this.lastSavedBestFitness
      ) {
        return;
      }

      this.lastSavedBestFitness =
        this.bestFitness;

      const tx =
        this.db.transaction(
          ['bestPrograms'],
          'readwrite'
        );

      const store =
        tx.objectStore('bestPrograms');

      store.add({

        timestamp: Date.now(),

        fitness: this.bestFitness,

        tree: this.compressTree(this.best),

        generation: this.generation
      });
    },

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

    startEvolution() {

      const config = this.validatedConfig();

      if (!config) {
        return;
      }

      if (this.worker) {
        this.worker.terminate();
      }

      this.evolutionState = 'running';
      this.statusMessage = '';

      this.generation = 0;
      this.history = [];
      this.latestPopulation = [];
      this.lastCheckpointFitness = Infinity;
      this.lastSavedBestFitness = Infinity;
      this.lastCheckpointGeneration = 0;

      this.worker = new Worker('worker.js');

      this.bindWorker();

      this.worker.postMessage({
        type: 'start',
        config
      });
    },

    stopEvolution() {

      if (!this.worker) {
        return;
      }

      this.worker.postMessage({
        type: 'stop'
      });

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

      this.worker.postMessage({
        type: 'resume',
        config
      });

    },

    drawCanvas() {
      const canvas = this.$refs.canvas;

      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // =========================
      // FIND DATA RANGE
      // =========================

      let points = this.sampleData || [];

      if (!points.length) return;

      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);

      let minY = Math.min(...ys);
      let maxY = Math.max(...ys);

      if (minY === maxY) {
        minY -= 1;
        maxY += 1;
      }

      const padding = 20;

      function toScreenX(x) {
        return padding +
          ((x - minX) / (maxX - minX)) *
          (canvas.width - padding * 2);
      }

      function toScreenY(y) {
        return canvas.height - padding -
          ((y - minY) / (maxY - minY)) *
          (canvas.height - padding * 2);
      }

      // =========================
      // DRAW GP CURVE FIRST
      // =========================

      ctx.beginPath();

      let first = true;

      for (let px = 0; px < canvas.width; px++) {

        const logicalX =
          minX + (px / canvas.width) * (maxX - minX);

        const y =
          evaluateTree(this.best, logicalX);

        if (!Number.isFinite(y)) continue;

        const screenX = toScreenX(logicalX);
        const screenY = toScreenY(y);

        if (first) {
          ctx.moveTo(screenX, screenY);
          first = false;
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.stroke();

      // =========================
      // DOWNSAMPLE DATA
      // =========================

      const maxPoints = 30;

      let sampled = points;

      if (points.length > maxPoints) {

        sampled = [];

        const step =
          points.length / maxPoints;

        for (let i = 0; i < maxPoints; i++) {
          sampled.push(
            points[Math.floor(i * step)]
          );
        }
      }

      // =========================
      // DRAW DATA POINTS LAST
      // =========================

      ctx.fillStyle = 'cyan';

      for (const p of sampled) {

        const sx = toScreenX(p.x);
        const sy = toScreenY(p.y);

        ctx.beginPath();

        ctx.arc(
          sx,
          sy,
          5, // bigger point radius
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    },

    handleFileUpload(event) {

      const file = event.target.files[0];

      if (!file) return;

      this.uploadedFileName = file.name;

      const reader = new FileReader();

      reader.onload = (e) => {

        const text = e.target.result;

        const lines =
          text.split(/\r?\n/);

        const data = [];

        for (let i = 1; i < lines.length; i++) {

          const line = lines[i].trim();

          if (!line) continue;

          const parts = line.split(',');

          if (parts.length < 2) continue;

          const x = Number(parts[0]);
          const y = Number(parts[1]);

          if (
            Number.isFinite(x) &&
            Number.isFinite(y)
          ) {
            data.push({
              x,
              y
            });
          }
        }

        this.uploadedData = data;

        console.log(
          'Dataset loaded:',
          data.length
        );
      };

      reader.readAsText(file);
    },

    mainAction() {

      if (this.evolutionState === 'idle') {
        this.startEvolution();
        return;
      }

      if (this.evolutionState === 'paused') {
        this.clearResults();
      }
    },

    secondaryAction() {

      if (this.evolutionState === 'running') {
        this.stopEvolution();
        return;
      }

      if (this.evolutionState === 'paused') {
        this.resumeEvolution();
      }
    },

    clearResults() {

      const confirmed =
        confirm(
          'Clear all evolution results?'
        );

      if (!confirmed) {
        return;
      }

      // stop worker completely

      if (this.worker) {

        this.worker.terminate();

        this.worker = null;
      }

      // clear memory

      this.best = null;

      this.bestFitness = 0;

      this.expressionText = '';

      this.history = [];

      this.generation = 0;

      this.bestR2 = null;

      this.latestPopulation = [];

      this.lastCheckpointFitness = Infinity;

      this.lastSavedBestFitness = Infinity;

      this.lastCheckpointGeneration = 0;

      this.statusMessage = '';

      this.errorMessages = [];

      // clear graph

      this.drawCanvas();

      // clear indexedDB

      if (this.db) {

        const tx =
          this.db.transaction(
            ['bestPrograms'],
            'readwrite'
          );

        const store =
          tx.objectStore(
            'bestPrograms'
          );

        store.clear();
      }

      this.evolutionState = 'idle';

      if (this.db) {

        const tx = this.db.transaction(
          ['sessions'],
          'readwrite'
        );

        const store = tx.objectStore('sessions');

        store.delete('latest');
      }

    },

    saveCheckpoint(force = false) {

      if (!this.db || !this.worker) {
        return;
      }

      const improved =
        this.bestFitness < this.lastCheckpointFitness;

      const due =
        this.generation - this.lastCheckpointGeneration >=
        this.checkpointInterval;

      if (!force && !improved && !due) {
        return;
      }

      this.lastCheckpointFitness =
        Math.min(this.lastCheckpointFitness, this.bestFitness);

      this.lastCheckpointGeneration = this.generation;

      // strip + compress
      const compactPopulation =
        (this.latestPopulation || [])
        .map(tree =>
          this.compressTree(tree)
        );
      
      const state = {

        id: 'latest',

        timestamp: Date.now(),

        generation: this.generation,

        population: compactPopulation,

        best: this.compressTree(
          this.best
        ),

        bestFitness: this.bestFitness,

        bestR2: this.bestR2,

        history: JSON.parse(
          JSON.stringify(
            this.history
          )
        ),

        expressionText: this.expressionText,

        evolutionState: this.evolutionState,

        config: {

          ...this.buildConfig(),

          uploadedFileName: this.uploadedFileName

        }
      };

      const tx =
        this.db.transaction(
          ['sessions'],
          'readwrite'
        );

      const store =
        tx.objectStore(
          'sessions'
        );

      store.put(state);
    },

    async checkRestorableSession() {

      if (!this.db) {
        return;
      }

      const tx = this.db.transaction(
        ['sessions'],
        'readonly'
      );

      const store = tx.objectStore('sessions');

      const request = store.get('latest');

      request.onsuccess = () => {

        const result = request.result;

        if (!result) {
          return;
        }

        const confirmed = confirm(
          'Restore previous GP evolution session?'
        );

        if (!confirmed) {
          return;
        }

        this.restoreSession(result);
      };
    },

    restoreSession(state) {

      this.generation =
        state.generation || 0;

      this.best =
        this.decompressTree(
          state.best
        );

      this.bestFitness =
        state.bestFitness ?? 0;

      this.bestR2 =
        state.bestR2 ?? null;

      this.statusMessage =
        `Restored session at generation ${this.generation}. Press Resume to continue.`;

      this.history =
        state.history || [];

      this.expressionText =
        state.expressionText || '';

      this.evolutionState =
        'paused';

      // older sessions stored minError instead of targetR2
      const config =
        normalizeConfig(state.config);

      // use ?? so legitimate zero values (e.g. mutation rate 0) survive
      this.targetFormula = config.targetFormula ?? 'x*x + 2';
      this.minX = config.minX ?? -5;
      this.maxX = config.maxX ?? 5;
      this.sampleCount = config.sampleCount ?? DEFAULT_SAMPLE_COUNT;
      this.populationSize = config.populationSize ?? 100;
      this.targetR2 = config.targetR2 ?? 0.99;
      this.maxGenerations = config.maxGenerations ?? 1000;
      this.enabledOperators = config.operators ?? ['+', '-', '*'];
      this.mutationRate = config.mutationRate ?? 0.1;
      this.crossoverRate = config.crossoverRate ?? 0.7;
      this.elitismRate = config.elitismRate ?? 0.05;
      this.tournamentSize = config.tournamentSize ?? 5;
      this.treeDepth = config.treeDepth ?? 4;
      this.dataMode = config.dataMode ?? 'formula';
      this.uploadedData = config.dataset ?? [];

      this.uploadedFileName =
        config.uploadedFileName ||
        'Restored Dataset';

      this.latestPopulation =
        (state.population || [])
        .map(individual =>
          this.decompressTree(individual)
        )
        .filter(Boolean);

      this.lastCheckpointFitness =
        this.bestFitness;

      this.lastCheckpointGeneration =
        this.generation;
      
      this.lastSavedBestFitness =
        this.bestFitness;
      
      this.worker = new Worker('worker.js');

      this.bindWorker();

      this.worker.postMessage({
        type: 'restore',

        state: {
          generation: state.generation,

          population: this.latestPopulation,

          config
        }
      });

      this.drawCanvas();
    },

    bindWorker() {

      this.worker.onmessage = (e) => {

        const msg = e.data;

        if (msg.type === 'update') {

          this.best = msg.best;

          this.bestFitness = msg.fitness;

          this.bestR2 = msg.r2;

          this.expressionText = msg.expression;

          this.generation = msg.generation;

          this.latestPopulation =
            msg.population;

          this.history.unshift({
            generation: msg.generation,
            fitness: this.bestFitness,
            error: msg.rawError,
            r2: msg.r2,
            expression: msg.expression
          });

          if (this.history.length > 3) {
            this.history.pop();
          }

          this.drawCanvas();

          this.saveBest();

          this.saveCheckpoint();
        }

        if (msg.type === 'finished') {

          this.evolutionState = 'paused';

          this.statusMessage =
            msg.reason === 'targetReached' ?
            `Target R² reached at generation ${msg.generation}.` :
            `Stopped at Max Generations (${msg.generation}). Increase Max Generations and press Resume to continue.`;

          this.saveCheckpoint(true);
        }
      };
    },

    compressTree(node) {

      if (node == null) {
        return null;
      }

      // terminal
      if (
        typeof node === 'string' ||
        typeof node === 'number'
      ) {
        return node;
      }

      // unary
      if (node.child) {

        return [
          node.op,
          this.compressTree(node.child)
        ];
      }

      // binary
      return [
        node.op,
        this.compressTree(node.left),
        this.compressTree(node.right)
      ];
    },

    decompressTree(node) {

      if (
        typeof node === 'string' ||
        typeof node === 'number'
      ) {
        return node;
      }

      if (!Array.isArray(node)) {
        return null;
      }

      // unary
      if (node.length === 2) {

        return {
          op: node[0],
          child: this.decompressTree(node[1])
        };
      }

      // binary
      return {
        op: node[0],

        left: this.decompressTree(node[1]),

        right: this.decompressTree(node[2])
      };
    }
  }
};

const About = {

  data() {
    return {
      content: 'Loading README.md ...'
    };
  },

  async mounted() {

    try {

      const response = await fetch(
        'https://raw.githubusercontent.com/bowo-prasetyo/genetic-programming/main/README.md'
      );

      const markdown = await response.text();

      // Optional:
      // convert markdown -> HTML

      this.content = marked.parse(markdown);

    } catch (e) {

      this.content =
        '<p>Failed to load README.md</p>';

      console.error(e);
    }
  },

  template: `
    <div class="container">

      <div v-html="content"></div>

    </div>
  `
};

const routes = [{
    path: '/',
    component: Home
  },
  {
    path: '/about',
    component: About
  }
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes
});

const app = Vue.createApp({});

app.use(router);

app.mount('#app');
