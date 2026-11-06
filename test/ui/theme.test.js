// Browser tests for the Auto / Light / Dark theme toggle.
const test = require('node:test');
const assert = require('node:assert/strict');
const { useBrowser, openApp, reload } = require('./helpers');

useBrowser();

const DARK_BG = 'rgb(17, 17, 17)';     // --bg #111
const LIGHT_BG = 'rgb(246, 246, 243)'; // --bg #f6f6f3

const toggle = (page) => page.locator('button.theme-toggle');

async function themeState(page) {
  return page.evaluate(() => ({
    attribute: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('equvolve-theme'),
    background: getComputedStyle(document.body).backgroundColor,
    themeColor: document.querySelector('meta[name="theme-color"]').content
  }));
}

test('Auto follows the device, including when the device switches', async (t) => {
  const page = await openApp(t, { colorScheme: 'dark' });

  assert.equal(await toggle(page).innerText(), '🖥️ Auto');
  assert.equal(await toggle(page).getAttribute('title'), 'Theme follows your device. Click for light.');
  assert.deepEqual(await themeState(page), {
    attribute: null, stored: null, background: DARK_BG, themeColor: '#111'
  });

  await page.emulateMedia({ colorScheme: 'light' });
  assert.equal((await themeState(page)).background, LIGHT_BG);
  await page.waitForFunction(() =>
    document.querySelector('meta[name="theme-color"]').content === '#f6f6f3');

  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal((await themeState(page)).background, DARK_BG);
});

test('the toggle cycles Auto → Light → Dark → Auto and remembers the choice', async (t) => {
  const page = await openApp(t, { colorScheme: 'dark' });

  await toggle(page).click();
  assert.equal(await toggle(page).innerText(), '☀️ Light');
  assert.equal(await toggle(page).getAttribute('aria-label'), 'Light theme. Click for dark.');
  assert.deepEqual(await themeState(page), {
    attribute: 'light', stored: 'light', background: LIGHT_BG, themeColor: '#f6f6f3'
  });

  await toggle(page).click();
  assert.equal(await toggle(page).innerText(), '🌙 Dark');
  assert.deepEqual(await themeState(page), {
    attribute: 'dark', stored: 'dark', background: DARK_BG, themeColor: '#111'
  });

  await toggle(page).click();
  assert.equal(await toggle(page).innerText(), '🖥️ Auto');
  assert.deepEqual(await themeState(page), {
    attribute: null, stored: null, background: DARK_BG, themeColor: '#111'
  });
});

test('a chosen theme survives a reload and overrides the device', async (t) => {
  // the device prefers light, the visitor picks dark
  const page = await openApp(t, { colorScheme: 'light' });

  assert.equal((await themeState(page)).background, LIGHT_BG);

  await toggle(page).click(); // Light
  await toggle(page).click(); // Dark
  assert.equal((await themeState(page)).background, DARK_BG);

  await reload(page);

  assert.equal(await toggle(page).innerText(), '🌙 Dark');
  assert.deepEqual(await themeState(page), {
    attribute: 'dark', stored: 'dark', background: DARK_BG, themeColor: '#111'
  });
});

test('the saved theme is applied before the app starts, so the page never flashes', async (t) => {
  const page = await openApp(t, { colorScheme: 'dark' });

  await page.evaluate(() => localStorage.setItem('equvolve-theme', 'light'));

  // Without app.js the only thing that can apply the theme is the inline
  // script in <head>, which runs before the first paint.
  await page.route('**/app.js', (route) => route.abort());
  await page.reload();

  // the page header is rendered by the app, so it is missing
  assert.equal(await page.locator('.page-header').count(), 0, 'the app should not have started');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    LIGHT_BG
  );

  await page.unroute('**/app.js');
  await reload(page);
  assert.equal(await toggle(page).innerText(), '☀️ Light');
});

test('the theme toggle works on the About page too', async (t) => {
  const page = await openApp(t, { colorScheme: 'dark' });

  await page.getByRole('link', { name: 'About' }).click();
  await page.locator('.about').waitFor();

  await toggle(page).click();
  assert.equal((await themeState(page)).background, LIGHT_BG);

  await page.getByRole('link', { name: 'Home' }).click();
  await page.locator('.page-header').waitFor();
  assert.equal(await toggle(page).innerText(), '☀️ Light');
});
