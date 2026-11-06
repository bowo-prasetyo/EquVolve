// Browser tests for running, stopping, resuming and clearing a run.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, openApp, setSettings, button, startButton, errorBox,
  generation, recordGenerations, waitForStatus
} = require('./helpers');

useBrowser();

// sin(x) with the default + - * operators: a polynomial can never fit it
// exactly, so with Target R² 1 a run only ends at Max Generations.
async function setUnreachableTarget(page, maxGenerations) {
  await page.locator('#formula').fill('sin(x)');
  await setSettings(page, { 'Target R²': 1, 'Max Generations': maxGenerations });
}

async function waitForGeneration(page, atLeast) {
  await page.waitForFunction((n) => {
    const stat = [...document.querySelectorAll('.stat')].find(s => s.textContent.includes('Generation'));
    return stat && Number(stat.querySelector('b').textContent) >= n;
  }, atLeast);
}

test('Stop pauses a run and Resume continues it from the same generation', async (t) => {
  const page = await openApp(t);

  await setUnreachableTarget(page, 1000000);
  await startButton(page).click();

  // running: settings locked, only Stop is available
  assert.ok(await button(page, 'Running…').isDisabled());
  assert.ok(await page.locator('#formula').isDisabled());
  assert.equal(await button(page, 'Copy share link').count(), 0);

  await waitForGeneration(page, 3);
  await button(page, 'Stop').click();
  await waitForStatus(page, 'Paused.');

  // paused: settings editable, Clear Results / Resume / Copy share link
  for (const name of ['Clear Results', 'Resume', 'Copy share link']) {
    assert.ok(await button(page, name).isEnabled(), `${name} is available`);
  }
  assert.ok(await page.locator('#formula').isEnabled());

  // the worker really stopped: the generation no longer changes
  await page.waitForTimeout(300);
  const paused = await generation(page);
  await page.waitForTimeout(700);
  assert.equal(await generation(page), paused);

  const seen = await recordGenerations(page);
  await button(page, 'Resume').click();
  assert.ok(await button(page, 'Running…').isDisabled());

  // it continues from where it stopped instead of starting again
  await waitForGeneration(page, paused + 3);
  assert.ok(Math.min(...await seen()) > paused, `went back below ${paused}: ${await seen()}`);

  await button(page, 'Stop').click();
  await waitForStatus(page, 'Paused.');
});

test('a run pauses at Max Generations and Resume continues after raising it', async (t) => {
  const page = await openApp(t);

  await setUnreachableTarget(page, 5);
  await startButton(page).click();

  await waitForStatus(page, 'Stopped at Max Generations (5). Increase Max Generations and press Resume to continue.');
  assert.equal(await generation(page), 5);

  await setSettings(page, { 'Max Generations': 12 });
  const seen = await recordGenerations(page);
  await button(page, 'Resume').click();

  await waitForStatus(page, 'Stopped at Max Generations (12).');
  assert.equal(await generation(page), 12);
  assert.ok(Math.min(...await seen()) > 5, `restarted instead of continuing: ${await seen()}`);
});

test('a run stops as soon as it reaches the target R²', async (t) => {
  const page = await openApp(t);

  // the default x*x + 2 is solved in the first generation
  await startButton(page).click();

  await waitForStatus(page, 'Target R² reached at generation 1.');
  assert.equal(await page.locator('.expression').innerText(), 'y = pow(x, 2) + 2');
});

test('Resume checks the edited settings first', async (t) => {
  const page = await openApp(t);

  await setUnreachableTarget(page, 3);
  await startButton(page).click();
  await waitForStatus(page, 'Stopped at Max Generations (3).');

  await setSettings(page, { 'Population Size': 1, 'Max Generations': 10 });
  await button(page, 'Resume').click();

  await errorBox(page)
    .filter({ hasText: 'Population Size must be a whole number of at least 2.' })
    .waitFor();

  // still paused, nothing ran
  assert.ok(await button(page, 'Resume').isEnabled());
  assert.equal(await generation(page), 3);
});

test('Clear Results clears at once, and Undo brings the run back', async (t) => {
  const page = await openApp(t);

  await setUnreachableTarget(page, 3);
  await startButton(page).click();
  await waitForStatus(page, 'Stopped at Max Generations (3).');
  const expression = await page.locator('.expression').innerText();

  await button(page, 'Clear Results').click();

  // no confirmation dialog: an empty, idle page with an Undo
  assert.deepEqual(page.dialogs, []);
  await startButton(page).waitFor();
  assert.equal(await generation(page), 0);
  assert.equal(await page.locator('.expression').count(), 0);
  assert.equal(await button(page, 'Resume').count(), 0);
  await waitForStatus(page, 'Results cleared.');

  await button(page, 'Undo').click();

  await waitForStatus(page, 'Brought back the run at generation 3.');
  assert.equal(await generation(page), 3);
  assert.equal(await page.locator('.expression').innerText(), expression);
  assert.equal(await button(page, 'Undo').count(), 0);

  // and it carries on from where it was
  await setSettings(page, { 'Max Generations': 6 });
  const seen = await recordGenerations(page);
  await button(page, 'Resume').click();
  await waitForStatus(page, 'Stopped at Max Generations (6).');
  assert.ok(Math.min(...await seen()) > 3, `restarted instead of continuing: ${await seen()}`);
});

test('New run starts again from scratch, and Undo brings back the old run', async (t) => {
  const page = await openApp(t);

  await setUnreachableTarget(page, 4);
  await startButton(page).click();
  await waitForStatus(page, 'Stopped at Max Generations (4).');
  const expression = await page.locator('.expression').innerText();

  // a fresh run of the same settings, without a dialog
  await page.locator('#formula').fill('cos(x)');
  const seen = await recordGenerations(page);
  await button(page, 'New run').click();
  await waitForStatus(page, 'Stopped at Max Generations (4).');
  // the counter went back to the start (in Fast mode it may skip to 4)
  assert.ok(Math.min(...await seen()) < 4, `started again from scratch: ${await seen()}`);
  assert.deepEqual(page.dialogs, []);

  await button(page, 'Undo new run').click();
  await waitForStatus(page, 'Brought back the run at generation 4.');
  assert.equal(await page.locator('.expression').innerText(), expression);
  assert.equal(await page.locator('#formula').inputValue(), 'sin(x)');
});

const primaryButton = (page) => page.locator('.controls button.primary');

test('the main button is the next useful step', async (t) => {
  const page = await openApp(t);

  assert.equal(await primaryButton(page).innerText(), 'Start Evolution');

  // stopped part-way: Resume
  await setUnreachableTarget(page, 1000000);
  await startButton(page).click();
  await waitForGeneration(page, 2);
  await button(page, 'Stop').click();
  await waitForStatus(page, 'Paused.');
  assert.equal(await primaryButton(page).innerText(), 'Resume');
  assert.equal(await page.locator('.resume-hint').count(), 0);

  // at Max Generations, resuming would stop at once: New run, and a hint
  await setSettings(page, { 'Max Generations': 1 });
  assert.equal(await primaryButton(page).innerText(), 'New run');
  await page.locator('.resume-hint').filter({ hasText: 'raise Max Generations and press Resume' }).waitFor();

  // Clear Results is there, but no longer the main button
  assert.ok(await button(page, 'Clear Results').isEnabled());

  // raising it makes Resume the next step again
  await setSettings(page, { 'Max Generations': 1000000 });
  assert.equal(await primaryButton(page).innerText(), 'Resume');
});

test('Resume after reaching the target explains what to change', async (t) => {
  const page = await openApp(t);

  // sin(x) with + - * fits closely, but never perfectly
  await page.locator('#formula').fill('sin(x)');
  await setSettings(page, { 'Target R²': 0.5, 'Max Generations': 1000 });
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');

  assert.equal(await primaryButton(page).innerText(), 'New run');

  // Resume would stop at once: it says why and goes to the setting
  const before = await generation(page);
  await button(page, 'Resume').click();
  await waitForStatus(page, 'raise Target R² and press Resume');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'setting-targetR2');
  assert.equal(await generation(page), before, 'nothing ran');

  // raising the target makes Resume the next step again
  await setSettings(page, { 'Target R²': 0.9999999 });
  assert.equal(await primaryButton(page).innerText(), 'Resume');
});

test('a perfect fit offers New run, not Resume', async (t) => {
  const page = await openApp(t);

  // the default x*x + 2 is found exactly
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');

  assert.equal(await primaryButton(page).innerText(), 'New run');
  await page.locator('.resume-hint').filter({ hasText: 'fits the data perfectly' }).waitFor();
});
