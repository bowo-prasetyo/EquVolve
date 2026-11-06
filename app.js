// Vue UI for EquVolve, the in-browser genetic programming playground.
// Shared helpers come from shared.js, and translations from i18n.js
// (both loaded first in index.html). Every word the page shows comes
// from locales/<language>.json through t() or, for messages with
// markup, th(); templates use $t and $th.

const t = (key, params) => I18n.t(key, params);
const th = (key, params) => I18n.html(key, params);

// Whole sentences run together, as the language writes them (with a
// space in English, none in Chinese or Japanese). Empty ones are left out.
const sentences = (...items) => items.filter(Boolean).join(t('sentence.separator'));

// `nameKey`, `labelKey` and `hintKey` name messages in locales/*.json.
const OPERATOR_GROUPS = [
  { id: 'arithmetic', nameKey: 'operators.group.arithmetic', ops: ['+', '-', '*', '/', 'pow'] },
  { id: 'trigonometric', nameKey: 'operators.group.trigonometric', ops: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'] },
  { id: 'hyperbolic', nameKey: 'operators.group.hyperbolic', ops: ['sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'] },
  { id: 'exponential', nameKey: 'operators.group.exponential', ops: ['exp', 'log', 'log2', 'log10'] },
  { id: 'roots', nameKey: 'operators.group.roots', ops: ['sqrt', 'cbrt'] }
];

const OPERATOR_PRESETS = [
  { id: 'polynomial', nameKey: 'operators.preset.polynomial', ops: ['+', '-', '*'] },
  { id: 'rational', nameKey: 'operators.preset.rational', ops: ['+', '-', '*', '/'] },
  { id: 'trigonometric', nameKey: 'operators.preset.trigonometric', ops: ['+', '-', '*', '/', 'sin', 'cos'] },
  { id: 'expLog', nameKey: 'operators.preset.expLog', ops: ['+', '-', '*', '/', 'exp', 'log'] },
  { id: 'everything', nameKey: 'operators.preset.everything', ops: Object.keys(OP_ARITY) }
];

// The settings most runs need are shown; the rest sit under Advanced.
const SETTING_FIELDS = [
  { key: 'maxGenerations', labelKey: 'setting.maxGenerations.label', hintKey: 'setting.maxGenerations.hint', step: 1 },
  { key: 'targetR2', labelKey: 'setting.targetR2.label', hintKey: 'setting.targetR2.hint', step: 0.001 },
  { key: 'populationSize', labelKey: 'setting.populationSize.label', hintKey: 'setting.populationSize.hint', step: 1, advanced: true },
  { key: 'crossoverRate', labelKey: 'setting.crossoverRate.label', hintKey: 'setting.crossoverRate.hint', step: 0.05, advanced: true },
  { key: 'mutationRate', labelKey: 'setting.mutationRate.label', hintKey: 'setting.mutationRate.hint', step: 0.05, advanced: true },
  { key: 'elitismRate', labelKey: 'setting.elitismRate.label', hintKey: 'setting.elitismRate.hint', step: 0.01, advanced: true },
  { key: 'tournamentSize', labelKey: 'setting.tournamentSize.label', hintKey: 'setting.tournamentSize.hint', step: 1, advanced: true },
  { key: 'treeDepth', labelKey: 'setting.treeDepth.label', hintKey: 'setting.treeDepth.hint', step: 1, advanced: true },
  { key: 'maxTreeDepth', labelKey: 'setting.maxTreeDepth.label', hintKey: 'setting.maxTreeDepth.hint', hintParams: { limit: MAX_TREE_DEPTH_LIMIT }, step: 1, advanced: true }
];

// Settings under Advanced, for counting how many differ from the defaults.
const ADVANCED_KEYS = [
  ...SETTING_FIELDS.filter(f => f.advanced).map(f => f.key),
  'linearScaling',
  'constantOptimization'
];

// The control to focus for each validation field (see
// validateConfigFields in shared.js); other fields are settings.
const FIELD_TARGETS = {
  targetFormula: '#formula',
  xRange: '#min-x',
  sampleCount: '#samples',
  operators: '#operators input',
  dataset: '#csv'
};

// Validation fields in the order they appear on the page, so problems
// are listed, and the first one focused, top to bottom.
const FIELD_ORDER = [
  'targetFormula', 'xRange', 'sampleCount', 'dataset',
  ...SETTING_FIELDS.filter(f => !f.advanced).map(f => f.key),
  'operators',
  ...SETTING_FIELDS.filter(f => f.advanced).map(f => f.key)
];

const fieldRank = (field) => {
  const i = FIELD_ORDER.indexOf(field);
  return i < 0 ? FIELD_ORDER.length : i;
};

// Language names are not translated; the plain formula's label is.
const EXPORT_FORMATS = [
  { key: 'plain', labelKey: 'export.plain' },
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

// "5 minutes ago", "yesterday", ... for a past time in milliseconds, in
// the interface's language.
function timeAgo(timestamp, now = Date.now()) {
  const seconds = Math.round((timestamp - now) / 1000);
  const format = new Intl.RelativeTimeFormat(I18n.intlLocale(), { numeric: 'auto' });

  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }

  return t('time.justNow');
}

// How many rows of an uploaded dataset the preview table shows.
const PREVIEW_ROWS = 5;

const SAMPLE_FILE_NAME = 'sample-boxes.csv';

const OP_LABELS = { '*': '×', '/': '÷', '-': '−' };

const Home = {
  template: `
  <div class="container">

    <header class="page-header">
      <h1 class="brand">
        <img src="assets/logo-mark.svg" alt="" class="brand-mark">
        <span translate="no">Equ<span class="brand-accent">Volve</span></span>
      </h1>
      <p class="tagline">
        {{ $t('header.tagline') }}
      </p>
    </header>

    <!-- A saved run from an earlier visit: offered here rather than in a
         dialog, so the page is usable straight away. -->
    <section v-if="savedRun" class="restore-banner" aria-labelledby="restore-title">
      <p>
        <b id="restore-title">{{ $t('restore.title') }}</b>
        {{ $t('restore.body', { summary: savedRunSummary }) }}
      </p>
      <div class="controls">
        <button class="primary" @click="restoreSavedRun">{{ $t('restore.restore') }}</button>
        <button @click="savedRun = null">{{ $t('restore.notNow') }}</button>
      </div>
      <p class="hint">{{ $t('restore.hint') }}</p>
    </section>

    <!-- ===================== 1. TARGET ===================== -->
    <section class="panel">
      <h2>{{ $t('data.title') }}</h2>

      <div class="field-row">
        <span class="field-label">{{ $t('data.source') }}</span>

        <label class="inline">
          <input type="radio" value="formula" v-model="dataMode" :disabled="isRunning">
          {{ $t('data.source.formula') }}
        </label>

        <label class="inline">
          <input type="radio" value="dataset" v-model="dataMode" :disabled="isRunning">
          {{ $t('data.source.dataset') }}
        </label>
      </div>

      <template v-if="dataMode === 'formula'">
        <div class="field-row">
          <label class="field-label" for="formula">{{ $t('data.formula') }}</label>
          <input
            id="formula"
            class="wide"
            v-model="targetFormula"
            placeholder="x*x + 2"
            :disabled="isRunning"
            v-bind="invalidAttrs('targetFormula')"
          >
          <span v-if="fieldErrors.targetFormula" id="error-targetFormula" class="field-error">{{ fieldErrors.targetFormula }}</span>
        </div>

        <div class="field-row">
          <span class="field-label" id="x-range-label">{{ $t('data.xRange') }}</span>
          <span class="range-inputs">
            <input id="min-x" type="number" v-model.number="minX" :disabled="isRunning" :aria-label="$t('data.xRange.min')" v-bind="invalidAttrs('xRange')">
            <span>{{ $t('data.xRange.to') }}</span>
            <input id="max-x" type="number" v-model.number="maxX" :disabled="isRunning" :aria-label="$t('data.xRange.max')" v-bind="invalidAttrs('xRange')">
          </span>
          <span v-if="fieldErrors.xRange" id="error-xRange" class="field-error">{{ fieldErrors.xRange }}</span>
        </div>

        <div class="field-row">
          <label class="field-label" for="samples">{{ $t('data.samples') }}</label>
          <input id="samples" type="number" min="2" step="1" v-model.number="sampleCount" :disabled="isRunning" v-bind="invalidAttrs('sampleCount')">
          <span v-if="fieldErrors.sampleCount" id="error-sampleCount" class="field-error">{{ fieldErrors.sampleCount }}</span>
          <span class="hint">{{ $t('data.samples.hint') }}</span>
        </div>

        <p class="hint" v-html="$th('data.formula.hint')"></p>
      </template>

      <template v-else>
        <div class="field-row">
          <label class="field-label" for="csv">{{ $t('data.csv') }}</label>
          <input id="csv" type="file" accept=".csv,text/csv" @change="handleFileUpload" :disabled="isRunning" v-bind="invalidAttrs('dataset')">
          <span v-if="fieldErrors.dataset" id="error-dataset" class="field-error">{{ fieldErrors.dataset }}</span>
        </div>

        <div class="field-row sample-row">
          <span class="hint">{{ $t('data.sample.prompt') }}</span>
          <button class="small" @click="useSampleCsv" :disabled="isRunning">{{ $t('data.sample.use') }}</button>
          <button class="small" @click="downloadSampleCsv">{{ $t('data.sample.download') }}</button>
        </div>

        <p class="hint" v-html="$th('data.csv.hint', { max: maxVariables })"></p>

        <div v-if="csvTable && csvTable.headers.length > 2" class="field-row">
          <label class="field-label" for="target-column">{{ $t('data.targetColumn') }}</label>
          <select id="target-column" v-model.number="targetColumn" @change="applyTable" :disabled="isRunning">
            <option v-for="(h, i) in csvTable.headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>

        <div v-if="uploadedFileName" class="loaded-summary">
          <p class="loaded-line">{{ loadedSummary }}</p>

          <p v-if="csvFormatText" class="hint csv-format">{{ csvFormatText }}</p>

          <p v-if="csvSkippedText" class="hint skipped-rows">{{ csvSkippedText }}</p>

          <p v-if="ignoredColumns.length" class="hint ignored-columns">
            {{ $t('csv.ignored', { max: maxVariables, names: $list(ignoredColumns, 'unit') }) }}
          </p>

          <div v-if="previewRows.length" class="preview-wrap">
            <table class="preview">
              <caption>
                {{ previewRows.length < uploadedData.length ?
                  $t('csv.preview.some', { shown: previewRows.length, total: uploadedData.length }) :
                  $t('csv.preview.all', { total: uploadedData.length }) }}
              </caption>
              <thead>
                <tr>
                  <th v-for="c in previewColumns" :key="c.name" scope="col" :class="{ target: c.target }">
                    {{ c.name }}<span v-if="c.target" class="hint">{{ ' ' + $t('csv.preview.target') }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in previewRows" :key="i">
                  <td v-for="(v, j) in row" :key="j" :class="{ target: previewColumns[j].target }">{{ v }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </section>

    <!-- ===================== 2. SETTINGS ===================== -->
    <section class="panel">
      <h2>{{ $t('settings.title') }}</h2>

      <div class="settings-grid">
        <label v-for="f in basicFields" :key="f.key" class="setting">
          <span class="field-label">{{ $t(f.labelKey) }}</span>
          <input
            :id="'setting-' + f.key"
            type="number"
            :step="f.step"
            v-model.number="$data[f.key]"
            :disabled="isRunning"
            v-bind="invalidAttrs(f.key)"
          >
          <span v-if="fieldErrors[f.key]" :id="'error-' + f.key" class="field-error">{{ fieldErrors[f.key] }}</span>
          <span class="hint">{{ $t(f.hintKey, f.hintParams) }}</span>
        </label>

        <label class="setting">
          <span class="field-label">{{ $t('settings.speed') }}</span>
          <select v-model="speed" :disabled="isRunning">
            <option value="fast">{{ $t('settings.speed.fast') }}</option>
            <option value="slow">{{ $t('settings.speed.slow') }}</option>
          </select>
          <span class="hint">{{ $t('settings.speed.hint') }}</span>
        </label>
      </div>

      <h3 id="operators-heading">{{ $t('operators.title') }}</h3>

      <p class="hint">{{ $t('operators.hint') }}</p>

      <div class="preset-row">
        <span class="hint">{{ $t('operators.presets') }}</span>
        <button
          v-for="p in operatorPresets"
          :key="p.id"
          class="small"
          :class="{ active: isPreset(p) }"
          @click="enabledOperators = [...p.ops]"
          :disabled="isRunning"
        >{{ $t(p.nameKey) }}</button>
      </div>

      <div
        id="operators"
        class="operator-groups"
        :class="{ invalid: fieldErrors.operators }"
        role="group"
        aria-labelledby="operators-heading"
        v-bind="invalidAttrs('operators')"
      >
        <fieldset v-for="g in operatorGroups" :key="g.id">
          <legend>{{ $t(g.nameKey) }}</legend>
          <label v-for="op in g.ops" :key="op" class="inline operator" translate="no">
            <input type="checkbox" :value="op" v-model="enabledOperators" :disabled="isRunning">
            {{ op }}
          </label>
        </fieldset>
      </div>
      <p v-if="fieldErrors.operators" id="error-operators" class="field-error">{{ fieldErrors.operators }}</p>

      <details class="advanced" :open="advancedOpen" @toggle="advancedOpen = $event.target.open">
        <summary>
          <h3>{{ $t('advanced.title') }}</h3>
          <span class="hint">
            {{ $t('advanced.summary') }}<template v-if="advancedChanged"> · {{ $t('advanced.changed', { count: advancedChanged }) }}</template>
          </span>
        </summary>

        <p class="hint">{{ $t('advanced.hint') }}</p>

        <div class="settings-grid">
          <label v-for="f in advancedFields" :key="f.key" class="setting">
            <span class="field-label">{{ $t(f.labelKey) }}</span>
            <input
              :id="'setting-' + f.key"
              type="number"
              :step="f.step"
              v-model.number="$data[f.key]"
              :disabled="isRunning"
              v-bind="invalidAttrs(f.key)"
            >
            <span v-if="fieldErrors[f.key]" :id="'error-' + f.key" class="field-error">{{ fieldErrors[f.key] }}</span>
            <span class="hint">{{ $t(f.hintKey, f.hintParams) }}</span>
          </label>

          <label class="setting">
            <span class="field-label">
              <input type="checkbox" v-model="linearScaling" :disabled="isRunning">
              {{ $t('advanced.linearScaling') }}
            </span>
            <span class="hint">{{ $t('advanced.linearScaling.hint') }}</span>
          </label>

          <label class="setting">
            <span class="field-label">
              <input type="checkbox" v-model="constantOptimization" :disabled="isRunning">
              {{ $t('advanced.constantOptimization') }}
            </span>
            <span class="hint">{{ $t('advanced.constantOptimization.hint') }}</span>
          </label>
        </div>
      </details>
    </section>

    <!-- ===================== RUN BAR =====================
         Sticks to the bottom of the window until its place above the
         results scrolls into view, so the run buttons are always at hand. -->
    <div class="run-bar">
      <div v-if="validationErrors.length || errorMessages.length" class="run-message error" role="alert">
        <p v-if="validationErrors.length" class="run-message-title">
          {{ $t('run.fix', { count: validationErrors.length }) }}
        </p>
        <ul>
          <li v-for="(e, i) in validationErrors" :key="'v' + i">
            <a :href="'#' + e.field" @click.prevent="focusField(e.field)">{{ e.message }}</a>
          </li>
          <li v-for="(msg, i) in errorMessages" :key="'m' + i">{{ msg }}</li>
        </ul>
      </div>

      <div v-if="missingOperators.length && !isRunning" class="run-message note">
        <span v-html="$th('run.missingOperators', { ops: codeList(missingOperators), count: missingOperators.length })"></span>
        <button class="small" @click="addOperators(missingOperators)">{{ $t('run.tickOperators', { ops: missingOperators.join(' ') }) }}</button>
      </div>

      <div v-if="formulaUse.unsupported.length && !isRunning" class="run-message note">
        <span v-html="$th('run.unsupported', { names: codeList(formulaUse.unsupported), count: formulaUse.unsupported.length })"></span>
      </div>

      <div v-if="statusMessage" class="run-message status" role="status">
        <span>{{ statusMessage }}</span>
        <button v-if="undo" class="small" @click="undoLast">{{ undo.label }}</button>
      </div>

      <div class="controls">
        <template v-if="isRunning">
          <button class="primary" disabled>{{ $t('run.running') }}</button>
          <button @click="stopEvolution">{{ $t('run.stop') }}</button>
        </template>

        <template v-else-if="isPaused">
          <template v-if="resumeBlocker">
            <button class="primary" @click="newRun">{{ $t('run.newRun') }}</button>
            <button @click="resumeEvolution">{{ $t('run.resume') }}</button>
          </template>
          <template v-else>
            <button class="primary" @click="resumeEvolution">{{ $t('run.resume') }}</button>
            <button @click="newRun">{{ $t('run.newRun') }}</button>
          </template>
        </template>

        <button v-else class="primary" @click="startEvolution">{{ $t('run.start') }}</button>

        <button v-if="best && !isRunning" @click="shareRun">{{ $t('run.share') }}</button>

        <button v-if="isPaused" class="quiet" @click="clearResults">{{ $t('run.clear') }}</button>
      </div>

      <p v-if="resumeHint" class="hint resume-hint">{{ resumeHint }}</p>
    </div>

    <div v-if="shareUrl" class="field-row">
      <input class="wide" readonly :value="shareUrl" @focus="$event.target.select()" :aria-label="$t('run.shareLink')">
    </div>

    <!-- ===================== 3. RESULTS ===================== -->
    <section class="panel">
      <h2>{{ $t('results.title') }}</h2>

      <div class="stat-row">
        <div class="stat"><span>{{ $t('results.generation') }}</span><b>{{ generation }}</b></div>
        <div class="stat">
          <span>{{ $t('results.bestR2') }}</span><b>{{ formatR2(bestR2) }}</b>
          <small v-if="bestR2 != null" class="fit-quality" :class="fitClass(bestR2)">{{ fitQuality(bestR2) }}</small>
        </div>
        <div class="stat"><span>{{ $t('results.size') }}</span><b>{{ bestSize ?? '–' }}</b></div>
        <div class="stat"><span>{{ $t('results.speed') }}</span><b>{{ speedText }}</b></div>
      </div>

      <p class="hint">{{ $t('results.r2.hint') }}</p>

      <template v-if="best">
        <h3>{{ replayEntry ? $t('results.replayTitle', { generation: replayEntry.g }) : $t('results.best') }}</h3>

        <div class="code expression" :class="{ replaying: replayEntry }">y = {{ expression }}</div>

        <div v-if="timeline.length > 1 && !isRunning" class="replay">
          <button class="small" @click="toggleReplay" :aria-label="replayTimer ? $t('replay.pause.label') : $t('replay.play.label')">
            {{ replayTimer ? $t('replay.pause') : $t('replay.play') }}
          </button>

          <input
            type="range"
            min="0"
            :max="timeline.length - 1"
            step="1"
            :value="replayIndex ?? timeline.length - 1"
            @input="seekReplay(Number($event.target.value))"
            :aria-label="$t('replay.position')"
          >

          <span class="hint">
            {{ replayEntry ?
              $t('replay.at', { generation: replayEntry.g, r2: formatR2(replayEntry.r2), quality: fitQuality(replayEntry.r2, true) }) :
              $t('replay.latest') }}
            · {{ $t('replay.improvements', { count: timeline.length }) }}
          </span>

          <button v-if="replayEntry" class="small" @click="stopReplay">{{ $t('replay.back') }}</button>
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
              :translate="f.labelKey ? null : 'no'"
            >{{ f.labelKey ? $t(f.labelKey) : f.label }}</button>

            <button class="small" @click="copyExport">{{ copyLabel }}</button>
          </div>

          <pre class="code export-text">{{ exportText }}</pre>
        </div>
      </template>

      <div class="charts">
        <figure>
          <figcaption v-if="isMultiVariable" v-html="$th('chart.fit.multi')"></figcaption>
          <figcaption v-else v-html="$th('chart.fit.single')"></figcaption>
          <canvas ref="canvas" width="600" height="300"></canvas>
        </figure>

        <figure>
          <figcaption>
            <span v-html="$th('chart.progress')"></span>
            <span v-if="replayEntry" class="key blue">{{ $t('chart.progress.replay') }}</span>
          </figcaption>
          <canvas ref="progress" width="600" height="300"></canvas>
        </figure>
      </div>

      <template v-if="best">
        <h3>{{ $t('tree.title') }}</h3>

        <svg
          class="tree"
          :viewBox="treeLayout.viewBox"
          :style="{ maxWidth: treeLayout.width + 'px' }"
          role="img"
          :aria-label="$t('tree.label', { expression })"
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

          <g v-for="(n, i) in treeLayout.nodes" :key="'n' + i" :class="'node ' + n.kind">
            <title>{{ n.title }}</title>
            <rect
              :x="n.x - n.width / 2"
              :y="n.y - treeLayout.nodeHeight / 2"
              :width="n.width"
              :height="treeLayout.nodeHeight"
              :rx="treeLayout.nodeHeight / 2"
              :fill="n.color"
            />
            <text :x="n.x" :y="n.y + 4" text-anchor="middle" font-size="12">{{ n.label }}</text>
          </g>
        </svg>

        <p class="hint">{{ $t('tree.hint') }}</p>
      </template>

      <template v-if="history.length">
        <h3>{{ $t('history.title') }}</h3>

        <div v-for="item in history" :key="item.generation" class="history">
          <span class="history-meta">{{ $t('history.item', { generation: item.generation, r2: formatR2(item.r2) }) }}</span>
          <code>{{ item.expression }}</code>
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
      csvSkipped: [], // rows parseCsv left out, as { line, reason }
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
      errorMessages: [], // problems not tied to a setting (CSV, share link)
      showValidation: false, // after a failed Start/Resume, re-check as the user edits
      advancedOpen: false,
      undo: null, // { label, state }: the run that Clear Results or New run replaced
      savedRun: null, // the checkpoint from an earlier visit, offered for restoring
      exportFormat: 'plain',
      copyLabel: t('export.copy'),
      shareUrl: '',

      // a checkpoint is written whenever the best fitness improves,
      // and at least every `checkpointInterval` generations regardless
      checkpointInterval: 10,
      lastCheckpointGeneration: 0,
      lastCheckpointFitness: Infinity,
      lastSavedBestFitness: Infinity,

      basicFields: SETTING_FIELDS.filter(f => !f.advanced),
      advancedFields: SETTING_FIELDS.filter(f => f.advanced),
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
      const value = this.gensPerSecond >= 10 ? Math.round(this.gensPerSecond) : this.gensPerSecond.toFixed(1);
      return t('results.speedValue', { value });
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

    csvSkippedText() {
      return describeSkippedRows(this.csvSkipped);
    },

    // Said only when the file is not plain comma-separated, so a file
    // saved by a spreadsheet in another language is visibly read right.
    csvFormatText() {
      return describeCsvFormat(this.csvTable);
    },

    // "Loaded boxes.csv: 24 rows · inputs: height, width · target: price"
    loadedSummary() {
      const parts = [t('csv.loaded', { file: this.uploadedFileName, count: this.uploadedData.length })];

      if (this.isMultiVariable) {
        parts.push(t('csv.loaded.inputs', { names: I18n.list(this.variables, 'unit') }));
        if (this.targetName) parts.push(t('csv.loaded.target', { name: this.targetName }));
      }

      return parts.join(' · ');
    },

    // Columns past the input limit, which datasetFromTable leaves out.
    ignoredColumns() {
      if (!this.csvTable) return [];

      return this.csvTable.headers
        .filter((_, i) => i !== this.targetColumn)
        .slice(MAX_VARIABLES);
    },

    // The training data's columns: the inputs, then the target.
    previewColumns() {
      return [
        ...this.activeVariables.map(name => ({ name, target: false })),
        { name: this.targetName || 'y', target: true }
      ];
    },

    previewRows() {
      return this.uploadedData.slice(0, PREVIEW_ROWS).map(p => [
        ...this.activeVariables.map(name => (p.v ? p.v[name] : p.x)),
        p.y
      ]);
    },

    // The saved run in a few words: what it fits, how far it got, when.
    savedRunSummary() {
      const run = this.savedRun;

      if (!run) return '';

      const config = run.config || {};
      const what = config.dataMode === 'dataset' ?
        (config.uploadedFileName || t('restore.summary.dataset')) :
        `y = ${config.targetFormula}`;
      const parts = [what, t('restore.summary.generation', { generation: run.generation || 0 })];

      if (Number.isFinite(run.bestR2)) {
        parts.push(t('restore.summary.fit', { r2: this.formatR2(run.bestR2), quality: fitQuality(run.bestR2, true) }));
      }

      if (run.timestamp) parts.push(t('restore.summary.saved', { when: timeAgo(run.timestamp) }));

      return parts.join(' · ');
    },

    // How many Advanced settings differ from the defaults, so changes
    // hidden in the collapsed section are not forgotten.
    advancedChanged() {
      return ADVANCED_KEYS.filter(key => this[key] !== DEFAULTS[key]).length;
    },

    // Every problem with the settings, as { field, message }. Shown once
    // Start or Resume has found a problem, then kept up to date as the
    // settings are edited, so each message goes away when it is fixed.
    validationErrors() {
      if (!this.showValidation) return [];

      return validateConfigFields(this.buildConfig(false))
        .sort((a, b) => fieldRank(a.field) - fieldRank(b.field));
    },

    // The first problem for each field.
    fieldErrors() {
      const errors = {};
      for (const e of this.validationErrors) errors[e.field] ??= e.message;
      return errors;
    },

    // The operators the target formula uses (formula mode only).
    formulaUse() {
      return this.dataMode === 'formula' ?
        formulaOperators(this.targetFormula) :
        { ops: [], unsupported: [] };
    },

    // Operators the formula uses that are not ticked: without them a run
    // can only approximate the formula.
    missingOperators() {
      return this.formulaUse.ops.filter(op => !this.enabledOperators.includes(op));
    },

    // Why Resume would stop again at once, or null if it can go on.
    resumeBlocker() {
      if (!this.isPaused || !this.best) return null;

      if (Number.isFinite(this.bestR2) && this.bestR2 >= 1) {
        return 'perfect';
      }

      if (Number.isFinite(this.bestR2) && Number.isFinite(this.targetR2) && this.bestR2 >= this.targetR2) {
        return 'targetR2';
      }

      if (Number.isInteger(this.maxGenerations) && this.generation >= this.maxGenerations) {
        return 'maxGenerations';
      }

      return null;
    },

    resumeHint() {
      switch (this.resumeBlocker) {
        case 'perfect':
          return t('resume.perfect');
        case 'targetR2':
          return t('resume.targetR2', { target: this.targetR2 });
        case 'maxGenerations':
          return t('resume.maxGenerations', { max: this.maxGenerations });
        default:
          return '';
      }
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

    // The settings the current run was started or last resumed with,
    // which may differ from the form once it is paused and edited.
    this.runConfig = null;
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

    // and at their new size when the window (or zoom) changes their width;
    // redrawn on the next frame, as resizing a canvas inside the
    // observer's callback would trigger it again in the same frame
    this.chartWidths = new Map();
    this.resizeObserver = new ResizeObserver((entries) => {
      const changed = entries.some((e) => {
        const width = Math.round(e.contentRect.width);
        const before = this.chartWidths.get(e.target);
        this.chartWidths.set(e.target, width);
        return before !== undefined && before !== width;
      });

      if (changed) requestAnimationFrame(this.redrawCharts);
    });
    this.resizeObserver.observe(this.$refs.canvas);
    this.resizeObserver.observe(this.$refs.progress);

    window.addEventListener('beforeunload', () => {
      if (this.evolutionState === 'running') {
        this.saveCheckpoint(true);
      }
    });
  },

  beforeUnmount() {
    this.pauseReplay();
    window.removeEventListener(THEME_CHANGE_EVENT, this.redrawCharts);
    this.resizeObserver?.disconnect();

    if (this.worker) {
      this.worker.terminate();
    }
  },

  methods: {

    fitQuality(r2, inline = false) {
      return fitQuality(r2, inline);
    },

    // Names as a list of <code> items, for th() messages such as
    // "Your formula uses {ops}": "<code>sin</code> and <code>exp</code>".
    codeList(names) {
      const marker = (i) => `\u0000${i}\u0000`;
      const escaped = I18n.escapeHtml(I18n.list(names.map((_, i) => marker(i))));
      return I18n.raw(escaped.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${I18n.escapeHtml(names[i])}</code>`));
    },

    // A colour class for a fit quality: good, fair or poor.
    fitClass(r2) {
      if (!Number.isFinite(r2)) return '';
      return r2 >= 0.99 ? 'good' : r2 >= 0.9 ? 'fair' : 'poor';
    },

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

      this.db
        .transaction(['sessions'], 'readwrite')
        .objectStore('sessions')
        .put(this.checkpointState());
    },

    // The current run as a stored checkpoint (see restoreSession).
    checkpointState() {
      return {
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
          ...(this.runConfig || this.buildConfig()),
          uploadedFileName: this.uploadedFileName
        }
      };
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

        // only while nothing else has been started or loaded meanwhile
        if (result && this.isIdle && !this.best) {
          this.savedRun = Vue.markRaw(result);
        }
      };
    },

    restoreSavedRun() {
      const state = this.savedRun;

      this.savedRun = null;
      this.restoreSession(state);
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
      this.uploadedFileName = config.uploadedFileName || t('csv.restoredDataset');
      // the restored rows replace any file loaded in this visit
      this.csvTable = null;
      this.csvSkipped = [];

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
      this.statusMessage = t('status.restored', { generation: this.generation });

      this.latestPopulation = (state.population || [])
        .map(decompressTree)
        .filter(Boolean);

      this.runConfig = config;
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

    // copyData: false skips the deep copy of the dataset, for checks
    // that only read it.
    buildConfig(copyData = true) {
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
        dataset: copyData ? JSON.parse(JSON.stringify(this.uploadedData)) : this.uploadedData
      };
    },

    // Returns the config if valid. Otherwise shows every problem, next to
    // its field and in the run bar, moves focus to the first one, and
    // returns null.
    validatedConfig() {
      const config = this.buildConfig();
      const errors = validateConfigFields(config);

      this.errorMessages = [];
      this.showValidation = errors.length > 0;

      if (errors.length) {
        // show problems in the collapsed Advanced settings too
        if (errors.some(e => this.isAdvanced(e.field))) {
          this.advancedOpen = true;
        }

        this.focusField(this.validationErrors[0].field);
        return null;
      }

      return config;
    },

    // aria attributes for a control whose field has a problem.
    invalidAttrs(field) {
      return this.fieldErrors[field] ?
        { 'aria-invalid': 'true', 'aria-describedby': 'error-' + field } :
        { 'aria-invalid': null, 'aria-describedby': null };
    },

    fieldElement(field) {
      return this.$el.querySelector(FIELD_TARGETS[field] || '#setting-' + field);
    },

    isAdvanced(field) {
      return this.advancedFields.some(f => f.key === field);
    },

    // Bring a field into view and focus it, opening Advanced settings
    // if it is in there.
    async focusField(field) {
      if (!field) return;

      if (this.isAdvanced(field)) {
        this.advancedOpen = true;
      }

      await this.$nextTick();

      const el = this.fieldElement(field);

      if (el) {
        el.focus({ preventScroll: true });
        this.scrollAboveRunBar(el.closest('.setting, .field-row, .operator-groups') || el);
      }
    },

    // Scroll so `el` (a field with its message) is centred in the part of
    // the window the sticky run bar does not cover.
    scrollAboveRunBar(el) {
      const bar = this.$el.querySelector('.run-bar');
      const visibleBottom = bar ? Math.min(window.innerHeight, bar.getBoundingClientRect().top) : window.innerHeight;
      const rect = el.getBoundingClientRect();
      const offset = rect.height > visibleBottom ? rect.top - 8 : rect.top + rect.height / 2 - visibleBottom / 2;

      window.scrollBy(0, offset);
    },

    addOperators(ops) {
      this.enabledOperators = [...this.enabledOperators, ...ops.filter(op => !this.enabledOperators.includes(op))];
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

      this.undo = null;
      this.savedRun = null; // the new run replaces it
      this.launch(config);
    },

    // Start a fresh run of `config`, replacing any results on screen.
    launch(config) {
      if (this.worker) {
        this.worker.terminate();
      }

      this.resetResults();
      this.evolutionState = 'running';
      this.statusMessage = '';
      this.runConfig = config;

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
      this.statusMessage = t('status.paused');

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

      // Resuming now would stop again at once: point at the setting to raise.
      if (this.resumeBlocker) {
        this.statusMessage = this.resumeHint;
        if (this.resumeBlocker !== 'perfect') this.focusField(this.resumeBlocker);
        return;
      }

      this.undo = null;
      this.runConfig = config;
      this.stopReplay();
      this.evolutionState = 'running';
      this.statusMessage = '';
      this.shareUrl = '';
      this.speedMark = null;

      this.worker.postMessage({ type: 'resume', config });
    },

    // From a paused run: start again from scratch with the current
    // settings. The replaced run can be brought back with Undo.
    newRun() {
      const config = this.validatedConfig();

      if (!config) {
        return;
      }

      const previous = this.best ? this.checkpointState() : null;

      this.launch(config);
      this.offerUndo(previous, t('status.newRun'), t('status.undoNewRun'));
    },

    // Clear the results and the saved run straight away; Undo brings
    // them back.
    clearResults() {
      const previous = this.best ? this.checkpointState() : null;

      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      this.resetResults();
      this.runConfig = null;
      this.statusMessage = '';
      this.errorMessages = [];
      this.showValidation = false;
      this.evolutionState = 'idle';

      this.drawCanvas();
      this.drawProgress();

      if (this.db) {
        const tx = this.db.transaction(['bestPrograms', 'sessions'], 'readwrite');
        tx.objectStore('bestPrograms').clear();
        tx.objectStore('sessions').delete('latest');
      }

      this.offerUndo(previous, t('status.cleared'), t('status.undo'));
    },

    offerUndo(state, message, label) {
      // markRaw: kept as plain data, so it can be posted to the worker
      this.undo = state ? { state: Vue.markRaw(state), label } : null;
      this.statusMessage = message;
    },

    // Bring back the run that Clear Results or New run replaced, paused,
    // and save it again as the run to restore.
    undoLast() {
      const { state } = this.undo;

      this.undo = null;

      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      this.resetResults();
      this.errorMessages = [];
      this.showValidation = false;
      this.restoreSession(state);
      this.statusMessage = t('status.broughtBack', { generation: this.generation });
      this.saveCheckpoint(true);
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
            t('status.targetReached', { generation: msg.generation }) :
            t('status.maxGenerations', { generation: msg.generation });
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

      this.copyLabel = ok ? t('export.copied') : t('export.copyFailed');

      setTimeout(() => { this.copyLabel = t('export.copy'); }, 2000);
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

      this.statusMessage = sentences(
        copied ? t('share.copied') : t('share.created'),
        payload.datasetOmitted ?
          t('share.datasetOmitted', { max: MAX_SHARED_POINTS }) :
          t('share.contents')
      );
    },

    async loadSharedRun(code) {
      try {
        const shared = await decodeShare(code);
        const config = normalizeConfig({ ...this.buildConfig(), ...shared.config });

        this.applySettings(config);

        if (shared.config.dataset) {
          this.uploadedData = shared.config.dataset;
          this.uploadedFileName = shared.fileName || t('csv.sharedDataset');
          this.csvTable = null;
          this.csvSkipped = [];
        }

        this.resetResults();

        if (shared.model) {
          this.best = shared.model;
          this.bestR2 = shared.r2 ?? null;
          this.bestSize = treeSize(shared.model);
          this.generation = shared.generation ?? 0;
        }

        this.statusMessage = sentences(
          shared.model ?
            t('share.loadedRun', { r2: this.formatR2(this.bestR2), generation: this.generation }) :
            t('share.loadedSettings'),
          shared.datasetOmitted ?
            t('share.datasetMissing') :
            t('share.pressStart')
        );

        this.drawCanvas();
      } catch (e) {
        console.error(e);
        this.errorMessages = [t('share.unreadable')];
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

      reader.onload = (e) => this.loadCsvText(e.target.result, file.name);
      reader.readAsText(file);
    },

    loadCsvText(text, fileName) {
      const table = parseCsv(text);

      if (table.headers.length < 2 || !table.rows.length) {
        const skipped = describeSkippedRows(table.skipped);
        this.errorMessages = [sentences(t('csv.error.columns'), skipped)];
        return;
      }

      this.errorMessages = [];
      this.uploadedFileName = fileName;
      this.csvTable = table;
      this.csvSkipped = table.skipped || [];
      this.targetColumn = table.headers.length - 1;
      this.applyTable();
    },

    useSampleCsv() {
      this.loadCsvText(sampleCsv(), SAMPLE_FILE_NAME);
    },

    // Save the sample as a file, to see the format or use as a template.
    downloadSampleCsv() {
      const url = URL.createObjectURL(new Blob([sampleCsv()], { type: 'text/csv' }));
      const link = document.createElement('a');

      link.href = url;
      link.download = SAMPLE_FILE_NAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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

    // Size a chart's canvas to the space the page gives it, at the
    // screen's pixel density, and return a context that draws in CSS
    // pixels: { ctx, W, H }.
    prepareCanvas(canvas) {
      const { width, height } = chartSize(canvas.clientWidth || 600);
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.round(width * dpr);
      const bh = Math.round(height * dpr);

      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }

      // the border is part of the CSS height (box-sizing: border-box)
      const border = canvas.offsetHeight - canvas.clientHeight;
      const cssHeight = `${height + (border > 0 ? border : 0)}px`;
      if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.font = CHART_FONT;
      ctx.lineWidth = 1;

      return { ctx, W: width, H: height };
    },

    // Grid lines, tick labels and the frame of a plot area.
    drawAxes(ctx, colors, { plot, xTicks, yTicks, toX, toY, xTitle, yTitle, H }) {
      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.text;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const v of xTicks) {
        const x = Math.round(toX(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, plot.top);
        ctx.lineTo(x, plot.bottom);
        ctx.stroke();
        ctx.fillText(formatTick(v), x, plot.bottom + 5);
      }

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const v of yTicks) {
        const y = Math.round(toY(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
        ctx.fillText(formatTick(v), plot.left - 6, y);
      }

      ctx.strokeStyle = colors.frame;
      ctx.strokeRect(plot.left + 0.5, plot.top + 0.5, plot.right - plot.left - 1, plot.bottom - plot.top - 1);

      // axis titles
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(xTitle, (plot.left + plot.right) / 2, H - 6);
      ctx.translate(14, (plot.top + plot.bottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'middle';
      ctx.fillText(yTitle, 0, 0);
      ctx.restore();
    },

    drawCanvas() {
      const canvas = this.$refs.canvas;

      if (!canvas) return;

      const { ctx, W, H } = this.prepareCanvas(canvas);
      const points = this.sampleData || [];

      if (!points.length) return;

      const colors = this.chartColors();

      if (this.isMultiVariable) {
        this.drawPredictedVsActual(ctx, W, H, points, colors);
        return;
      }

      const g = fitGeometry(
        valueRange(points.map(p => p.x)),
        valueRange(points.map(p => p.y)),
        W,
        H
      );
      const { plot, toX, toY } = g;

      this.drawAxes(ctx, colors, {
        ...g,
        H,
        xTitle: this.activeVariables[0],
        yTitle: this.targetName || 'y'
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
      ctx.clip();

      // best program (or replay position), across the whole plot width
      const model = this.displayModel;

      if (model) {
        ctx.beginPath();

        let penDown = false;

        for (let px = plot.left; px <= plot.right; px++) {
          const x = g.xRange.min + ((px - plot.left) / (plot.right - plot.left)) * (g.xRange.max - g.xRange.min);
          const y = evaluateTree(model, x);

          if (!Number.isFinite(y)) {
            penDown = false;
            continue;
          }

          if (penDown) {
            ctx.lineTo(px, toY(y));
          } else {
            ctx.moveTo(px, toY(y));
            penDown = true;
          }
        }

        ctx.strokeStyle = colors.model;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // data points (downsampled for drawing only)
      ctx.fillStyle = colors.data;

      for (const i of sampleIndices(points.length, FIT_MAX_POINTS)) {
        const p = points[i];

        ctx.beginPath();
        ctx.arc(toX(p.x), toY(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },

    // With several inputs there is no single x axis: plot each row's
    // prediction against its actual value instead.
    drawPredictedVsActual(ctx, W, H, points, colors) {
      const model = this.displayModel;
      const pairs = sampleIndices(points.length, PREDICTED_MAX_POINTS).map((i) => {
        const p = points[i];
        return [p.y, model ? evaluateTree(model, p.v) : NaN];
      });

      const g = predictedGeometry(valueRange(points.map(p => p.y)), W, H);
      const { plot, toX, toY, range } = g;
      const name = this.targetName;
      const hasName = name ? 'yes' : 'no';

      this.drawAxes(ctx, colors, {
        plot,
        toX,
        toY,
        H,
        xTicks: g.ticks,
        yTicks: g.ticks,
        xTitle: t('chart.axis.actual', { hasName, name }),
        yTitle: t('chart.axis.predicted', { hasName, name })
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
      ctx.clip();

      // perfect-prediction diagonal
      ctx.strokeStyle = colors.model;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(range.min), toY(range.min));
      ctx.lineTo(toX(range.max), toY(range.max));
      ctx.stroke();

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

      const { ctx, W, H } = this.prepareCanvas(canvas);
      const colors = this.chartColors();

      const lastG = this.series.length ? this.series[this.series.length - 1].g : 1;
      const { plot, maxG, toX, toY } = progressGeometry(lastG, W, H);

      // y grid: R² = 0, 0.9, 0.99, ...
      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'right';

      for (const { r2, label } of progressGrid()) {
        const y = toY(r2);

        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();

        ctx.fillText(label, plot.left - 6, y + 4);
      }

      ctx.textAlign = 'center';
      ctx.fillText('generation', (plot.left + plot.right) / 2, H - 8);
      ctx.textAlign = 'left';
      ctx.fillText('1', plot.left, H - 8);
      ctx.textAlign = 'right';
      ctx.fillText(String(maxG), plot.right, H - 8);

      // target line
      if (Number.isFinite(this.targetR2) && this.targetR2 < 1) {
        const y = toY(this.targetR2);

        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = colors.target;
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
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
        ctx.moveTo(x, plot.top);
        ctx.lineTo(x, plot.bottom);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  }
};

// Tidy tree layout: leaves are placed left to right, each as wide as
// its label needs, each parent sits above the middle of its children,
// and the SVG viewBox is sized to fit, so any tree scales to the
// available width. Nodes are pills that grow with their label, so long
// numbers and column names are never cut off.
const TREE_NODE_HEIGHT = 30;
const TREE_CHAR_WIDTH = 7.2; // about one character at 12px
const TREE_MIN_NODE_WIDTH = 36;
const TREE_GAP = 12;

function treeNodeWidth(label) {
  return Math.max(TREE_MIN_NODE_WIDTH, Math.ceil(label.length * TREE_CHAR_WIDTH + 16));
}

function layoutTree(root) {
  const nodes = [];
  const level = 64;
  const pad = 12;
  let cursor = pad;
  let maxDepth = 0;

  const place = (node, depth, parent) => {
    maxDepth = Math.max(maxDepth, depth);

    const item = { x: 0, y: pad + TREE_NODE_HEIGHT / 2 + depth * level, parent, label: '', title: '', color: '', kind: '', width: 0 };
    nodes.push(item);

    if (typeof node === 'string' || typeof node === 'number') {
      const variable = isVariable(node);

      item.kind = variable ? 'variable' : 'number';
      item.label = variable ? String(node) : formatShortNumber(node);
      item.title = variable ? t('tree.input', { name: node }) : formatNumber(node, 12);
      item.color = variable ? 'lightgreen' : 'khaki';
      item.width = treeNodeWidth(item.label);
      item.x = cursor + item.width / 2;
      cursor += item.width + TREE_GAP;
      return item;
    }

    item.kind = 'operator';
    item.label = OP_LABELS[node.op] || node.op;
    item.title = node.op;
    item.color = 'orange';
    item.width = treeNodeWidth(item.label);

    const kids = node.child !== undefined ?
      [place(node.child, depth + 1, item)] :
      [place(node.left, depth + 1, item), place(node.right, depth + 1, item)];

    item.x = (kids[0].x + kids[kids.length - 1].x) / 2;

    return item;
  };

  if (root != null) {
    place(root, 0, null);
  }

  // a wide operator over a narrow child may reach past the leaves
  const left = Math.min(pad, ...nodes.map(n => n.x - n.width / 2));
  const right = Math.max(cursor - TREE_GAP, ...nodes.map(n => n.x + n.width / 2));
  const shift = pad - left;

  for (const n of nodes) n.x += shift;

  const width = Math.max(1, right - left) + pad * 2;
  const height = maxDepth * level + TREE_NODE_HEIGHT + pad * 2;

  return {
    nodes,
    width,
    nodeHeight: TREE_NODE_HEIGHT,
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
      content: I18n.escapeHtml(t('about.loading'))
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
      this.content = `<p>${I18n.escapeHtml(t('about.failed'))}</p>`;
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
const THEME_LABELS = { auto: 'theme.auto.label', light: 'theme.light.label', dark: 'theme.dark.label' };
const THEME_TITLES = {
  auto: 'theme.auto.title',
  light: 'theme.light.title',
  dark: 'theme.dark.title'
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
      return t(THEME_LABELS[this.themePreference]);
    },
    themeTitle() {
      return t(THEME_TITLES[this.themePreference]);
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

// $t, $th and $list in templates: see t, th and I18n.list.
app.config.globalProperties.$t = t;
app.config.globalProperties.$th = th;
app.config.globalProperties.$list = (items, type) => I18n.list(items, type);

// The page's language is chosen once, before the app is shown, from
// ?lang=, the stored choice and the browser's languages (see i18n.js).
I18n.load(I18n.preferredLocale()).then(() => app.mount('#app'));
