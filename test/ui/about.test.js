// Browser tests for the About page, which renders the README. The README
// request is answered with this checkout's README.md (see helpers.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { useBrowser, openApp, appUrl } = require('./helpers');

useBrowser();

async function openAbout(t, options) {
  const page = await openApp(t, options);
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await page.locator('.about').waitFor();
  return page;
}

async function waitForReadme(page) {
  await page.locator('.about h1', { hasText: 'EquVolve' }).waitFor();
}

test('the About page renders the README, logo included', async (t) => {
  const page = await openAbout(t);
  await waitForReadme(page);

  for (const heading of ['What it does', 'How it works', 'Example results', 'Running locally']) {
    assert.ok(await page.locator('.about h2', { hasText: heading }).isVisible(), heading);
  }

  assert.ok(await page.locator('.about table').count() > 0, 'tables are rendered');

  const logo = page.locator('.about img').first();
  await logo.waitFor();
  assert.ok(
    await logo.evaluate((img) => img.complete && img.naturalWidth > 0),
    'the logo image loads'
  );
});

test('every heading gets the anchor GitHub gives it', async (t) => {
  const page = await openAbout(t);
  await waitForReadme(page);

  const ids = await page.$$eval('.about :is(h1, h2, h3, h4, h5, h6)', (hs) => hs.map(h => h.id));

  assert.ok(ids.length > 20, `only ${ids.length} headings`);
  assert.ok(ids.every(Boolean), 'every heading has an id');
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');

  // spot checks against GitHub's anchors
  for (const id of [
    'what-it-does',
    '1-choose-a-data-source',
    'constant-optimisation-experimental',
    'example-results'
  ]) {
    assert.ok(ids.includes(id), `#${id}`);
  }
});

test('every in-page link in the README points at a heading', async (t) => {
  const page = await openAbout(t);
  await waitForReadme(page);

  const broken = await page.$$eval('.about a[href^="#"]', (links) => links
    .map(a => a.getAttribute('href'))
    .filter(href => !href.startsWith('#/'))
    .filter(href => !document.getElementById(decodeURIComponent(href.slice(1)))));

  assert.deepEqual(broken, [], 'links without a matching heading');
});

test('an in-page link scrolls to its section and stays on the About page', async (t) => {
  const page = await openAbout(t);
  await waitForReadme(page);

  const before = page.url();
  const heading = page.locator('#example-results');

  assert.ok(!(await heading.evaluate(inViewport)), 'the section starts off-screen');

  await page.locator('.about a[href="#example-results"]').first().click();

  // still the About page, at the same address, not a blank route
  assert.equal(page.url(), before);
  assert.ok(await page.locator('.about h1').isVisible());
  await page.waitForFunction(() => {
    // at the top of the window (sub-pixel rounding can leave it at -0.5)
    const r = document.getElementById('example-results').getBoundingClientRect();
    return Math.abs(r.top) < 5;
  });

  // the app's own navigation still works afterwards
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.locator('.page-header').waitFor();
  assert.equal(page.url(), appUrl() + '#/');
});

test('a README that cannot be loaded shows a message instead of an error page', async (t) => {
  for (const [name, readme] of [
    ['not found', (route) => route.fulfill({ status: 404, body: '404: Not Found' })],
    ['network error', (route) => route.abort()]
  ]) {
    await t.test(name, async (t) => {
      const page = await openAbout(t, { readme });

      await page.locator('.about', { hasText: 'Failed to load README.md' }).waitFor();
      assert.equal(await page.locator('.about', { hasText: '404: Not Found' }).count(), 0);
    });
  }
});

function inViewport(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}
