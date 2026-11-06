// The translation core in i18n.js: message syntax, plurals, lists,
// escaping, pseudo-localization and choosing a language.
const test = require('node:test');
const assert = require('node:assert/strict');
const I18n = require('../i18n.js');

const f = (message, params, locale) => I18n.format(message, params, locale);

test('arguments are filled in, and arrays become lists', () => {
  assert.equal(f('Loaded {file}.', { file: 'a.csv' }), 'Loaded a.csv.');
  assert.equal(f('{a} and {a}', { a: 1 }), '1 and 1');
  assert.equal(f('Missing: {x}.', {}), 'Missing: .');
  assert.equal(f('Uses {ops}.', { ops: ['sin', 'exp', 'log'] }), 'Uses sin, exp and log.');
});

test('plurals follow the language, with # and exact matches', () => {
  const rows = '{n, plural, =0 {no rows} one {# row} other {# rows}}';
  assert.equal(f(rows, { n: 0 }), 'no rows');
  assert.equal(f(rows, { n: 1 }), '1 row');
  assert.equal(f(rows, { n: 2 }), '2 rows');

  // Polish has more forms than English: one, few, many
  const pl = '{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}';
  assert.equal(f(pl, { n: 1 }, 'pl'), '1 plik');
  assert.equal(f(pl, { n: 3 }, 'pl'), '3 pliki');
  assert.equal(f(pl, { n: 5 }, 'pl'), '5 plików');
  assert.equal(f(pl, { n: 22 }, 'pl'), '22 pliki');
});

test('selects and nested arguments', () => {
  const m = '{kind, select, tab {tabs} other {semicolons}}, {n, plural, one {# line of {file}} other {# lines of {file}}}';
  assert.equal(f(m, { kind: 'tab', n: 1, file: 'a.csv' }), 'tabs, 1 line of a.csv');
  assert.equal(f(m, { kind: 'x', n: 2, file: 'b.csv' }), 'semicolons, 2 lines of b.csv');
});

test('apostrophes are plain text unless they quote syntax', () => {
  assert.equal(f("l'opérateur {op}", { op: 'sin' }), "l'opérateur sin");
  assert.equal(f("It''s '{literal}' text"), "It's {literal} text");
  assert.equal(f("{n, plural, other {'#' is # here}}", { n: 3 }), '# is 3 here');
});

test('malformed messages are rejected with the message in the error', () => {
  assert.throws(() => I18n.parse('Unclosed {name'), /Unclosed \{name/);
  assert.throws(() => I18n.parse('{n, plural, one {x}}'), /needs an "other" option/);
  assert.throws(() => I18n.parse('{n, number}'), /Unsupported argument type/);
  assert.throws(() => I18n.parse('stray }'), /Unexpected \}/);
});

test('t() looks up English, and falls back to the key for unknown messages', () => {
  assert.equal(I18n.t('run.start'), 'Start Evolution');
  assert.equal(I18n.t('csv.loaded', { file: 'x.csv', count: 2 }), 'Loaded x.csv: 2 rows');

  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(I18n.t('no.such.key'), 'no.such.key');
  } finally {
    console.warn = warn;
  }
});

test('html() escapes every parameter but keeps the message markup', () => {
  I18n.setMessages('en-XB', { 'demo': 'Uses <code>{name}</code> from {file}' });
  I18n.LOCALES['en-XB'] = { name: 'Test', intl: 'en-GB', dir: 'ltr' };
  I18n.setLocale('en-XB');

  try {
    assert.equal(
      I18n.html('demo', { name: '<b>x</b>', file: '"a" & b' }),
      'Uses <code>&lt;b&gt;x&lt;/b&gt;</code> from &quot;a&quot; &amp; b'
    );
    // raw() is for markup the code builds, such as a list of <code> names
    assert.equal(I18n.html('demo', { name: I18n.raw('<i>y</i>'), file: '' }), 'Uses <code><i>y</i></code> from ');
  } finally {
    I18n.setLocale('en');
    delete I18n.LOCALES['en-XB'];
  }
});

test('lists use the language\'s own words and punctuation', () => {
  assert.equal(I18n.list(['a']), 'a');
  assert.equal(I18n.list(['a', 'b']), 'a and b');
  assert.equal(I18n.list(['a', 'b', 'c']), 'a, b and c', 'British English: no serial comma');
  assert.equal(I18n.list(['a', 'b', 'c'], 'unit'), 'a, b, c');
});

test('the pseudo-locale changes only translatable text', () => {
  const p = I18n.pseudoLocalize('Loaded {file}: {count, plural, one {# row} other {# rows}} with <code>x</code>');

  assert.match(p, /^⟦Ľóáďéď \{file\}: \{count, plural, one \{# ŕóŵ\} other \{# ŕóŵš\}\} ŵíţĥ <code>x<\/code> ·+⟧$/);
  // it still formats like the original
  assert.match(f(p, { file: 'a.csv', count: 2 }), /^⟦Ľóáďéď a\.csv: 2 ŕóŵš ŵíţĥ <code>x<\/code> ·+⟧$/);

  // tags and their attributes are kept
  assert.equal(I18n.pseudoLocalize('<span class="key red">a</span>'), '⟦<span class="key red">á</span> ·⟧');
});

test('the language comes from ?lang=, then storage, then the browser, then English', () => {
  assert.equal(I18n.negotiate({}), 'en');
  assert.equal(I18n.negotiate({ languages: ['de-DE', 'en-US'] }), 'en');
  assert.equal(I18n.negotiate({ languages: ['fr'] }), 'en', 'unsupported languages fall back to English');
  assert.equal(I18n.negotiate({ stored: 'en-XA', languages: ['en'] }), 'en-XA');
  assert.equal(I18n.negotiate({ query: 'EN-xa', stored: 'en' }), 'en-XA', 'case does not matter');
  assert.equal(I18n.negotiate({ query: 'zz', stored: 'en-XA' }), 'en-XA', 'an unknown ?lang= is ignored');

  // the pseudo-locale is never chosen from the browser's languages
  assert.equal(I18n.negotiate({ languages: ['en-XA'] }), 'en');
});

test('right-to-left languages are recognised for <html dir>', () => {
  assert.equal(I18n.direction('en'), 'ltr');
  assert.equal(I18n.direction('ar'), 'rtl');
  assert.equal(I18n.direction('he-IL'), 'rtl');
});

// =========================================================
// NUMBERS AND WRITING DIRECTION (Phase 2)
// =========================================================

// Run `fn` with the interface in a pseudo-locale, then back in English.
function inLocale(locale, fn) {
  const en = require('../locales/en.json');
  I18n.setMessages(locale, I18n.pseudoCatalog(en, I18n.LOCALES[locale].transform));
  I18n.setLocale(locale);
  try {
    return fn();
  } finally {
    I18n.setLocale('en');
  }
}

test('numbers are written the language\'s way, keeping every digit', () => {
  assert.equal(I18n.number(1234.5), '1,234.5');
  assert.equal(I18n.number(0.1 + 0.2), '0.30000000000000004', 'no digits lost by default');
  assert.equal(I18n.number(0.9999996, { minimumFractionDigits: 6, maximumFractionDigits: 6 }), '1.000000');
  assert.equal(I18n.number(1234.5, {}, 'de'), '1.234,5');
  assert.equal(I18n.number(12.5, {}, 'ar-EG'), '١٢٫٥');

  // en-XA writes numbers the German way, so an unlocalized one stands out
  inLocale('en-XA', () => assert.equal(I18n.number(1234.5), '1.234,5'));
});

test('numbers in messages, lists and plurals are localized', () => {
  assert.equal(I18n.t('status.targetReached', { generation: 1234 }), 'Target R² reached at generation 1,234.');
  assert.equal(I18n.t('replay.improvements', { count: 1500 }), '1,500 improvements');
  assert.equal(I18n.list([1000, 2]), '1,000 and 2');

  inLocale('en-XA', () => {
    assert.match(I18n.t('replay.improvements', { count: 1500 }), /^⟦1\.500 /);
    assert.match(I18n.t('csv.skipped.group', { count: 2, lines: [1000, 2000], reason: 'x' }), /1\.000 .+ 2\.000/);
  });
});

test('in a right-to-left language each value keeps its own direction', () => {
  const FSI = '⁨';
  const PDI = '⁩';

  inLocale('ar-XB', () => {
    assert.equal(I18n.direction(), 'rtl');
    const text = I18n.t('csv.loaded', { file: 'data-2026.csv', count: 3 });
    assert.ok(text.includes(`${FSI}data-2026.csv${PDI}`), text);
    assert.ok(text.includes(`${FSI}3${PDI}`), text);
  });

  // left-to-right languages get no invisible characters
  assert.equal(I18n.t('csv.loaded', { file: 'a.csv', count: 3 }), 'Loaded a.csv: 3 rows');
});

test('the pseudo-bidi locale forces words right to left and leaves syntax alone', () => {
  const RLO = '‮';
  const PDF = '‬';
  const p = I18n.pseudoLocalize('Uses <code>x</code> and {n, plural, one {# row} other {# rows}}.', 'bidi');

  assert.equal(p, `${RLO}Uses ${PDF}<code>x</code> ${RLO}and ${PDF}{n, plural, one {# ${RLO}row${PDF}} other {# ${RLO}rows${PDF}}}.`);
  assert.doesNotThrow(() => I18n.parse(p));
  assert.equal(I18n.direction('ar-XB'), 'rtl');
});
