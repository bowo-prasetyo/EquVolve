// Browser tests for saving a run to IndexedDB and restoring it after the
// page is closed and opened again.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, openApp, openTab, reload, storedSession, waitForStoredSession,
  uploadCsv, setSettings, loadedSummary, button, startButton, status,
  generation, recordGenerations, waitForStatus
} = require('./helpers');

useBrowser();

const RESTORE_PROMPT = 'Restore previous GP evolution session?';

// Run sin(x) (never solved exactly by + - *) to `generations`, and wait
// until the finished run's checkpoint is in IndexedDB.
async function runToMaxGenerations(page, generations) {
  await page.locator('#formula').fill('sin(x)');
  await setSettings(page, { 'Target R²': 1, 'Max Generations': generations, 'Population Size': 60 });
  await startButton(page).click();
  await waitForStatus(page, `Stopped at Max Generations (${generations}).`);
  await waitForStoredSession(page, (s) => s && s.generation === generations);
}

test('a fresh visit has nothing to restore', async (t) => {
  const page = await openApp(t);

  assert.equal(await storedSession(page), null);
  await reload(page);
  assert.deepEqual(page.dialogs, []);
});

test('a finished run is restored, paused, with its settings and results', async (t) => {
  const page = await openApp(t, { dialogs: 'accept' });

  // Slow mode reports every generation, so the resumed run below shows
  // whether it continues from 5 or starts again from 1
  await page.getByLabel('Speed').selectOption('slow');
  await runToMaxGenerations(page, 5);
  const expression = await page.locator('.expression').innerText();

  await reload(page);

  assert.deepEqual(page.dialogs, [RESTORE_PROMPT]);
  await waitForStatus(page, 'Restored session at generation 5. Press Resume to continue.');

  assert.equal(await generation(page), 5);
  assert.equal(await page.locator('#formula').inputValue(), 'sin(x)');
  assert.equal(await page.getByLabel('Population Size').inputValue(), '60');
  assert.equal(await page.locator('.expression').innerText(), expression);
  assert.ok(await button(page, 'Resume').isEnabled());
  assert.equal(await page.getByLabel('Speed').inputValue(), 'slow');

  // the restored population carries on from generation 5
  await setSettings(page, { 'Max Generations': 8 });
  const seen = await recordGenerations(page);
  await button(page, 'Resume').click();
  await waitForStatus(page, 'Stopped at Max Generations (8).');
  assert.ok(Math.min(...await seen()) > 5, `restarted instead of continuing: ${await seen()}`);
});

test('a stopped run is restored at the generation where it stopped', async (t) => {
  const page = await openApp(t, { dialogs: 'accept' });

  await page.locator('#formula').fill('sin(x)');
  await setSettings(page, { 'Target R²': 1, 'Max Generations': 1000000 });
  await startButton(page).click();
  await page.waitForTimeout(500);
  await button(page, 'Stop').click();
  await waitForStatus(page, 'Paused.');

  // the worker answers Stop with its exact state, saved as the checkpoint
  await page.waitForTimeout(300);
  const stopped = await generation(page);
  await waitForStoredSession(page, (s) => s && s.generation === stopped);

  await reload(page);
  await waitForStatus(page, `Restored session at generation ${stopped}.`);
});

test('an uploaded dataset is restored with its file name', async (t) => {
  const page = await openApp(t, { dialogs: 'accept' });

  await uploadCsv(page, 'a,b,y\n1,2,9\n2,1,4\n3,5,1\n4,4,8\n5,0,2\n', 'mixed.csv');
  await setSettings(page, { 'Target R²': 1, 'Max Generations': 3 });
  await startButton(page).click();
  await waitForStatus(page, 'Stopped at Max Generations (3).');
  await waitForStoredSession(page, (s) => s && s.generation === 3);

  await reload(page);
  await waitForStatus(page, 'Restored session at generation 3.');

  assert.ok(await page.getByLabel('Upload dataset').isChecked());
  assert.equal(
    await loadedSummary(page).innerText(),
    'Loaded mixed.csv: 5 rows · inputs: a, b · target: y'
  );
});

test('declining the restore keeps the stored session for next time', async (t) => {
  const page = await openApp(t);

  await runToMaxGenerations(page, 3);

  page.answerDialogs = 'dismiss';
  await reload(page);

  assert.deepEqual(page.dialogs, [RESTORE_PROMPT]);
  assert.ok(await startButton(page).isEnabled());
  assert.equal(await generation(page), 0);
  assert.equal(await status(page).count(), 0);
  assert.equal((await storedSession(page)).generation, 3);

  await reload(page);
  assert.deepEqual(page.dialogs, [RESTORE_PROMPT, RESTORE_PROMPT]);
});

test('Clear Results deletes the stored session', async (t) => {
  const page = await openApp(t, { dialogs: 'accept' });

  await runToMaxGenerations(page, 3);
  await button(page, 'Clear Results').click();
  await startButton(page).waitFor();
  await waitForStoredSession(page, (s) => s === null);

  page.dialogs.length = 0;
  await reload(page);
  assert.deepEqual(page.dialogs, []);
});

test('opening a share link does not offer to restore the saved session', async (t) => {
  const page = await openApp(t, { dialogs: 'accept' });

  await runToMaxGenerations(page, 3);
  await button(page, 'Copy share link').click();
  const url = await page.getByLabel('Share link').inputValue();

  const tab = await openTab(page, url);

  await waitForStatus(tab, 'Loaded a shared run');
  assert.deepEqual(tab.dialogs, []);

  // and the saved session is still there
  assert.equal((await storedSession(tab)).generation, 3);
});
