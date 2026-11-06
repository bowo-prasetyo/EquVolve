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
    '9;10;11;',  // a trailing separator is fine
    '12;13;14;15', // a cell past the header does not line up
    '16;17;18'   // ok
  ].join('\n'));

  await loadedSummary(page).filter({ hasText: 'Loaded data.csv: 3 rows' }).waitFor();
  assert.equal(
    await page.locator('.skipped-rows').innerText(),
    'Skipped 4 rows: line 3 (an empty cell); line 4 (missing cells); line 5 (text instead of a number); line 7 (too many cells).'
  );
});

test('a semicolon CSV with decimal commas, as European spreadsheets save it, is read correctly', async (t) => {
  const page = await openApp(t);

  // y = 2x + 0.5, written with decimal commas
  await uploadCsv(page, 'x;y\n0,5;1,5\n1,5;3,5\n2,5;5,5\n3,5;7,5\n', 'eu.csv');

  await loadedSummary(page).filter({ hasText: 'Loaded eu.csv: 4 rows' }).waitFor();
  assert.equal(
    await page.locator('.csv-format').innerText(),
    'Separated by semicolons, with decimal commas (1,5 is read as 1.5).'
  );
  assert.deepEqual(
    await page.locator('table.preview tbody tr').first().locator('td').allInnerTexts(),
    ['0.5', '1.5']
  );
  assert.equal(await page.locator('.skipped-rows').count(), 0);

  // a plain comma-separated file needs no note
  await uploadCsv(page, 'x,y\n1,2\n3,4\n', 'plain.csv');
  await loadedSummary(page).filter({ hasText: 'Loaded plain.csv' }).waitFor();
  assert.equal(await page.locator('.csv-format').count(), 0);
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
    .filter({ hasText: 'The CSV needs at least two columns of numbers, separated by commas, semicolons or tabs.' })
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

// =========================================================
// SKIPPED ROWS, PREVIEW AND SAMPLE DATA
// =========================================================

test('the rows a file loses are reported with their line numbers and why', async (t) => {
  const page = await openApp(t);

  await uploadCsv(page, 'a,b,y\n1,2,3\n4,,6\n7,8,9\nx,1,2\n\n5,5\n10,11,12\n');

  await loadedSummary(page).filter({ hasText: 'Loaded data.csv: 3 rows' }).waitFor();
  assert.equal(
    await page.locator('.skipped-rows').innerText(),
    'Skipped 3 rows: line 3 (an empty cell); line 5 (text instead of a number); line 7 (missing cells).'
  );

  // a clean file reports nothing
  await uploadCsv(page, 'a,b,y\n1,2,3\n4,5,6\n', 'clean.csv');
  await loadedSummary(page).filter({ hasText: 'Loaded clean.csv' }).waitFor();
  assert.equal(await page.locator('.skipped-rows').count(), 0);
});

test('a preview shows the first rows as they will be fitted, with the target marked', async (t) => {
  const page = await openApp(t);

  const rows = Array.from({ length: 8 }, (_, i) => `${i},${10 * i},${i + 100}`);
  await uploadCsv(page, `Height (cm),width,price\n${rows.join('\n')}\n`);
  await loadedSummary(page).waitFor();

  const preview = page.locator('table.preview');
  assert.equal(await preview.locator('caption').innerText(), 'The first 5 of 8 rows, as EquVolve reads them');
  assert.deepEqual(await preview.locator('th').allInnerTexts(), ['Height_cm', 'width', 'price (target)']);
  assert.deepEqual(await preview.locator('tbody tr').first().locator('td').allInnerTexts(), ['0', '0', '100']);
  assert.equal(await preview.locator('tbody tr').count(), 5);

  // it follows the chosen target column
  await page.locator('#target-column').selectOption({ label: 'width' });
  assert.deepEqual(await preview.locator('th').allInnerTexts(), ['Height_cm', 'price', 'width (target)']);
  assert.deepEqual(await preview.locator('tbody tr').nth(1).locator('td').allInnerTexts(), ['1', '101', '10']);
});

test('input columns past the limit are named as ignored', async (t) => {
  const page = await openApp(t);

  const headers = [...'abcdefghijkl'].join(',') + ',y';
  const row = (k) => Array.from({ length: 13 }, (_, j) => k * (j + 1)).join(',');
  await uploadCsv(page, `${headers}\n${row(1)}\n${row(2)}\n${row(3)}\n`);
  await loadedSummary(page).waitFor();

  assert.equal(
    await page.locator('.ignored-columns').innerText(),
    'Only the first 10 input columns are used; ignored: k, l.'
  );
});

test('the sample data can be tried at once or downloaded', async (t) => {
  const page = await openApp(t);

  await page.getByLabel('Upload dataset').check();
  await page.getByRole('button', { name: 'Use sample data', exact: true }).click();

  assert.equal(
    await loadedSummary(page).innerText(),
    'Loaded sample-boxes.csv: 24 rows · inputs: height, width, depth · target: price'
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download sample CSV', exact: true }).click()
  ]);

  assert.equal(download.suggestedFilename(), 'sample-boxes.csv');

  const fs = require('fs');
  const text = fs.readFileSync(await download.path(), 'utf8');
  assert.match(text, /^height,width,depth,price\n/);
  assert.equal(text.trim().split('\n').length, 25);
});
