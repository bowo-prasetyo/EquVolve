// Translation in the real page. The app is run in the pseudo-locale
// en-XA (English with accents, ⟦wrapped⟧ and lengthened; see i18n.js),
// through its main screens: any text still in plain English was missed
// when the strings were moved to locales/en.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, appUrl, openApp, status, errorBox
} = require('./helpers');

useBrowser();

const PSEUDO_URL = () => `${appUrl()}?lang=en-XA#/`;

// Text on the page that is still plain English: visible text nodes and
// the aria-label, title and placeholder of elements, with at least three
// letters in a row and no sign of the pseudo-locale. Text marked
// translate="no" (the brand, operator and language names), code,
// formulas, numbers and the user's own data (file names, column names,
// the preview table) are not translated and are left out.
function untranslated(page) {
  return page.evaluate(() => {
    const PSEUDO = /[⟦⟧áéíóúçñšžŕľďţĥŵýƀƒğĵķɱþǫṽẋÁÉÍÓÚÇÑŠŽŔĽĎŢĤŴÝƁƑĞĴĶṀÞǪṼẊ]/;
    const SKIP = '[translate="no"], code, pre, .code, svg, select#target-column, table.preview td, table.preview th > :not(.hint), noscript, script, style';
    const english = (s) => /[A-Za-z]{3,}/.test(s) && !PSEUDO.test(s);
    const visible = (el) => el && el.getClientRects().length > 0;
    const found = [];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!visible(el) || el.closest(SKIP)) continue;
      // a column name directly inside a preview header cell is data
      if (el.matches('table.preview th')) continue;
      const text = node.textContent.trim();
      if (english(text)) found.push(text);
    }

    for (const el of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
      if (!visible(el) || el.closest('svg')) continue;
      for (const attr of ['aria-label', 'title', 'placeholder']) {
        const value = el.getAttribute(attr);
        if (value && english(value)) found.push(`${attr}="${value}"`);
      }
    }

    return [...new Set(found)];
  });
}

test('English is the default, and <html lang> says so', async (t) => {
  const page = await openApp(t);

  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');
  await page.getByRole('button', { name: 'Start Evolution', exact: true }).waitFor();
});

test('a language the app does not have yet falls back to English', async (t) => {
  const page = await openApp(t, { locale: 'de-DE' });

  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  await page.getByRole('button', { name: 'Start Evolution', exact: true }).waitFor();
});

test('in the pseudo-locale every screen is translated', async (t) => {
  const page = await openApp(t, { url: PSEUDO_URL() });

  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en-XA');

  // the start page, with the advanced settings open
  await page.locator('details.advanced summary').click();
  assert.deepEqual(await untranslated(page), [], 'start page');

  // a problem with the settings, and a formula that needs an operator
  await page.locator('#formula').fill('x*x + 2/x');
  await page.locator('#setting-populationSize').fill('1');
  await page.locator('.run-bar button.primary').click();
  await errorBox(page).waitFor();
  assert.deepEqual(await untranslated(page), [], 'validation messages');

  // a finished run, with its results, tree, history and replay
  await page.locator('#setting-populationSize').fill('200');
  await page.locator('#formula').fill('x*x + 2');
  await page.locator('.run-bar button.primary').click();
  await status(page).filter({ hasText: '⟦' }).waitFor({ timeout: 30000 });
  await page.locator('.expression').waitFor();
  assert.deepEqual(await untranslated(page), [], 'results');

  // a dataset: the CSV hints, the loaded file, its preview and a skipped row
  await page.locator('input[type=radio][value=dataset]').check();
  await page.locator('#csv').setInputFiles({
    name: 'boxes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('height;width;price\n1,5;2;3\n2;3;5\n3;4;x\n4;5;9\n')
  });
  await page.locator('.loaded-line').waitFor();
  await page.locator('.skipped-rows').waitFor();
  assert.deepEqual(await untranslated(page), [], 'dataset');

  // the About page's navigation (the README itself is English for now)
  await page.locator('nav a[href="#/about"]').click();
  await page.locator('.about h1').first().waitFor();
  const nav = await page.locator('nav').innerText();
  assert.doesNotMatch(nav.replace(/[⟦⟧]/g, ''), /\b(Home|About|Auto|Light|Dark)\b/);
});

test('the pseudo-locale keeps values, plurals and markup working', async (t) => {
  const page = await openApp(t, { url: PSEUDO_URL() });

  // validation counts the problems in words: "Fix these 2 problems"
  await page.locator('#setting-maxGenerations').fill('0');
  await page.locator('#setting-targetR2').fill('2');
  await page.locator('.run-bar button.primary').click();
  await errorBox(page).waitFor();
  assert.match(await errorBox(page).locator('.run-message-title').innerText(), /^⟦\S+ ţĥéšé 2 .*⟧$/);

  // a list of operators keeps its <code> markup inside the message
  await page.locator('#formula').fill('sin(x) * exp(x)');
  const note = page.locator('.run-message.note').first();
  await note.waitFor();
  assert.deepEqual(await note.locator('code').allInnerTexts(), ['sin', 'exp']);
  assert.match(await note.innerText(), /⟦.*sin.*exp.*⟧/);
});
