// Browser tests for browsers that do not allow storage (some private
// modes, storage turned off, sandboxed frames): IndexedDB is missing or
// cannot be opened. EquVolve must still work in full; it just cannot
// save runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../../shared.js');
const { useBrowser, openApp, appUrl, startButton, waitForStatus } = require('./helpers');

useBrowser();

const T = (op, left, right) => ({ op, left, right });

async function shareLink() {
  const code = await s.encodeShare(s.buildSharePayload({
    config: {
      targetFormula: '3*x + 1', minX: -5, maxX: 5, sampleCount: 101, populationSize: 200,
      targetR2: 0.999, maxGenerations: 500, operators: ['+', '-', '*'], mutationRate: 0.1,
      crossoverRate: 0.7, elitismRate: 0.05, tournamentSize: 5, treeDepth: 4, maxTreeDepth: 8,
      linearScaling: true, constantOptimization: false, speed: 'fast', dataMode: 'formula'
    },
    model: T('+', T('*', '3', 'x'), '1'),
    r2: 1,
    generation: 4
  }));

  return `${appUrl()}#/?run=${code}`;
}

// Whether the fit chart has anything drawn on it.
function fitChartDrawn(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() !== blank.toDataURL();
  });
}

for (const storage of ['missing', 'failing']) {
  test(`storage ${storage}: the page loads cleanly and draws the target`, async (t) => {
    const page = await openApp(t, { storage });

    assert.equal(await fitChartDrawn(page), true);
    assert.deepEqual(page.consoleErrors, []);
  });

  test(`storage ${storage}: a share link still opens the shared run`, async (t) => {
    const page = await openApp(t, { storage, url: await shareLink() });

    await waitForStatus(page, 'Loaded a shared run');
    assert.match(await page.locator('.expression').innerText(), /3 \* x \+ 1/);
    assert.equal(await page.locator('#formula').inputValue(), '3*x + 1');
    assert.deepEqual(page.consoleErrors, []);
  });

  test(`storage ${storage}: a run starts, finishes and can be cleared`, async (t) => {
    const page = await openApp(t, { storage });

    await startButton(page).click();
    await waitForStatus(page, 'Target R² reached');
    assert.deepEqual(page.consoleErrors, []);
  });
}
