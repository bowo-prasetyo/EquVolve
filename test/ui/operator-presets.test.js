// Browser tests for the operator checkboxes and their presets.
const test = require('node:test');
const assert = require('node:assert/strict');
const { OP_ARITY } = require('../../shared.js');
const {
  useBrowser, openApp, setSettings, button, startButton, errorBox, waitForStatus
} = require('./helpers');

useBrowser();

const PRESETS = {
  Polynomial: ['+', '-', '*'],
  Rational: ['+', '-', '*', '/'],
  Trigonometric: ['+', '-', '*', '/', 'sin', 'cos'],
  'Exp / Log': ['+', '-', '*', '/', 'exp', 'log'],
  Everything: Object.keys(OP_ARITY)
};

const presetButtons = (page) => page.locator('.preset-row button');
const operatorBox = (page, op) => page.locator(`.operator-groups input[type="checkbox"][value="${op}"]`);

// The ticked operators, sorted, for comparing as sets.
const checkedOperators = (page) => page.$$eval(
  '.operator-groups input[type="checkbox"]:checked',
  (boxes) => boxes.map(b => b.value).sort()
);

// The names of the highlighted preset buttons.
const activePresets = (page) => page.$$eval(
  '.preset-row button.active',
  (buttons) => buttons.map(b => b.textContent.trim())
);

test('every operator has a checkbox, and the defaults are the Polynomial preset', async (t) => {
  const page = await openApp(t);

  const all = await page.$$eval('.operator-groups input[type="checkbox"]', (boxes) => boxes.map(b => b.value));
  assert.deepEqual([...all].sort(), Object.keys(OP_ARITY).sort());
  assert.equal(all.length, 23);

  assert.deepEqual(await presetButtons(page).allInnerTexts(), Object.keys(PRESETS));
  assert.deepEqual(await checkedOperators(page), [...PRESETS.Polynomial].sort());
  assert.deepEqual(await activePresets(page), ['Polynomial']);
});

test('each preset ticks exactly its operators and is the one highlighted', async (t) => {
  const page = await openApp(t);

  for (const [name, ops] of Object.entries(PRESETS)) {
    await button(page, name).click();

    assert.deepEqual(await checkedOperators(page), [...ops].sort(), name);
    assert.deepEqual(await activePresets(page), [name], `${name} is highlighted`);
  }
});

test('the highlight follows hand-made changes to the checkboxes', async (t) => {
  const page = await openApp(t);

  await button(page, 'Rational').click();
  assert.deepEqual(await activePresets(page), ['Rational']);

  // removing / leaves exactly the Polynomial operators
  await operatorBox(page, '/').uncheck();
  assert.deepEqual(await activePresets(page), ['Polynomial']);

  // adding pow matches no preset
  await operatorBox(page, 'pow').check();
  assert.deepEqual(await activePresets(page), []);

  // ticking sin, cos and / (and dropping pow) matches Trigonometric
  await operatorBox(page, 'pow').uncheck();
  for (const op of ['/', 'sin', 'cos']) await operatorBox(page, op).check();
  assert.deepEqual(await activePresets(page), ['Trigonometric']);
});

test('a run needs at least one operator', async (t) => {
  const page = await openApp(t);

  for (const op of PRESETS.Polynomial) await operatorBox(page, op).uncheck();
  assert.deepEqual(await activePresets(page), []);

  await startButton(page).click();
  await errorBox(page).filter({ hasText: 'Select at least one operator.' }).waitFor();
  assert.ok(await startButton(page).isEnabled(), 'nothing started');
});

test('presets and checkboxes are locked while a run is going', async (t) => {
  const page = await openApp(t);

  await page.locator('#formula').fill('sin(x)');
  await setSettings(page, { 'Target R²': 1, 'Max Generations': 1000000 });
  await startButton(page).click();
  await button(page, 'Stop').waitFor();

  for (const name of Object.keys(PRESETS)) {
    assert.ok(await button(page, name).isDisabled(), `${name} is disabled`);
  }
  assert.ok(await operatorBox(page, 'sin').isDisabled());

  await button(page, 'Stop').click();
  await waitForStatus(page, 'Paused.');
  assert.ok(await button(page, 'Everything').isEnabled());
  assert.ok(await operatorBox(page, 'sin').isEnabled());
});

test('a run only uses the operators of the chosen preset', async (t) => {
  const page = await openApp(t);

  // + - * cannot express sin(x): the best program is a polynomial
  await page.locator('#formula').fill('sin(x)');
  await setSettings(page, { 'Target R²': 1, 'Max Generations': 15 });
  await startButton(page).click();
  await waitForStatus(page, 'Stopped at Max Generations (15).');

  const polynomial = await page.locator('.expression').innerText();
  assert.doesNotMatch(polynomial, /\b(sin|cos|tan|exp|log|sqrt|cbrt)\w*\(/, polynomial);

  // with sin available the same target is found exactly: y = sin(x)
  page.answerDialogs = 'accept';
  await button(page, 'Clear Results').click();
  await startButton(page).waitFor();
  await button(page, 'Trigonometric').click();
  await setSettings(page, { 'Target R²': 0.999999, 'Max Generations': 200 });
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');

  assert.match(await page.locator('.expression').innerText(), /\bsin\(/);
});
