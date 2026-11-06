// Translations for EquVolve's interface: message lookup, ICU-style
// plurals, selects and lists, and the choice of language.
//
// Messages live in locales/<code>.json as flat "key": "message" pairs,
// written in a subset of ICU MessageFormat (see docs/TRANSLATING.md):
//
//   "csv.loaded": "Loaded {file}: {count, plural, one {# row} other {# rows}}"
//
// The page loads this file before shared.js and app.js, and calls
// I18n.load() before mounting the app. In Node (the tests) the English
// messages are loaded at once, so I18n.t works without load(). The
// worker never shows text and does not load this file.

(function (root) {
  // The languages the interface can be shown in. `intl` is the locale
  // used for Intl formatting (plurals, lists, relative times, numbers):
  // EquVolve's English is British English ("a, b and c", no serial
  // comma). `numbers`, if set, is used for numbers instead. `pseudo`
  // marks a generated test language made from English (see
  // pseudoLocalize): en-XA is accented and longer, and writes numbers the
  // German way (0,5 and 1.234) so a number that is not localized stands
  // out; ar-XB reads right to left, to check the mirrored layout.
  const LOCALES = {
    en: { name: 'English', intl: 'en-GB', dir: 'ltr' },
    id: { name: 'Bahasa Indonesia', intl: 'id-ID', dir: 'ltr' },
    ja: { name: '日本語', intl: 'ja-JP', dir: 'ltr' },
    'en-XA': { name: 'Pseudo-English', intl: 'en-GB', numbers: 'de-DE', dir: 'ltr', pseudo: 'en', transform: 'accents' },
    'ar-XB': { name: 'Pseudo-Bidi', intl: 'en-GB', dir: 'rtl', pseudo: 'en', transform: 'bidi' }
  };

  const DEFAULT_LOCALE = 'en';
  const STORAGE_KEY = 'equvolve-language';

  // Languages written right to left, by primary subtag, for <html dir>.
  const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'dv', 'yi']);

  const catalogs = {}; // locale -> { key: message }
  let current = DEFAULT_LOCALE;
  const warned = new Set();

  // Called whenever a message or a number is put into words, so a
  // reactive UI can track which of its parts depend on the language and
  // redraw them when it changes (see observe()).
  let onRead = null;

  function observe(fn) {
    onRead = fn;
  }

  const read = () => {
    if (onRead) onRead();
  };

  // =========================================================
  // PARSING
  // =========================================================

  // A message becomes a list of parts: plain text, { arg }, { pound }
  // (the # of a plural), or { arg, type: 'plural' | 'select', options }.
  // Parsed messages are cached by their text.
  const parsed = new Map();

  function parse(source) {
    if (parsed.has(source)) return parsed.get(source);

    let i = 0;
    const fail = (why) => {
      throw new Error(`${why} at position ${i} in message: ${source}`);
    };

    // ICU quoting: '' is an apostrophe; a quote before { } or # starts
    // literal text up to the next quote; any other ' is just an
    // apostrophe, so "l'opérateur" needs no escaping.
    function quoted() {
      if (source[i + 1] === "'") {
        i += 2;
        return "'";
      }

      if ('{}#'.includes(source[i + 1] || '')) {
        const end = source.indexOf("'", i + 1);
        if (end < 0) fail('Unclosed quote');
        const text = source.slice(i + 1, end);
        i = end + 1;
        return text;
      }

      i++;
      return "'";
    }

    function message(inPlural) {
      const parts = [];
      let text = '';
      const flush = () => {
        if (text) parts.push(text);
        text = '';
      };

      while (i < source.length) {
        const ch = source[i];

        if (ch === '{') {
          flush();
          parts.push(argument());
        } else if (ch === '}') {
          break;
        } else if (ch === '#' && inPlural) {
          flush();
          parts.push({ pound: true });
          i++;
        } else if (ch === "'") {
          text += quoted();
        } else {
          text += ch;
          i++;
        }
      }

      flush();
      return parts;
    }

    function word() {
      const match = /^\s*([^\s,{}]+)\s*/.exec(source.slice(i));
      if (!match) fail('Expected a name');
      i += match[0].length;
      return match[1];
    }

    function argument() {
      i++; // {
      const arg = word();

      if (source[i] === '}') {
        i++;
        return { arg };
      }

      if (source[i] !== ',') fail('Expected , or }');
      i++;

      const type = word();

      if (type !== 'plural' && type !== 'select') {
        fail(`Unsupported argument type "${type}"`);
      }

      if (source[i] !== ',') fail('Expected ,');
      i++;

      const options = {};

      while (true) {
        while (/\s/.test(source[i] || '')) i++;
        if (source[i] === '}') break;

        const selector = word();
        if (source[i] !== '{') fail(`Expected { after "${selector}"`);
        i++;
        options[selector] = message(type === 'plural');
        if (source[i] !== '}') fail('Expected }');
        i++;
      }

      if (!options.other) fail(`A ${type} needs an "other" option`);
      i++; // }
      return { arg, type, options };
    }

    const parts = message(false);
    if (i < source.length) fail('Unexpected }');

    parsed.set(source, parts);
    return parts;
  }

  // =========================================================
  // FORMATTING
  // =========================================================

  const pluralRules = new Map();
  const listFormats = new Map();
  const numberFormats = new Map();

  function intlLocale(locale = current) {
    return (LOCALES[locale] && LOCALES[locale].intl) || locale;
  }

  function pluralCategory(n, locale) {
    const tag = intlLocale(locale);
    if (!pluralRules.has(tag)) pluralRules.set(tag, new Intl.PluralRules(tag));
    return pluralRules.get(tag).select(n);
  }

  function numberLocale(locale = current) {
    return (LOCALES[locale] && LOCALES[locale].numbers) || intlLocale(locale);
  }

  // A number written the way the language writes it: 1,234.5 in English,
  // 1.234,5 in German, ١٬٢٣٤٫٥ in Egyptian Arabic. All its digits are
  // kept unless `options` (Intl.NumberFormat options) say otherwise.
  // Only for numbers shown as values: formulas, exports and anything the
  // user may copy into code keep a decimal point.
  function number(value, options = {}, locale = current) {
    read();
    const tag = numberLocale(locale);
    const key = `${tag}|${JSON.stringify(options)}`;
    if (!numberFormats.has(key)) {
      numberFormats.set(key, new Intl.NumberFormat(tag, { maximumFractionDigits: 20, ...options }));
    }
    return numberFormats.get(key).format(value);
  }

  // Items as a list in the current language: "a, b and c" (conjunction)
  // or "a, b, c" (unit, for lists that are not part of a sentence).
  // Numbers in it are localized.
  function list(items, type = 'conjunction') {
    read();
    const tag = intlLocale();
    const key = `${tag}|${type}`;
    if (!listFormats.has(key)) {
      listFormats.set(key, new Intl.ListFormat(tag, { type, style: type === 'unit' ? 'short' : 'long' }));
    }
    return listFormats.get(key).format(items.map(v => (typeof v === 'number' ? number(v) : String(v))));
  }

  // A value that html() inserts as it is, without escaping: only for
  // markup the code builds itself, such as a list of <code> names.
  class Raw {
    constructor(html) { this.html = String(html); }
    toString() { return this.html; }
  }

  const raw = (html) => new Raw(html);

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // In a right-to-left language each filled-in value is wrapped in
  // Unicode isolates (FSI … PDI), so a file name, a formula or a number
  // keeps its own direction and does not reorder the sentence around it.
  const isolate = (text, locale) => (direction(locale) === 'rtl' ? `\u2068${text}\u2069` : text);

  function render(parts, params, locale, escape, pound) {
    let out = '';

    for (const part of parts) {
      if (typeof part === 'string') {
        out += part;
      } else if (part.pound) {
        out += isolate(escape(number(pound, {}, locale)), locale);
      } else if (!part.type) {
        out += isolate(value(params[part.arg], escape, locale), locale);
      } else if (part.type === 'plural') {
        const n = Number(params[part.arg]);
        const branch = part.options[`=${n}`] || part.options[pluralCategory(n, locale)] || part.options.other;
        out += render(branch, params, locale, escape, n);
      } else {
        const branch = part.options[String(params[part.arg])] || part.options.other;
        out += render(branch, params, locale, escape, pound);
      }
    }

    return out;
  }

  function value(v, escape, locale) {
    if (v == null) return '';
    if (v instanceof Raw) return v.html;
    if (Array.isArray(v)) return escape(list(v));
    if (typeof v === 'number') return escape(number(v, {}, locale));
    return escape(v);
  }

  // A message's text with `params` filled in. Arrays become lists.
  function format(message, params = {}, locale = current, escape = String) {
    return render(parse(message), params, locale, escape);
  }

  function lookup(key) {
    read();
    for (const locale of [current, LOCALES[current] && LOCALES[current].pseudo, DEFAULT_LOCALE]) {
      const catalog = locale && catalogs[locale];
      if (catalog && Object.prototype.hasOwnProperty.call(catalog, key)) return catalog[key];
    }

    if (!warned.has(key)) {
      warned.add(key);
      if (typeof console !== 'undefined') console.warn(`i18n: no message for "${key}"`);
    }

    return null;
  }

  // The message for `key` in the current language, falling back to
  // English, and to the key itself if there is none.
  function t(key, params) {
    const message = lookup(key);
    return message == null ? key : format(message, params);
  }

  // The same for messages with markup (shown with v-html): the message's
  // own tags are kept and every parameter is escaped, so a file name or
  // column header can never inject markup. See raw() for the exception.
  function html(key, params) {
    const message = lookup(key);
    return message == null ? escapeHtml(key) : format(message, params, current, escapeHtml);
  }

  // =========================================================
  // PSEUDO-LOCALIZATION
  // =========================================================

  const ACCENTS = {
    a: 'á', b: 'ƀ', c: 'ç', d: 'ď', e: 'é', f: 'ƒ', g: 'ğ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ľ', m: 'ɱ',
    n: 'ñ', o: 'ó', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
    A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ď', E: 'É', F: 'Ƒ', G: 'Ğ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ľ', M: 'Ṁ',
    N: 'Ñ', O: 'Ó', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž'
  };

  // English made to look translated. With `transform` 'accents' (en-XA):
  // letters accented, about 30% longer and wrapped in ⟦ ⟧, so missed
  // text, clipped text and joined-up sentence fragments stand out. With
  // 'bidi' (ar-XB): each run of words forced right to left with
  // RLO … PDF, as Android's pseudo-bidi locale does, so the text reads
  // backwards in a right-to-left page and any text not from a message
  // reads normally. Placeholders, plural and select syntax, HTML tags and
  // anything inside <code> are left as they are.
  function pseudoLocalize(message, transform = 'accents') {
    return transform === 'bidi' ? pseudoBidi(message) : pseudoAccents(message);
  }

  // Walk the translatable text of a message: `text(ch)` is called for
  // each character of message text and its result kept; syntax, tags and
  // <code> are copied. `flush()` is called before anything copied.
  function mapText(message, text, flush = () => '') {
    let out = '';
    let depth = 0; // odd inside {argument syntax}, even in message text

    for (let i = 0; i < message.length; i++) {
      const ch = message[i];

      if (ch === '{') depth++;
      else if (ch === '}') depth--;

      if (depth % 2 === 0 && ch === '<') {
        const end = message.indexOf('>', i);
        let stop = end < 0 ? message.length - 1 : end;

        if (message.startsWith('<code>', i)) {
          const close = message.indexOf('</code>', i);
          if (close >= 0) stop = close + '</code>'.length - 1;
        }

        out += flush() + message.slice(i, stop + 1);
        i = stop;
        continue;
      }

      out += depth % 2 === 0 && ch !== '{' && ch !== '}' && ch !== '#' ? text(ch) : flush() + ch;
    }

    return out + flush();
  }

  function pseudoBidi(message) {
    let open = false;
    const flush = () => {
      if (!open) return '';
      open = false;
      return '\u202C';
    };

    return mapText(message, (ch) => {
      // letters, accents and superscripts such as the ² of R²
      if (/[\p{L}\p{M}\p{No}]/u.test(ch)) {
        const start = open ? '' : '\u202E';
        open = true;
        return start + ch;
      }
      // spaces inside a run of words stay in it; other characters end it
      return ch === ' ' && open ? ch : flush() + ch;
    }, flush);
  }

  function pseudoAccents(message) {
    let letters = 0;
    const out = mapText(message, (ch) => {
      if (!ACCENTS[ch]) return ch;
      letters++;
      return ACCENTS[ch];
    });

    const padding = '·'.repeat(Math.ceil(letters * 0.3));
    return `⟦${out}${padding ? ` ${padding}` : ''}⟧`;
  }

  // =========================================================
  // CHOOSING AND LOADING A LANGUAGE
  // =========================================================

  function base(code) {
    return String(code).split('-')[0].toLowerCase();
  }

  // The best supported language for a request, such as "pt-BR": an
  // exact match, then the same language without its region ("pt"), then
  // a supported regional variant of it. Generated test languages are
  // only chosen when asked for by name.
  function match(code, { allowPseudo = false } = {}) {
    if (!code) return null;

    const codes = Object.keys(LOCALES).filter(c => allowPseudo || !LOCALES[c].pseudo);
    const exact = codes.find(c => c.toLowerCase() === String(code).toLowerCase());
    if (exact) return exact;

    return codes.find(c => c === base(code)) ||
      codes.find(c => base(c) === base(code) && !LOCALES[c].pseudo) ||
      null;
  }

  // The language to show: ?lang= in the address (for trying a language,
  // or a translator checking their work), then the choice stored in
  // this browser, then the browser's preferred languages, then English.
  function negotiate({ query, stored, languages = [] } = {}) {
    return match(query, { allowPseudo: true }) ||
      match(stored, { allowPseudo: true }) ||
      languages.map(l => match(l)).find(Boolean) ||
      DEFAULT_LOCALE;
  }

  function direction(locale = current) {
    return (LOCALES[locale] && LOCALES[locale].dir) || (RTL.has(base(locale)) ? 'rtl' : 'ltr');
  }

  function setMessages(locale, messages) {
    catalogs[locale] = messages;
  }

  function setLocale(locale) {
    if (!LOCALES[locale]) throw new Error(`Unknown locale "${locale}"`);
    current = locale;
  }

  async function fetchCatalog(locale) {
    const response = await fetch(`locales/${locale}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status} for locales/${locale}.json`);
    return response.json();
  }

  // Load the messages for `locale` (and English, the fallback), make it
  // the current language and set <html lang dir>. If its file cannot be
  // loaded the page stays in English.
  async function load(locale = DEFAULT_LOCALE) {
    const source = (LOCALES[locale] && LOCALES[locale].pseudo) || locale;

    if (!catalogs[DEFAULT_LOCALE]) setMessages(DEFAULT_LOCALE, await fetchCatalog(DEFAULT_LOCALE));

    try {
      if (!catalogs[source]) setMessages(source, await fetchCatalog(source));
      if (source !== locale) setMessages(locale, pseudoCatalog(catalogs[source], LOCALES[locale].transform));
      setLocale(locale);
    } catch (e) {
      console.error(e);
      setLocale(DEFAULT_LOCALE);
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = current;
      document.documentElement.dir = direction();
    }

    return current;
  }

  function pseudoCatalog(messages, transform) {
    const out = {};
    for (const [key, message] of Object.entries(messages)) out[key] = pseudoLocalize(message, transform);
    return out;
  }

  // The languages a visitor can choose, as { code, name } with each
  // name in its own language. Test languages are listed only while one
  // is in use.
  function choices() {
    return Object.keys(LOCALES)
      .filter(code => !LOCALES[code].pseudo || code === current)
      .map(code => ({ code, name: LOCALES[code].name }));
  }

  // Keep a visitor's choice for their next visit.
  function remember(locale) {
    try {
      root.localStorage.setItem(STORAGE_KEY, locale);
    } catch (e) {
      // storage can be blocked; the choice then lasts until the page closes
    }
  }

  // The language this page should start in, from the address, storage
  // and browser settings.
  function preferredLocale() {
    let stored = null;
    try {
      stored = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // storage can be blocked
    }

    const query = root.location ? new URLSearchParams(root.location.search).get('lang') : null;
    const languages = root.navigator ? (root.navigator.languages || [root.navigator.language]) : [];

    return negotiate({ query, stored, languages });
  }

  const I18n = {
    LOCALES,
    DEFAULT_LOCALE,
    STORAGE_KEY,
    t,
    html,
    raw,
    list,
    number,
    numberLocale,
    format,
    parse,
    escapeHtml,
    pseudoLocalize,
    pseudoCatalog,
    negotiate,
    preferredLocale,
    choices,
    remember,
    observe,
    direction,
    intlLocale,
    setMessages,
    setLocale,
    load,
    get locale() { return current; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    setMessages(DEFAULT_LOCALE, require('./locales/en.json'));
    module.exports = I18n;
  } else {
    root.I18n = I18n;
  }
})(typeof self !== 'undefined' ? self : this);
