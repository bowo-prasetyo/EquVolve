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

// =========================================================
// NUMBERS, RIGHT TO LEFT, AND ROOM FOR LONGER LANGUAGES
// =========================================================

test('numbers on the page are written the language\'s way, formulas keep a point', async (t) => {
  // en-XA writes numbers as German does: 0,5 and 1.234
  const page = await openApp(t, { url: PSEUDO_URL() });

  await page.locator('#formula').fill('x*x + 0.5');
  await page.locator('.run-bar button.primary').click();
  await status(page).filter({ hasText: '⟦' }).waitFor({ timeout: 30000 });

  const bestR2 = await page.locator('.stat').nth(1).locator('b').innerText();
  assert.match(bestR2, /^\d,\d{6}$/, `Best R² ${bestR2}`);
  assert.match(await page.locator('.history-meta').first().innerText(), /² \d,\d+/);

  // the formula and its exports are code, with a decimal point
  assert.match(await page.locator('.expression').innerText(), /\d\.\d|x/);
  assert.doesNotMatch(await page.locator('.export-text').innerText(), /\d,\d/);

  // the CSV preview shows the numbers as the file's readers write them
  await page.locator('input[type=radio][value=dataset]').check();
  await page.locator('#csv').setInputFiles({
    name: 'eu.csv', mimeType: 'text/csv', buffer: Buffer.from('x;y\n0,5;1,5\n1,5;3,5\n2,5;5,5\n')
  });
  await page.locator('table.preview').waitFor();
  assert.deepEqual(await page.locator('table.preview tbody tr').first().locator('td').allInnerTexts(), ['0,5', '1,5']);
});

test('a right-to-left language mirrors the layout, but formulas and charts stay left to right', async (t) => {
  const page = await openApp(t, { url: `${appUrl()}?lang=ar-XB#/` });

  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');

  const x = async (locator) => (await locator.boundingBox()).x;

  // the navigation starts at the right, with the theme button at the left
  const home = page.locator('nav a').first();
  const about = page.locator('nav a').nth(1);
  assert.ok(await x(home) > await x(about), 'Home is right of About');
  assert.ok(await x(page.locator('.theme-toggle')) < await x(about), 'theme button at the far left');

  // labels sit to the right of their inputs
  assert.ok(await x(page.locator('label[for=formula]')) > await x(page.locator('#formula')));

  // formulas, code, charts and the slider read left to right
  const direction = (sel) => page.locator(sel).first().evaluate(el => getComputedStyle(el).direction);
  assert.equal(await direction('#formula'), 'ltr');
  assert.equal(await direction('code'), 'ltr');
  assert.equal(await direction('canvas'), 'ltr');
  // numbers being typed too, or -5 would show as 5-
  assert.equal(await direction('#min-x'), 'ltr');

  // a run works and its results stay readable
  await page.locator('.run-bar button.primary').click();
  await page.locator('.expression').waitFor({ timeout: 30000 });
  assert.equal(await direction('.expression'), 'ltr');
  assert.equal(await direction('svg.tree'), 'ltr');
});

for (const lang of ['en-XA', 'ar-XB', 'ja']) {
  test(`on a small phone, ${lang} text wraps instead of widening the page`, async (t) => {
    const page = await openApp(t, { url: `${appUrl()}?lang=${lang}#/`, viewport: { width: 320, height: 640 } });
    const overflow = () => page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')]
        .filter(el => el.getClientRects().length && !el.closest('pre, .code, .preview-wrap'))
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.right > width + 1 || r.left < -1;
        })
        .map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      return { scroll: document.documentElement.scrollWidth - width, wide: [...new Set(wide)].slice(0, 5) };
    });

    await page.locator('details.advanced summary').click();
    await page.locator('#formula').fill('sin(x) + 1/x');
    await page.locator('#setting-populationSize').fill('1');
    await page.locator('.run-bar button.primary').click();
    await errorBox(page).waitFor();
    assert.deepEqual(await overflow(), { scroll: 0, wide: [] }, 'formula mode, with problems listed');

    await page.locator('input[type=radio][value=dataset]').check();
    await page.locator('.sample-row button').first().click();
    await page.locator('table.preview').waitFor();
    assert.deepEqual(await overflow(), { scroll: 0, wide: [] }, 'dataset mode, with the sample loaded');
  });
}

test('the words drawn on the charts are translated too', async (t) => {
  const page = await openApp(t, { url: PSEUDO_URL() });

  // record every text the charts draw from now on
  await page.evaluate(() => {
    window.__drawn = new Set();
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      window.__drawn.add(String(text));
      return fillText.call(this, text, ...rest);
    };
  });

  // one input: the fit chart and the progress chart
  await page.locator('.run-bar button.primary').click();
  await status(page).filter({ hasText: '⟦' }).waitFor({ timeout: 30000 });

  // several inputs: the predicted-against-actual chart
  await page.locator('input[type=radio][value=dataset]').check();
  await page.locator('.sample-row button').first().click();
  await page.locator('table.preview').waitFor();
  await page.waitForTimeout(300);

  const drawn = await page.evaluate(() => [...window.__drawn]);
  const english = drawn.filter(s => /[A-Za-z]{3,}/.test(s) && !/[⟦⟧]/.test(s));

  assert.ok(drawn.length > 5, `charts drew text: ${drawn.join(' | ')}`);
  assert.deepEqual(english, []);
  assert.ok(drawn.some(s => /^⟦ğéñéŕáţíóñ/.test(s)), 'the progress chart\'s axis title');
  assert.ok(drawn.some(s => /^⟦þŕéďíçţéď/.test(s)), 'the predicted axis title');
});
