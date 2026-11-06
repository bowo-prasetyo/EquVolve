// Browser tests for tap targets: on a phone every control is at least
// 44 × 44 px tall (WCAG 2.5.5), and the desktop layout stays compact.
const test = require('node:test');
const assert = require('node:assert/strict');
const { useBrowser, openApp, startButton, waitForStatus, openAdvanced } = require('./helpers');

useBrowser();

const PHONE = { viewport: { width: 390, height: 844 } };

// Visible controls shorter than 44 px, as [what, height]. For checkboxes
// and radios the target is their label, which is what a finger hits.
function smallTargets(page) {
  return page.evaluate(() => {
    const target = (el) => (el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label')) || el;
    const seen = new Set();
    const small = [];

    for (const el of document.querySelectorAll('button, select, input, nav a')) {
      if (!el.offsetParent || el.type === 'range') continue;
      const t = target(el);
      if (seen.has(t)) continue;
      seen.add(t);
      const h = Math.round(t.getBoundingClientRect().height);
      if (h < 44) small.push([(t.textContent || t.value || t.type || t.tagName).trim().slice(0, 20), h]);
    }

    return small;
  });
}

test('on a phone, every control is at least 44 px tall', async (t) => {
  const page = await openApp(t, PHONE);
  await openAdvanced(page);

  assert.deepEqual(await smallTargets(page), []);

  // the operator checkboxes are chips whose whole label can be tapped
  const chip = page.locator('label.operator', { hasText: 'sin' }).first();
  const box = await chip.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, `sin chip ${box.width} × ${box.height}`);
  await chip.click({ position: { x: box.width - 6, y: box.height / 2 } });
  assert.ok(await page.locator('.operator-groups input[value="sin"]').isChecked(), 'tapping the chip ticks it');

  // and after a run: replay, export tabs and copy buttons
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');
  assert.deepEqual(await smallTargets(page), []);
});

test('on a desktop with a mouse, the compact layout is kept', async (t) => {
  const page = await openApp(t);

  const presetHeight = (await page.getByRole('button', { name: 'Rational', exact: true }).boundingBox()).height;
  assert.ok(presetHeight < 40, `preset button ${presetHeight}px`);

  const chipBorder = await page.locator('label.operator').first().evaluate(l => getComputedStyle(l).borderTopStyle);
  assert.equal(chipBorder, 'none');
});
