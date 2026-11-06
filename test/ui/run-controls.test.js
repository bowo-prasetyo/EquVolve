// Browser tests for running, stopping, resuming and clearing a run.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, openApp, setSettings, button, startButton, status, errorBox,
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

  await setSettings(page, { 'Population Size': 1 });
  await button(page, 'Resume').click();

  await errorBox(page)
    .filter({ hasText: 'Population Size must be a whole number of at least 2.' })
    .waitFor();

  // still paused, nothing ran
  assert.ok(await button(page, 'Resume').isEnabled());
  assert.equal(await generation(page), 3);
});

test('Clear Results asks first, then returns to an empty idle state', async (t) => {
  const page = await openApp(t);

  await setUnreachableTarget(page, 3);
  await startButton(page).click();
  await waitForStatus(page, 'Stopped at Max Generations (3).');

  // declining the confirmation keeps everything
  page.answerDialogs = 'dismiss';
  await button(page, 'Clear Results').click();
  assert.deepEqual(page.dialogs, ['Clear all evolution results?']);
  assert.ok(await button(page, 'Resume').isEnabled());
  assert.equal(await generation(page), 3);

  page.answerDialogs = 'accept';
  await button(page, 'Clear Results').click();

  await startButton(page).waitFor();
  assert.equal(await generation(page), 0);
  assert.equal(await page.locator('.expression').count(), 0);
  assert.equal(await button(page, 'Resume').count(), 0);
  assert.equal(await status(page).count(), 0);
});
