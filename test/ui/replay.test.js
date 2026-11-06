// Browser tests for replaying the improvements of a run.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, openApp, setSettings, button, startButton, waitForStatus
} = require('./helpers');

useBrowser();

const heading = (page) => page.locator('h3', { hasText: /Best program|Replay: best program/ });
const slider = (page) => page.getByRole('slider', { name: 'Replay position' });
const replayHint = (page) => page.locator('.replay .hint');

// A hard target (+ - * approximating sin(x)·exp(x/3)) improves many
// times in 40 generations, so the replay has plenty of steps.
async function finishedRun(page) {
  await page.locator('#formula').fill('sin(x) * exp(x/3)');
  await setSettings(page, { 'Target R²': 1, 'Max Generations': 40 });
  await startButton(page).click();
  await waitForStatus(page, 'Stopped at Max Generations (40).');

  const steps = Number(await slider(page).getAttribute('max')) + 1;
  assert.ok(steps > 2, `expected several improvements, got ${steps}`);

  return steps;
}

test('the slider steps through every improvement and back to the latest', async (t) => {
  const page = await openApp(t);
  const steps = await finishedRun(page);

  assert.equal(await heading(page).innerText(), 'Best program');
  assert.match(await replayHint(page).innerText(), new RegExp(`^latest · ${steps} improvements$`));
  const latest = await page.locator('.expression').innerText();

  // the first improvement is the best program of generation 1
  await slider(page).fill('0');
  assert.equal(await heading(page).innerText(), 'Replay: best program at generation 1');
  assert.match(await replayHint(page).innerText(), /^generation 1 · R² /);
  assert.ok(await page.locator('.expression.replaying').isVisible());

  // the formula, export and tree follow the replay position
  const first = await page.locator('.expression').innerText();
  assert.equal(
    await page.locator('.export-text').innerText(),
    first.replace(/^y = /, '')
  );
  assert.match(await page.locator('svg.tree').getAttribute('aria-label'), new RegExp(`^Expression tree for ${escape(first)}$`));

  await button(page, 'Back to latest').click();
  assert.equal(await heading(page).innerText(), 'Best program');
  assert.equal(await page.locator('.expression').innerText(), latest);
  assert.equal(await button(page, 'Back to latest').count(), 0);

  // the last slider position is the latest program too
  await slider(page).fill('1');
  await slider(page).fill(String(steps - 1));
  assert.equal(await heading(page).innerText(), 'Best program');
});

test('Replay plays to the end, and can be paused part-way', async (t) => {
  const page = await openApp(t);
  const steps = await finishedRun(page);

  // pause part-way: the position stays put
  await slider(page).fill('0');
  await button(page, 'Play replay').click();
  await button(page, 'Pause replay').waitFor();
  await page.waitForTimeout(600);
  await button(page, 'Pause replay').click();

  const pausedAt = await heading(page).innerText();
  assert.match(pausedAt, /^Replay: best program at generation \d+$/);
  await page.waitForTimeout(700);
  assert.equal(await heading(page).innerText(), pausedAt);

  // from the second-to-last step, playing ends back at the latest
  await slider(page).fill(String(steps - 2));
  await button(page, 'Play replay').click();
  await heading(page).filter({ hasText: /^Best program$/ }).waitFor({ timeout: 5000 });
  await button(page, 'Play replay').waitFor();
});

test('the replay is hidden while a run is going', async (t) => {
  const page = await openApp(t);
  await finishedRun(page);

  await slider(page).fill('0');
  await setSettings(page, { 'Max Generations': 1000000 });
  await button(page, 'Resume').click();

  // resuming leaves the replay and hides its controls
  await button(page, 'Stop').waitFor();
  assert.equal(await slider(page).count(), 0);
  assert.equal(await heading(page).innerText(), 'Best program');

  await button(page, 'Stop').click();
  await slider(page).waitFor();
});

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
