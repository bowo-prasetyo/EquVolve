// Browser tests for how results read: R² in words, results in the
// page's own font (formulas in code), and expression tree nodes that
// fit their labels.
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../../shared.js');
const { useBrowser, appUrl, openApp, startButton, waitForStatus } = require('./helpers');

useBrowser();

const T = (op, left, right) => ({ op, left, right });

// Open a share link with a fixed program and R².
async function openShared(t, model, r2, variables = ['a', 'Years_of_experience']) {
  const dataset = [];
  for (let i = 0; i < 6; i++) {
    const v = Object.fromEntries(variables.map((n, k) => [n, i + k]));
    dataset.push({ v, y: i * i });
  }

  const code = await s.encodeShare(s.buildSharePayload({
    config: {
      targetFormula: 'x', minX: -5, maxX: 5, sampleCount: 101, populationSize: 200,
      targetR2: 0.999, maxGenerations: 500, operators: ['+', '-', '*', 'log10'], mutationRate: 0.1,
      crossoverRate: 0.7, elitismRate: 0.05, tournamentSize: 5, treeDepth: 4, maxTreeDepth: 8,
      linearScaling: true, constantOptimization: false, speed: 'fast', dataMode: 'dataset',
      variables, targetName: 'y', dataset
    },
    model,
    r2,
    generation: 7,
    fileName: 'fixed.csv'
  }));

  const page = await openApp(t, { url: `${appUrl()}#/?run=${code}` });
  await waitForStatus(page, 'Loaded a shared run');
  return page;
}

test('R² is put into words next to the number', async (t) => {
  const page = await openApp(t);
  const quality = page.locator('.stat', { hasText: 'Best R²' }).locator('.fit-quality');

  assert.equal(await quality.count(), 0, 'nothing before a run');

  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');
  assert.equal(await quality.innerText(), 'Excellent fit');

  // and explained once in plain language
  await page.getByText('R² measures the fit: 1 is perfect, 0 is no better than always guessing the average').waitFor();
});

test('a poor fit says so', async (t) => {
  const page = await openShared(t, T('+', 'a', 'Years_of_experience'), 0.42);
  assert.equal(await page.locator('.fit-quality').innerText(), 'Poor fit');
});

test('stats and recent generations use the page font, with formulas as code', async (t) => {
  const page = await openApp(t);
  await startButton(page).click();
  await waitForStatus(page, 'Target R² reached');

  const fonts = await page.evaluate(() => {
    const font = (el) => getComputedStyle(el).fontFamily;
    return {
      body: font(document.body),
      stat: font(document.querySelector('.stat b')),
      meta: font(document.querySelector('.history-meta')),
      code: font(document.querySelector('.history code')),
      status: font(document.querySelector('[role="status"]'))
    };
  });

  assert.equal(fonts.stat, fonts.body);
  assert.equal(fonts.meta, fonts.body);
  assert.equal(fonts.status, fonts.body);
  assert.match(fonts.code, /mono/i);

  assert.match(await page.locator('.history').first().innerText(), /^Generation 1 · R² 1\.000000\s+pow\(x, 2\) \+ 2$/);
});

test('long numbers and names fit inside their tree nodes, with every digit on hover', async (t) => {
  const model = T('+',
    T('*', '0.0000017645', 'Years_of_experience'),
    T('*', { op: 'log10', child: 'a' }, '123456.78'));
  const page = await openShared(t, model, 0.9);

  const nodes = await page.$$eval('svg.tree g.node', (gs) => gs.map((g) => {
    const rect = g.querySelector('rect');
    const text = g.querySelector('text');
    return {
      label: text.textContent.trim(),
      title: g.querySelector('title').textContent,
      rect: [Number(rect.getAttribute('x')), Number(rect.getAttribute('width'))],
      text: (({ x, width }) => [x, width])(text.getBBox())
    };
  }));

  const byLabel = Object.fromEntries(nodes.map(n => [n.label, n]));

  // short labels for numbers; the full value in the tooltip
  assert.equal(byLabel['1.76e-6'].title, '0.0000017645');
  assert.equal(byLabel['1.23e5'].title, '123456.78');
  assert.equal(byLabel.Years_of_experience.title, 'input Years_of_experience');

  // every label lies inside its node
  for (const n of nodes) {
    const [x, width] = n.rect;
    assert.ok(n.text[0] >= x && n.text[0] + n.text[1] <= x + width, `"${n.label}" fits: text ${n.text}, node ${n.rect}`);
  }

  // and no two nodes on a level overlap
  const levels = await page.$$eval('svg.tree rect', (rs) => rs.map(r =>
    [Number(r.getAttribute('y')), Number(r.getAttribute('x')), Number(r.getAttribute('width'))]));
  const byY = new Map();
  for (const [y, x, w] of levels) byY.set(y, [...(byY.get(y) || []), [x, x + w]]);
  for (const spans of byY.values()) {
    spans.sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < spans.length; i++) {
      assert.ok(spans[i][0] >= spans[i - 1][1], `nodes overlap: ${JSON.stringify(spans)}`);
    }
  }
});
