// Browser tests for checking the settings before a run: every problem
// is shown at once, next to its field, and focus goes to the first one;
// and for the hint when the formula needs operators that are not ticked.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, openApp, setSettings, button, startButton, errorBox, runBar, waitForStatus
} = require('./helpers');

useBrowser();

const focusedId = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
const advancedOpen = (page) => page.locator('details.advanced').evaluate(d => d.open);
const invalidIds = (page) => page.$$eval('[aria-invalid="true"]', (els) => els.map(e => e.id));

// =========================================================
// VALIDATION
// =========================================================

test('every problem is listed at once, in page order, and the first is focused', async (t) => {
  const page = await openApp(t);

  await page.locator('#formula').fill('foo(x');
  await setSettings(page, { 'Target R²': 2, 'Population Size': -5 });

  // close Advanced again: a problem in there must open it
  await page.locator('details.advanced summary').click();
  assert.equal(await advancedOpen(page), false);

  await startButton(page).click();

  const alert = errorBox(page);
  await alert.waitFor();
  assert.match(await alert.innerText(), /Fix these 3 problems to continue/);
  assert.deepEqual(await alert.locator('li').allInnerTexts(), [
    'Formula is invalid: unknown name "foo"',
    'Target R² must be a number no greater than 1.',
    'Population Size must be a whole number of at least 2.'
  ]);

  // each field is marked and explains its problem
  assert.deepEqual((await invalidIds(page)).sort(), ['formula', 'setting-populationSize', 'setting-targetR2']);
  assert.equal(
    await page.locator('#formula').getAttribute('aria-describedby'),
    'error-targetFormula'
  );
  assert.equal(await page.locator('#error-targetFormula').innerText(), 'Formula is invalid: unknown name "foo"');

  assert.equal(await focusedId(page), 'formula');
  assert.equal(await advancedOpen(page), true, 'Advanced settings opened to show their problem');

  // nothing started
  assert.ok(await startButton(page).isEnabled());
});

test('problems go away as they are fixed, and a listed problem leads to its field', async (t) => {
  const page = await openApp(t);

  await page.locator('#formula').fill('foo(x');
  await setSettings(page, { 'Max Generations': 0 });
  await startButton(page).click();
  await errorBox(page).waitFor();
  assert.equal(await errorBox(page).locator('li').count(), 2);

  // following the second problem focuses its field
  await errorBox(page).getByRole('link', { name: /Max Generations/ }).click();
  assert.equal(await focusedId(page), 'setting-maxGenerations');

  // fixing it updates the list straight away
  await setSettings(page, { 'Max Generations': 50 });
  assert.deepEqual(await errorBox(page).locator('li').allInnerTexts(), ['Formula is invalid: unknown name "foo"']);
  assert.match(await errorBox(page).innerText(), /Fix this to continue/);
  assert.deepEqual(await invalidIds(page), ['formula']);

  await page.locator('#formula').fill('x*x + 2');
  assert.equal(await errorBox(page).count(), 0);
  assert.deepEqual(await invalidIds(page), []);

  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');
});

test('a bad formula is reported even when other settings are wrong too', async (t) => {
  const page = await openApp(t);

  await page.locator('#formula').fill('x +* 2');
  await page.locator('#samples').fill('1');
  await startButton(page).click();

  const items = await errorBox(page).locator('li').allInnerTexts();
  assert.equal(items.length, 2, items.join(' | '));
  assert.match(items[0], /^Formula is invalid/);
  assert.match(items[1], /^Sample Points/);
});

// =========================================================
// OPERATOR HINT
// =========================================================

const operatorNote = (page) => runBar(page).locator('.run-message.note');
const checked = (page, op) => page.locator(`.operator-groups input[value="${op}"]`).isChecked();

test('a formula that needs an operator that is not ticked says so, and one click ticks it', async (t) => {
  const page = await openApp(t);

  // the default x*x + 2 needs only + and *
  assert.equal(await operatorNote(page).count(), 0);

  await page.locator('#formula').fill('x*x + 2/x');
  await operatorNote(page).filter({ hasText: 'Your formula uses /, which is not ticked under Operators' }).waitFor();

  await button(page, 'Tick /').click();
  assert.ok(await checked(page, '/'));
  assert.equal(await operatorNote(page).count(), 0);

  // several at once, each named
  await page.locator('#formula').fill('sin(x) * exp(x/3)');
  await operatorNote(page).filter({ hasText: 'uses sin and exp, which are not ticked' }).waitFor();
  await button(page, 'Tick sin exp').click();
  assert.ok(await checked(page, 'sin'));
  assert.ok(await checked(page, 'exp'));
  assert.equal(await operatorNote(page).count(), 0);
});

test('whole powers need only *, and functions that are not operators are pointed out', async (t) => {
  const page = await openApp(t);

  await page.locator('#formula').fill('pow(x, 3) - x**2');
  assert.equal(await operatorNote(page).count(), 0);

  await page.locator('#formula').fill('abs(x)');
  await operatorNote(page).filter({ hasText: 'abs is not available as an operator' }).waitFor();
  assert.equal(await runBar(page).getByRole('button', { name: /^Tick/ }).count(), 0);
});

test('the operator hint is not shown for an uploaded dataset', async (t) => {
  const page = await openApp(t);

  await page.locator('#formula').fill('x / 2 + sin(x)');
  await operatorNote(page).waitFor();

  await page.getByLabel('Upload dataset').check();
  assert.equal(await operatorNote(page).count(), 0);
});

// =========================================================
// RUN BAR
// =========================================================

test('the run buttons stay in view at the bottom until the results are reached', async (t) => {
  const page = await openApp(t);
  const viewport = page.viewportSize();

  // at the top of the page, Start is visible at the bottom of the window
  const start = await startButton(page).boundingBox();
  assert.ok(start.y >= 0 && start.y + start.height <= viewport.height, `Start at y = ${start.y}`);

  // scrolled to the end, the bar sits in its place above the results
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bar = await runBar(page).boundingBox();
  const results = await page.locator('.panel', { hasText: '3. Results' }).boundingBox();
  assert.ok(bar.y + bar.height <= results.y + 1, `bar ends at ${bar.y + bar.height}, results start at ${results.y}`);
});

test('on a phone, Start is in view without scrolling', async (t) => {
  const page = await openApp(t, { viewport: { width: 390, height: 664 } });

  const start = await startButton(page).boundingBox();
  assert.ok(start.y + start.height <= 664, `Start at y = ${start.y}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'no sideways scrolling');

  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');
});
