// Browser tests for the CSV upload flow: the real page, served over
// HTTP, driven in headless Chromium with Playwright.
//
//   npm run test:ui
//
// The page loads Vue, Vue Router and Marked from jsDelivr, so these
// tests need network access.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, openApp, uploadCsv, loadedSummary, startButton, status, errorBox
} = require('./helpers');

useBrowser();

test('a two-column CSV loads as x and evolves a fitting formula', async (t) => {
  const page = await openApp(t);

  // y = 2x + 1, plus one non-numeric row that must be skipped
  await uploadCsv(page, 'hours,score\n0,1\n1,3\n2,5\nn/a,7\n3,7\n4,9\n');

  await loadedSummary(page).filter({ hasText: 'Loaded data.csv: 5 rows' }).waitFor();

  // two columns: no target menu and no input list (the input is x)
  assert.equal(await page.locator('#target-column').count(), 0);
  assert.match(await loadedSummary(page).innerText(), /^Loaded data\.csv: 5 rows$/);

  await startButton(page).click();
  await status(page).filter({ hasText: 'Target R² reached' }).waitFor({ timeout: 30000 });

  assert.match(await page.locator('.expression').innerText(), /^y = .*\bx\b/);
  assert.match(
    await page.locator('figcaption').first().innerText(),
    /data and best program/
  );
});

test('several columns: inputs get cleaned names and the target column can be changed', async (t) => {
  const page = await openApp(t);

  await uploadCsv(page, 'Height (cm),width,price\n1,2,3\n4,5,6\n7,8,10\n', 'boxes.csv');

  const select = page.locator('#target-column');
  await select.waitFor();

  // the last column is the default target
  assert.equal(await select.inputValue(), '2');
  assert.deepEqual(
    await select.locator('option').allInnerTexts(),
    ['Height (cm)', 'width', 'price']
  );
  assert.equal(
    await loadedSummary(page).innerText(),
    'Loaded boxes.csv: 3 rows · inputs: Height_cm, width · target: price'
  );

  await select.selectOption({ label: 'width' });

  await loadedSummary(page)
    .filter({ hasText: 'inputs: Height_cm, price · target: width' })
    .waitFor();
});

test('rows with empty, missing or non-numeric cells are skipped', async (t) => {
  const page = await openApp(t);

  await uploadCsv(page, [
    'a;b;y',
    '1;2;3',     // ok
    '1.5;;3',    // empty cell
    '4;5',       // too few cells
    '6;seven;8', // not a number
    '9\t10\t11', // tabs work too
    '12,13,14,15' // extra cells are ignored
  ].join('\n'));

  await loadedSummary(page).filter({ hasText: 'Loaded data.csv: 3 rows' }).waitFor();
});

test('a CSV without a header row names its columns x1, x2, … and y', async (t) => {
  const page = await openApp(t);

  await uploadCsv(page, '1,2,3\n4,5,6\n7,8,10\n');

  await loadedSummary(page)
    .filter({ hasText: 'Loaded data.csv: 3 rows · inputs: x1, x2 · target: y' })
    .waitFor();
});

test('a CSV without two numeric columns is rejected with a message', async (t) => {
  const page = await openApp(t);

  await uploadCsv(page, 'only\n1\n2\n3\n', 'one-column.csv');

  await errorBox(page)
    .filter({ hasText: 'The CSV needs a header row and at least two numeric columns.' })
    .waitFor();
  assert.equal(await loadedSummary(page).count(), 0);
});

test('starting in dataset mode without a file explains what is missing', async (t) => {
  const page = await openApp(t);

  await page.getByLabel('Upload dataset').check();
  await startButton(page).click();

  await errorBox(page)
    .filter({ hasText: 'Upload a CSV dataset with at least 2 valid rows.' })
    .waitFor();

  // nothing started: the start button is still there and enabled
  assert.ok(await startButton(page).isEnabled());
});

test('a multi-variable run exports a function of the named inputs', async (t) => {
  const page = await openApp(t);

  // y = a + 2b
  const rows = ['a,b,y'];
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) rows.push(`${a},${b},${a + 2 * b}`);
  }

  await uploadCsv(page, rows.join('\n'));
  await loadedSummary(page).filter({ hasText: '16 rows · inputs: a, b · target: y' }).waitFor();

  await startButton(page).click();
  await status(page).filter({ hasText: 'Target R² reached' }).waitFor({ timeout: 60000 });

  assert.match(await page.locator('figcaption').first().innerText(), /predicted vs actual/);

  await page.getByRole('tab', { name: 'JavaScript' }).click();
  assert.match(await page.locator('.export-text').innerText(), /^const f = \(a, b\) => /);

  await page.getByRole('tab', { name: 'Python' }).click();
  assert.match(await page.locator('.export-text').innerText(), /def f\(a, b\):/);
});

test('a share link carries the uploaded dataset to a new visitor', async (t) => {
  const page = await openApp(t);

  await uploadCsv(page, 'x,y\n0,1\n1,3\n2,5\n3,7\n', 'line.csv');
  await startButton(page).click();
  await status(page).filter({ hasText: 'Target R² reached' }).waitFor({ timeout: 30000 });

  await page.getByRole('button', { name: 'Copy share link' }).click();

  const link = page.getByLabel('Share link');
  await link.waitFor();
  const url = await link.inputValue();

  assert.match(url, /#\/\?run=[zj]/);

  const visitor = await openApp(t, { url });

  await status(visitor).filter({ hasText: 'Loaded a shared run' }).waitFor();
  await loadedSummary(visitor).filter({ hasText: 'Loaded line.csv: 4 rows' }).waitFor();
  assert.ok(await visitor.getByLabel('Upload dataset').isChecked());
});
