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
  // used for Intl formatting (plurals, lists, relative times): EquVolve's
  // English is British English ("a, b and c", no serial comma). `pseudo`
  // marks a generated test language: English with accents and extra
  // length, to find text that is not translatable yet (see pseudoLocalize).
  const LOCALES = {
    en: { name: 'English', intl: 'en-GB', dir: 'ltr' },
    'en-XA': { name: 'Pseudo-English', intl: 'en-GB', dir: 'ltr', pseudo: 'en' }
  };

  const DEFAULT_LOCALE = 'en';
  const STORAGE_KEY = 'equvolve-language';

  // Languages written right to left, by primary subtag, for <html dir>.
  const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'dv', 'yi']);

  const catalogs = {}; // locale -> { key: message }
  let current = DEFAULT_LOCALE;
  const warned = new Set();

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

  function intlLocale(locale = current) {
    return (LOCALES[locale] && LOCALES[locale].intl) || locale;
  }

  function pluralCategory(n, locale) {
    const tag = intlLocale(locale);
    if (!pluralRules.has(tag)) pluralRules.set(tag, new Intl.PluralRules(tag));
    return pluralRules.get(tag).select(n);
  }

  // Items as a list in the current language: "a, b and c" (conjunction)
  // or "a, b, c" (unit, for lists that are not part of a sentence).
  function list(items, type = 'conjunction') {
    const tag = intlLocale();
    const key = `${tag}|${type}`;
    if (!listFormats.has(key)) {
      listFormats.set(key, new Intl.ListFormat(tag, { type, style: type === 'unit' ? 'short' : 'long' }));
    }
    return listFormats.get(key).format(items.map(String));
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

  function render(parts, params, locale, escape, pound) {
    let out = '';

    for (const part of parts) {
      if (typeof part === 'string') {
        out += part;
      } else if (part.pound) {
        out += escape(pound);
      } else if (!part.type) {
        out += value(params[part.arg], escape);
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

  function value(v, escape) {
    if (v == null) return '';
    if (v instanceof Raw) return v.html;
    if (Array.isArray(v)) return escape(list(v));
    return escape(v);
  }

  // A message's text with `params` filled in. Arrays become lists.
  function format(message, params = {}, locale = current, escape = String) {
    return render(parse(message), params, locale, escape);
  }

  function lookup(key) {
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

  // English made to look translated: letters accented, about 30% longer
  // and wrapped in ⟦ ⟧, so missed text, clipped text and joined-up
  // sentence fragments stand out. Placeholders, plural and select syntax,
  // HTML tags and anything inside <code> are left as they are.
  function pseudoLocalize(message) {
    let out = '';
    let depth = 0; // odd inside {argument syntax}, even in message text
    let letters = 0;

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

        out += message.slice(i, stop + 1);
        i = stop;
        continue;
      }

      if (depth % 2 === 0 && ACCENTS[ch]) {
        out += ACCENTS[ch];
        letters++;
      } else {
        out += ch;
      }
    }

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
      if (source !== locale) setMessages(locale, pseudoCatalog(catalogs[source]));
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

  function pseudoCatalog(messages) {
    const out = {};
    for (const [key, message] of Object.entries(messages)) out[key] = pseudoLocalize(message);
    return out;
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
    format,
    parse,
    escapeHtml,
    pseudoLocalize,
    pseudoCatalog,
    negotiate,
    preferredLocale,
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
