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
