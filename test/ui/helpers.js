// Shared setup for the browser tests: a static server, one Chromium
// per test file, and helpers to open and drive the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startServer } = require('./server');

// The About page fetches the README from GitHub's main branch. Tests
// answer with this checkout's README instead, so they check the README
// being changed and do not depend on what is merged.
const README_URL = 'https://raw.githubusercontent.com/bowo-prasetyo/equvolve/main/README.md';
const LOCAL_README = path.join(__dirname, '..', '..', 'README.md');

function serveLocalReadme(route) {
  return route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: fs.readFileSync(LOCAL_README, 'utf8')
  });
}

let server;
let browser;

// Call once at the top of a test file.
function useBrowser() {
  test.before(async () => {
    server = await startServer();
    browser = await chromium.launch();
  });

  test.after(async () => {
    await browser?.close();
    await server?.close();
  });
}

const appUrl = () => server.url;

// A fresh browser context (so no IndexedDB session, restore prompt or
// theme choice leaks between tests) with one page on the app.
//
// options.colorScheme: 'light' | 'dark' (the device setting to emulate)
// options.dialogs: 'dismiss' (default) | 'accept', changeable later
//   with page.answerDialogs = 'accept'
// options.readme: a Playwright route handler for the README request
//   (default: serve the local README.md)
// options.clipboard: 'grant' to allow reading and writing the clipboard,
//   'fail' to make every clipboard write fail (as when it is blocked)
//
// Every dialog's message is recorded in page.dialogs. Uncaught page
// errors fail the test.
async function openApp(t, options = {}) {
  const context = await browser.newContext({
    colorScheme: options.colorScheme || 'dark',
    permissions: options.clipboard === 'grant' ? ['clipboard-read', 'clipboard-write'] : []
  });

  if (options.clipboard === 'fail') {
    await context.addInitScript(() => {
      navigator.clipboard.writeText = () => Promise.reject(new DOMException('Write blocked', 'NotAllowedError'));
    });
  }

  await context.route(README_URL, options.readme || serveLocalReadme);

  const page = await context.newPage();
  const errors = [];

  page.dialogs = [];
  page.answerDialogs = options.dialogs || 'dismiss';

  context.on('page', (p) => watchPage(p, errors));
  watchPage(page, errors);

  t.after(async () => {
    await context.close();
    assert.deepEqual(errors, [], 'uncaught errors on the page');
  });

  await gotoApp(page, options.url);

  return page;
}

function watchPage(page, errors) {
  page.dialogs ??= [];
  page.answerDialogs ??= 'dismiss';
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => {
    page.dialogs.push(d.message());
    return page.answerDialogs === 'accept' ? d.accept() : d.dismiss();
  });
}

// Another page in the same context (same IndexedDB and localStorage),
// for example a visitor opening a share link in a new tab.
async function openTab(page, url) {
  const tab = await page.context().newPage();
  await gotoApp(tab, url);
  return tab;
}

async function gotoApp(page, url = server.url) {
  await page.goto(url);
  await page.locator('.page-header').waitFor();
}

async function reload(page) {
  await page.reload();
  await page.locator('.page-header').waitFor();
}

// The checkpoint stored in IndexedDB, or null. Never creates or upgrades
// the database, so it cannot get in the way of the app's own setup.
function storedSession(page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();

    if (!dbs.some(d => d.name === 'gp-db')) return null;

    return new Promise((resolve, reject) => {
      // no version: open the database as it is
      const open = indexedDB.open('gp-db');

      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;

        if (!db.objectStoreNames.contains('sessions')) {
          db.close();
          resolve(null);
          return;
        }

        const get = db.transaction('sessions').objectStore('sessions').get('latest');

        get.onsuccess = () => {
          db.close();
          resolve(get.result ? { generation: get.result.generation } : null);
        };
        get.onerror = () => reject(get.error);
      };
    });
  });
}

// Write a checkpoint into IndexedDB as if a run had saved it, after the
// app has created the database. Reload the page to be offered it.
async function storeSession(page, state) {
  await page.waitForFunction(async () =>
    (await indexedDB.databases()).some(d => d.name === 'gp-db' && d.version === 2));

  await page.evaluate((s) => new Promise((resolve, reject) => {
    const open = indexedDB.open('gp-db');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({ id: 'latest', ...s });
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), state);
}

// Wait until the stored checkpoint matches `check` (writes are async).
async function waitForStoredSession(page, check, timeout = 10000) {
  const until = Date.now() + timeout;
  let last;

  while (Date.now() < until) {
    last = await storedSession(page);
    if (check(last)) return last;
    await page.waitForTimeout(100);
  }

  assert.fail(`stored session never matched; last: ${JSON.stringify(last)}`);
}

async function uploadCsv(page, text, name = 'data.csv') {
  await page.getByLabel('Upload dataset').check();
  await page.locator('#csv').setInputFiles({
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(text)
  });
}

// Fill in run settings. Keys are the labels shown in the app.
async function setSettings(page, settings) {
  for (const [label, value] of Object.entries(settings)) {
    await page.getByLabel(label, { exact: false }).first().fill(String(value));
  }
}

const loadedSummary = (page) => page.locator('.code', { hasText: /^\s*Loaded / });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const startButton = (page) => button(page, 'Start Evolution');
const status = (page) => page.getByRole('status');
const errorBox = (page) => page.getByRole('alert');
const generation = async (page) =>
  Number(await page.locator('.stat', { hasText: 'Generation' }).locator('b').innerText());

// Start recording every value the Generation counter shows; the returned
// function gives the values seen so far. Used to prove that a resumed
// run continues instead of starting again from generation 1.
async function recordGenerations(page) {
  await page.evaluate(() => {
    const stat = [...document.querySelectorAll('.stat')].find(s => s.textContent.includes('Generation'));
    const value = stat.querySelector('b');

    window.__generationsSeen = [];
    new MutationObserver(() => window.__generationsSeen.push(Number(value.textContent)))
      .observe(value, { childList: true, characterData: true, subtree: true });
  });

  return () => page.evaluate(() => window.__generationsSeen);
}

async function waitForStatus(page, text, timeout = 30000) {
  await status(page).filter({ hasText: text }).waitFor({ timeout });
}

module.exports = {
  README_URL,
  useBrowser,
  appUrl,
  openApp,
  openTab,
  reload,
  storedSession,
  storeSession,
  waitForStoredSession,
  uploadCsv,
  setSettings,
  loadedSummary,
  button,
  startButton,
  status,
  errorBox,
  generation,
  recordGenerations,
  waitForStatus
};
