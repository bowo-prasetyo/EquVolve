// Browser tests for the Copy button of the export tabs and for
// Copy share link, with the clipboard allowed and with it failing.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  useBrowser, openApp, openTab, button, startButton, status, waitForStatus
} = require('./helpers');

useBrowser();

// The default target x*x + 2 is solved exactly in generation 1, so the
// exported text is known in advance.
const EXPORTS = {
  Formula: 'pow(x, 2) + 2',
  JavaScript: 'const f = (x) => Math.pow(x, 2) + 2;',
  Python: 'import math\n\n\ndef f(x):\n    return x ** 2 + 2\n',
  LaTeX: 'y = {x}^{2} + 2'
};

async function solvedRun(t, options) {
  const page = await openApp(t, options);
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');
  return page;
}

const copyButton = (page) => page.locator('.export .tabs button:not([role="tab"])');
const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText());
const exportText = (page) => page.locator('.export-text').evaluate((el) => el.textContent);

test('Copy puts exactly the selected export on the clipboard', async (t) => {
  const page = await solvedRun(t, { clipboard: 'grant' });

  for (const [tab, expected] of Object.entries(EXPORTS)) {
    await page.getByRole('tab', { name: tab }).click();
    assert.equal(await exportText(page), expected, `${tab} shown`);

    await copyButton(page).click();
    await copyButton(page).filter({ hasText: 'Copied!' }).waitFor();

    assert.equal(await clipboard(page), expected, `${tab} copied`);
  }
});

test('the Copy label returns to "Copy" after two seconds', async (t) => {
  const page = await solvedRun(t, { clipboard: 'grant' });

  await copyButton(page).click();
  await copyButton(page).filter({ hasText: 'Copied!' }).waitFor();

  await page.waitForTimeout(1500);
  assert.equal(await copyButton(page).innerText(), 'Copied!');

  await copyButton(page).filter({ hasText: /^Copy$/ }).waitFor({ timeout: 2000 });
});

test('when the clipboard fails, Copy says so and the text stays selectable', async (t) => {
  const page = await solvedRun(t, { clipboard: 'fail' });

  await copyButton(page).click();
  await copyButton(page).filter({ hasText: 'Copy failed: select the text manually' }).waitFor();

  // the export is still on screen to copy by hand
  assert.equal(await exportText(page), EXPORTS.Formula);
  await copyButton(page).filter({ hasText: /^Copy$/ }).waitFor({ timeout: 3000 });
});

test('Copy share link copies the link it shows, and the link opens the run', async (t) => {
  const page = await solvedRun(t, { clipboard: 'grant' });

  await button(page, 'Copy share link').click();
  await waitForStatus(page, 'Share link copied to the clipboard.');
  assert.match(
    await status(page).innerText(),
    /It contains the settings, the data and the best program, but not the population\.$/
  );

  const shown = await page.getByLabel('Share link').inputValue();
  assert.equal(await clipboard(page), shown);
  assert.match(shown, /#\/\?run=[zj]/);

  const visitor = await openTab(page, shown);
  await waitForStatus(visitor, 'Loaded a shared run: R² 1.000000 after 1 generation.');
  assert.equal(await visitor.locator('.expression').innerText(), 'y = pow(x, 2) + 2');
});

test('when the clipboard fails, the share link is still shown to copy by hand', async (t) => {
  const page = await solvedRun(t, { clipboard: 'fail' });

  await button(page, 'Copy share link').click();
  await waitForStatus(page, 'Share link created below.');

  const shown = page.getByLabel('Share link');
  assert.match(await shown.inputValue(), /#\/\?run=[zj]/);

  // focusing the box selects the whole link, ready to copy
  await shown.focus();
  assert.ok(await shown.evaluate((el) =>
    el.selectionStart === 0 && el.selectionEnd === el.value.length));
});
