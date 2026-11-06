// Checks on the message catalogues in locales/: every message the code
// uses exists, none is left unused, every message is valid, and every
// translation keeps the English placeholders and markup. A new
// locales/<code>.json is checked by these tests as soon as it is added.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const I18n = require('../i18n.js');

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'locales');
const SOURCES = ['app.js', 'shared.js', 'index.html'];

const en = require('../locales/en.json');

const catalogues = fs.readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => ({ locale: path.basename(f, '.json'), messages: JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, f), 'utf8')) }));

// The top-level groups of keys ("csv", "run", ...), to tell keys apart
// from other dotted strings in the code, such as "README.md".
const groups = new Set(Object.keys(en).map(k => k.split('.')[0]));

// Every quoted string in the code that looks like a message key.
function keysInSources() {
  const keys = new Set();

  for (const file of SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');

    // keys are always written in single quotes; "..." in templates are
    // attribute values such as v-if="history.length"
    for (const [, key] of source.matchAll(/'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)'/g)) {
      if (groups.has(key.split('.')[0])) keys.add(key);
    }
  }

  return keys;
}

// The argument names a message uses, and the HTML tags it contains.
function argumentNames(parts, names = new Set()) {
  for (const part of parts) {
    if (typeof part === 'string' || part.pound) continue;
    names.add(part.arg);
    for (const option of Object.values(part.options || {})) argumentNames(option, names);
  }
  return names;
}

const tags = (message) => (message.match(/<[^>]+>/g) || []).sort();

test('every message key in the code exists in English', () => {
  const missing = [...keysInSources()].filter(k => !(k in en));
  assert.deepEqual(missing, []);
});

test('every English message is used by the code', () => {
  const used = keysInSources();
  const unused = Object.keys(en).filter(k => !used.has(k));
  assert.deepEqual(unused, []);
});

test('every message in every language is valid', () => {
  for (const { locale, messages } of catalogues) {
    for (const [key, message] of Object.entries(messages)) {
      assert.equal(typeof message, 'string', `${locale} ${key}`);
      assert.doesNotThrow(() => I18n.parse(message), `${locale} ${key}`);
    }
  }
});

test('messages only use the markup the page allows', () => {
  // v-html shows these, so nothing that can run code or load anything
  const allowed = /^<(\/?code|\/?b|\/span|span class="key (cyan|red|grey|green|blue)")>$/;

  for (const { locale, messages } of catalogues) {
    for (const [key, message] of Object.entries(messages)) {
      for (const tag of tags(message)) assert.match(tag, allowed, `${locale} ${key}`);
    }
  }
});

test('translations keep the English placeholders and markup, and add no keys', () => {
  for (const { locale, messages } of catalogues.filter(c => c.locale !== 'en')) {
    for (const [key, message] of Object.entries(messages)) {
      assert.ok(key in en, `${locale} has a key English does not: ${key}`);

      assert.deepEqual(
        [...argumentNames(I18n.parse(message))].sort(),
        [...argumentNames(I18n.parse(en[key]))].sort(),
        `${locale} ${key}: placeholders`
      );
      assert.deepEqual(tags(message), tags(en[key]), `${locale} ${key}: markup`);
    }
  }
});

test('every language in the catalogue folder is registered, and the other way round', () => {
  const files = catalogues.map(c => c.locale).sort();
  const registered = Object.keys(I18n.LOCALES).filter(l => !I18n.LOCALES[l].pseudo).sort();
  assert.deepEqual(files, registered);
});
