# Translating EquVolve

This guide is for people translating EquVolve's interface, and for developers adding or changing its text. For how the code fits together, see the [developer guide](DEVELOPMENT.md).

Every word the app shows comes from one file per language in [`locales/`](../locales). English, [`locales/en.json`](../locales/en.json), is the source and the fallback: a message missing from a translation is shown in English.

The app is available in English and Indonesian ([`locales/id.json`](../locales/id.json)). Visitors get their browser's language if the app has it, and can switch with the menu in the top bar; the change is immediate and remembered in their browser.

## The message files

Each file is a flat JSON object of keys and messages:

```json
{
  "run.start": "Start Evolution",
  "csv.loaded": "Loaded {file}: {count, plural, one {# row} other {# rows}}"
}
```

- **Keys** say where a message is used: `data.*` is panel 1, `settings.*`, `setting.*`, `operators.*` and `advanced.*` are panel 2, `run.*` is the run bar, `results.*`, `replay.*`, `chart.*`, `tree.*` and `history.*` are panel 3, `status.*`, `resume.*` and `share.*` are messages in the run bar, `validation.*` and `formula.error.*` are problems with the settings, and `csv.*` is about uploaded files. Never change a key in a translation.
- **Messages** use a small part of [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/), the format most translation platforms (Crowdin, Weblate, Lokalise, Phrase) understand as "ICU JSON".

### Placeholders

`{file}`, `{generation}`, `{max}` and so on are filled in by the app. Keep each one, spelled exactly the same, and move it to wherever your language needs it:

```json
"status.targetReached": "Target R² reached at generation {generation}."
```

A placeholder that receives a list (such as `{names}` or `{ops}`) is written out by the app in your language's own way, such as "sin, exp and log" in English. Numbers, in placeholders and as `#` in plurals, are written your language's way too (1,234.5 in English, 1.234,5 in German), so never format them in the message. Formulas, code and exports always keep a decimal point.

In a right-to-left language each value filled into a placeholder is isolated from the text around it, so a file name, formula or number keeps its own direction and the sentence keeps yours. Formulas, code, charts and the expression tree are always shown left to right.

### Plurals

Write the forms your language needs. Each form starts with a [CLDR plural category](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html) (`zero`, `one`, `two`, `few`, `many`, `other`), and `other` is always required. `#` is the number:

```json
"replay.improvements": "{count, plural, one {# improvement} other {# improvements}}"
```

Polish, for example, needs `one`, `few`, `many` and `other`; Japanese and Indonesian need only `other`. `=0`, `=1`, … match one exact number.

A language without plural forms may drop a plural that only chooses a word, and write the placeholder directly. Indonesian, for example, writes `"{count} baris"` for English's `"{count, plural, one {# row} other {# rows}}"`, and `"baris {lines} ({reason})"` for `"{count, plural, one {line} other {lines}} {lines} ({reason})"`, leaving out `count`, whose value English never shows there. A placeholder whose value is shown must always be kept.

### Selects

A select picks a wording from a value the app passes. Translate the text inside the braces, never the words before them:

```json
"fit.quality": "{level, select, excellent {Excellent fit} veryGood {Very good fit} … other {Worse than guessing the average}}"
```

`fit.quality` stands alone (the badge under Best R²); `fit.quality.inline` is used inside a sentence, so write it as it reads mid-sentence in your language.

### Apostrophes and braces

An apostrophe is just an apostrophe (`l'opérateur` needs no escaping). Only to write a literal `{`, `}` or `#`, put it in apostrophes: `'{'`. Two apostrophes, `''`, are one.

### Markup

A few messages contain markup. Keep every tag exactly as in English, around the words that correspond to the English ones:

- `<code>…</code>` holds code, such as `<code>x</code>` or `<code>sin(x)</code>`: never translate what is inside.
- `<span class="key red">…</span>` and the other `key` colours mark the words that name a line on a chart, in the same colour as the line.

No other markup is allowed; the tests reject it.

### What not to translate

- Operator and function names (`sin`, `pow`, `log2`), `x`, `y`, formulas and anything in `<code>`.
- `R²`, `EquVolve`, `README.md`, and the names of programming languages.
- The emoji at the start of the theme labels.

## Trying your translation

1. Copy `locales/en.json` to `locales/<code>.json`, where `<code>` is a [BCP 47 language tag](https://www.w3.org/International/articles/language-tags/) such as `de`, `pt-BR` or `zh-Hans`, and translate the messages.
2. Register the language in `LOCALES` at the top of [`i18n.js`](../i18n.js): its name in its own language, the locale used for plural, list and number formatting (`intl`, for example `ar-EG` for Arabic digits or `ar` for Western ones), and `dir: 'rtl'` for languages written right to left.
3. Serve the folder (`python3 -m http.server 8000`) and open `http://localhost:8000/?lang=<code>#/`. Without `?lang=`, the app follows the browser's language.
4. Run `npm test`. It checks that every message is valid, keeps the English placeholders and markup, and that the translation is complete. It also lists every message that is still identical to English: if one is right as it is (in Indonesian, "1. Data" and "Target R²" are), add its key to `SAME_AS_ENGLISH` in `test/locales.test.js`.
5. Add the language to the menu's tests in `test/ui/language.test.js` if it needs anything special, such as right-to-left layout.

## Translating the README

The About page shows the README in the interface's language: `README.<code>.md` (such as [`README.id.md`](../README.id.md)), fetched from the `main` branch, or the English one if there is none yet.

- Add the file to `README_FILES` in `app.js`, and a link to it at the top of the English README.
- Translate the headings too, and point its in-page links (`#…`) at your headings' anchors: GitHub's, which the About page also uses (lowercase, punctuation removed, spaces as hyphens, so `## Jika proses tidak mencapai target` is `#jika-proses-tidak-mencapai-target`).
- Link to other files with their full GitHub address, not a relative path: the About page shows the README on the app's own site, where `docs/…` does not exist.
- The developer sections may be summarised with a link to the English README; they change most often.
- Name buttons and settings exactly as your translation of the interface does.

`npm test` checks every README's in-page links and its links to other files.

## The pseudo-locales (for developers)

Two generated test languages show what a real translation would run into, before there is one:

- `?lang=en-XA`: English with accented letters, about 30% longer and wrapped in `⟦ ⟧`, with numbers written the German way (`0,999`, `1.234`). Text in plain English there was missed; text that is cut off or overlaps will be in longer languages too; a sentence split into several `⟦ ⟧` pieces was assembled from fragments and cannot be translated well; and a number with a decimal point outside a formula was not localized.
- `?lang=ar-XB`: the page laid out right to left, with every message's words forced to run right to left (so they read backwards), as in Android's pseudo-bidi locale. The layout should mirror; formulas, code, charts, the tree and number inputs should not; and text that reads forwards did not come from a message.

The browser tests in `test/ui/i18n.test.js` run the main screens in both: they fail on plain English in the page or drawn on the charts, on unlocalized numbers, on a layout that does not mirror, and on a page that scrolls sideways on a 320 px phone.

## Adding or changing text (for developers)

- Add the English message to `locales/en.json` and show it with `t('key', params)` in code, or `$t('key', params)` in a template. A message with markup is shown with `v-html="$th('key', params)"`, which escapes every parameter, so a file or column name can never inject markup. In `shared.js`, use `msg('key', params)`.
- Write whole sentences with placeholders, never sentences glued from pieces: word order differs between languages. Use `plural` for anything counted, never `count === 1 ? … : …`. Pass arrays for lists rather than joining them yourself.
- Show numbers that are values (not code) with `I18n.number(value, options)` in code or `$n(value, options)` in templates, or pass them as numbers to a message. Never `toFixed()` or `String()` a number the user reads.
- Write keys in full, in single quotes (`t('run.start')`, `labelKey: 'setting.maxGenerations.label'`), never built from parts: `npm test` finds unused and missing keys by looking for them in the code.
- Give anything that must read left to right in every language (formulas, URLs, number inputs, charts) `dir="ltr"`, and use logical CSS properties (`margin-inline-start`, `text-align: end`), never `left` and `right`.
- Mark text that must never be translated, such as names and code, with `translate="no"`. The pseudo-locale test skips it, and so does browser auto-translate.
- Data never holds words: the CSV parser's skip reasons and formula errors are codes, put into words where they are shown.
- When you change the meaning of an English message, give it a new key, so translations of the old meaning are not shown for the new one.
