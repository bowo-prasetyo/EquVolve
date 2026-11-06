// The interface in Indonesian, and switching language with the menu in
// the top bar: at once, without losing what is on the page, and kept
// for the next visit.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, appUrl, openApp, reload, setSettings, startButton, status, errorBox
} = require('./helpers');

useBrowser();

const languageMenu = (page) => page.locator('nav select.language-select');
const button = (page, name) => page.getByRole('button', { name, exact: true });

test('a browser set to Indonesian gets the interface in Indonesian', async (t) => {
  const page = await openApp(t, { locale: 'id-ID' });

  assert.equal(await page.evaluate(() => document.documentElement.lang), 'id');
  await button(page, 'Mulai Evolusi').waitFor();
  assert.equal(await page.locator('h2').first().innerText(), '1. Data');
  assert.equal(await page.locator('label[for=formula]').innerText(), 'Rumus');
  assert.equal(await languageMenu(page).inputValue(), 'id');
  assert.equal(await languageMenu(page).getAttribute('aria-label'), 'Bahasa');

  // a run, with its results in Indonesian and numbers written the Indonesian way
  await button(page, 'Mulai Evolusi').click();
  await status(page).filter({ hasText: 'Target R² tercapai pada generasi' }).waitFor({ timeout: 30000 });
  assert.match(await page.locator('.stat').nth(1).locator('b').innerText(), /^\d,\d{6}$/);
  assert.match(await page.locator('.fit-quality').innerText(), /^Kecocokan /);
});

test('the menu switches language at once, keeping the page as it is', async (t) => {
  const page = await openApp(t);

  // a run with results, an edited setting and a problem on the page
  await setSettings(page, { 'Max Generations': 3, 'Target R²': 1 });
  await page.locator('#formula').fill('sin(x) * exp(x/3)');
  await startButton(page).click();
  await status(page).filter({ hasText: 'Stopped at Max Generations' }).waitFor({ timeout: 30000 });
  await page.locator('details.advanced summary').click();
  await page.locator('#setting-populationSize').fill('1');
  await button(page, 'New run').click();
  await errorBox(page).waitFor();

  await languageMenu(page).selectOption('id');

  // everything shown is now Indonesian, including messages set before the switch
  await status(page).filter({ hasText: 'Berhenti di Generasi Maks (3)' }).waitFor();
  assert.match(await errorBox(page).innerText(), /Ukuran Populasi harus bilangan bulat/);
  await button(page, 'Lanjutkan').waitFor();
  assert.equal(await page.locator('nav a').first().innerText(), 'Beranda');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'id');

  // but nothing typed or computed was lost
  assert.equal(await page.locator('#formula').inputValue(), 'sin(x) * exp(x/3)');
  assert.equal(await page.locator('#setting-populationSize').inputValue(), '1');
  assert.ok(await page.locator('.expression').isVisible());

  // the choice is kept for the next visit
  await reload(page);
  assert.equal(await languageMenu(page).inputValue(), 'id');
  await page.locator('nav a', { hasText: 'Beranda' }).waitFor();

  // and back to English
  await languageMenu(page).selectOption('en');
  await page.locator('nav a', { hasText: 'Home' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('equvolve-language')), 'en');
});

test('the charts are redrawn in the new language', async (t) => {
  const page = await openApp(t);

  await startButton(page).click();
  await status(page).filter({ hasText: 'Target R² reached' }).waitFor({ timeout: 30000 });

  await page.evaluate(() => {
    window.__drawn = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      window.__drawn.push(String(text));
      return fillText.call(this, text, ...rest);
    };
  });

  await languageMenu(page).selectOption('id');
  await page.waitForFunction(() => window.__drawn.includes('generasi'));

  const drawn = await page.evaluate(() => window.__drawn);
  assert.ok(!drawn.includes('generation'), 'no English axis title left');
  assert.ok(drawn.some(s => /^R² 0,9+$/.test(s)), `Indonesian numbers on the grid: ${drawn.join(' | ')}`);
});

test('choosing a language drops a ?lang= from the address, so a reload keeps the choice', async (t) => {
  const page = await openApp(t, { url: `${appUrl()}?lang=en-XA#/` });

  // the test language is listed while it is in use
  assert.equal(await languageMenu(page).inputValue(), 'en-XA');

  await languageMenu(page).selectOption('id');
  await page.locator('nav a', { hasText: 'Beranda' }).waitFor();
  assert.doesNotMatch(page.url(), /lang=/);

  await reload(page);
  await page.locator('nav a', { hasText: 'Beranda' }).waitFor();
  assert.deepEqual(
    (await languageMenu(page).locator('option').allInnerTexts()).sort(),
    ['Bahasa Indonesia', 'English', '日本語'],
    'test languages are not offered to visitors'
  );
});

test('the About page shows the README in the interface\'s language', async (t) => {
  const page = await openApp(t, { locale: 'id-ID' });

  await page.getByRole('link', { name: 'Tentang', exact: true }).click();
  await page.locator('.about h2', { hasText: 'Fitur' }).waitFor();

  // its in-page links lead to its own (Indonesian) headings
  const broken = await page.$$eval('.about a[href^="#"]', (links) => links
    .map(a => a.getAttribute('href'))
    .filter(href => !href.startsWith('#/'))
    .filter(href => !document.getElementById(decodeURIComponent(href.slice(1)))));
  assert.deepEqual(broken, []);

  // switching language brings the other README
  await languageMenu(page).selectOption('en');
  await page.locator('.about h2', { hasText: 'What it does' }).waitFor();
});

test('without a README in the chosen language the English one is shown', async (t) => {
  const page = await openApp(t, {
    locale: 'id-ID',
    // as if README.id.md were not on GitHub yet
    readme: (route) => (route.request().url().endsWith('/README.id.md') ?
      route.fulfill({ status: 404, body: '404: Not Found' }) :
      route.fulfill({ status: 200, contentType: 'text/plain', body: '# EquVolve\n\n## What it does\n' }))
  });


  await page.getByRole('link', { name: 'Tentang', exact: true }).click();
  await page.locator('.about h2', { hasText: 'What it does' }).waitFor();
});

test('a browser set to Japanese gets the interface in Japanese, with Japanese punctuation', async (t) => {
  const page = await openApp(t, { locale: 'ja-JP' });

  assert.equal(await page.evaluate(() => document.documentElement.lang), 'ja');
  await button(page, '進化を開始').waitFor();
  assert.equal(await page.locator('h2').first().innerText(), '1. データ');
  assert.equal(await languageMenu(page).inputValue(), 'ja');

  // a list in a sentence uses the Japanese comma: sin、exp
  await page.locator('#formula').fill('sin(x) * exp(x)');
  const note = page.locator('.run-message.note').first();
  await note.waitFor();
  assert.match(await note.innerText(), /^数式で sin、exp を使っていますが/);

  // a run, and sentences shown together are joined without a space
  await page.locator('#formula').fill('x*x + 2');
  await button(page, '進化を開始').click();
  await status(page).filter({ hasText: '目標 R² に達しました' }).waitFor({ timeout: 30000 });
  await button(page, '共有リンクをコピー').click();
  await status(page).filter({ hasText: '共有リンク' }).waitFor();
  assert.match(await status(page).innerText(), /。(リンクには|データセットが)/, 'no space between sentences');

  // the About page in Japanese
  await page.getByRole('link', { name: '概要', exact: true }).click();
  await page.locator('.about h2', { hasText: 'できること' }).waitFor();
  const broken = await page.$$eval('.about a[href^="#"]', (links) => links
    .map(a => a.getAttribute('href'))
    .filter(href => !href.startsWith('#/'))
    .filter(href => !document.getElementById(decodeURIComponent(href.slice(1)))));
  assert.deepEqual(broken, [], 'in-page links reach the Japanese headings');
});
